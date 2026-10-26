"""Live data-change notifications reaching the ``/ws/updates/`` socket."""

from __future__ import annotations

from unittest import mock

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from core.config.asgi import application
from core.realtime import events
from core.realtime.events import ALL_GROUP, STAFF_GROUP, Topic, notify, user_group
from features.behavior.models import Alert
from features.exams.models import Department, Exam
from features.session.models import ExamSession

User = get_user_model()


def _sent(send_mock) -> set[tuple[str, str, int | None]]:
    return {
        (call.args[0], call.args[1]["topic"], call.args[1]["exam_id"])
        for call in send_mock.call_args_list
    }


class NotifyTests(TransactionTestCase):
    def setUp(self):
        self.send = mock.MagicMock()
        patcher = mock.patch.object(events, "async_to_sync", return_value=self.send)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_waits_for_commit_and_collapses_repeats(self):
        with transaction.atomic():
            notify(Topic.EXAMS, exam_id=1)
            notify(Topic.EXAMS, exam_id=1)
            notify(Topic.EXAMS, exam_id=1, audience=STAFF_GROUP, user_id=7)
            self.send.assert_not_called()
        self.assertEqual(
            _sent(self.send),
            {
                (ALL_GROUP, "exams", 1),
                (STAFF_GROUP, "exams", 1),
                (user_group(7), "exams", 1),
            },
        )
        self.assertEqual(self.send.call_count, 3)

    def test_rolled_back_changes_are_never_announced(self):
        with self.assertRaises(RuntimeError), transaction.atomic():
            notify(Topic.EXAMS, exam_id=1)
            raise RuntimeError
        self.send.assert_not_called()
        # The next transaction still gets its own batch.
        with transaction.atomic():
            notify(Topic.REFERENCE)
        self.assertEqual(_sent(self.send), {(ALL_GROUP, "reference", None)})

    def test_user_only_audience(self):
        notify(Topic.ME, audience=None, user_id=3)
        self.assertEqual(_sent(self.send), {(user_group(3), "me", None)})

    def test_drops_cached_reports(self):
        with mock.patch.object(events, "bump_namespace") as bump:
            notify(Topic.SESSIONS, exam_id=2, audience=STAFF_GROUP)
        bump.assert_called_once_with("reports")

    def test_model_writes_announce_their_topic(self):
        admin = User.objects.create_user(
            username="admin", email="a@x.com", password="pw", role=User.Role.ADMIN
        )
        student = User.objects.create_user(username="stu", email="s@x.com", password="pw")
        self.send.reset_mock()

        Department.objects.create(name="Engineering", abbreviation="ENG")
        self.assertIn((ALL_GROUP, "reference", None), _sent(self.send))

        now = timezone.now()
        exam = Exam.objects.create(
            title="Midterm",
            description="",
            duration_minutes=10,
            passing_score=50,
            created_by=admin,
        )
        self.assertIn((ALL_GROUP, "exams", exam.id), _sent(self.send))

        self.send.reset_mock()
        session = ExamSession.objects.create(exam=exam, user=student)
        self.assertEqual(
            _sent(self.send),
            {(STAFF_GROUP, "sessions", exam.id), (user_group(student.id), "sessions", exam.id)},
        )

        # Timer bookkeeping is not announced; a status change is.
        self.send.reset_mock()
        session.save(update_fields=["deadline_at"])
        self.send.assert_not_called()
        session.status = ExamSession.Status.COMPLETED
        session.save(update_fields=["status"])
        self.assertIn((STAFF_GROUP, "sessions", exam.id), _sent(self.send))

        self.send.reset_mock()
        Alert.objects.create(session=session, alert_type="no_face", severity="high", message="x")
        self.assertEqual(_sent(self.send), {(STAFF_GROUP, "alerts", None)})

        # Sign-in bookkeeping is not announced; a role change reaches the user.
        self.send.reset_mock()
        student.last_login = now
        student.save(update_fields=["last_login"])
        self.send.assert_not_called()
        student.role = User.Role.PROCTOR
        student.save()
        self.assertEqual(
            _sent(self.send),
            {(STAFF_GROUP, "users", None), (user_group(student.id), "me", None)},
        )


class DataChangesSocketTests(TransactionTestCase):
    def _connect(self, user):
        token = str(AccessToken.for_user(user))
        return WebsocketCommunicator(
            application,
            f"/ws/updates/?token={token}",
            headers=[(b"origin", b"http://127.0.0.1")],
        )

    def _round_trip(self, user, group, expect_delivery):
        async def run():
            communicator = self._connect(user)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            self.assertEqual((await communicator.receive_json_from())["type"], "connected")
            await get_channel_layer().group_send(
                group, {"type": "data.changed", "topic": "alerts", "exam_id": None}
            )
            if expect_delivery:
                message = await communicator.receive_json_from()
                self.assertEqual(message, {"type": "changed", "topic": "alerts", "exam_id": None})
            else:
                self.assertTrue(await communicator.receive_nothing())
            await communicator.disconnect()

        async_to_sync(run)()

    def test_staff_receive_staff_topics(self):
        proctor = User.objects.create_user(
            username="p", email="p@x.com", password="pw", role=User.Role.PROCTOR
        )
        self._round_trip(proctor, STAFF_GROUP, expect_delivery=True)

    def test_examinees_do_not_receive_staff_topics(self):
        student = User.objects.create_user(username="s", email="s@x.com", password="pw")
        self._round_trip(student, STAFF_GROUP, expect_delivery=False)
        self._round_trip(student, user_group(student.id), expect_delivery=True)
        self._round_trip(student, ALL_GROUP, expect_delivery=True)

    def test_anonymous_is_rejected(self):
        async def run():
            communicator = WebsocketCommunicator(
                application, "/ws/updates/", headers=[(b"origin", b"http://127.0.0.1")]
            )
            connected, code = await communicator.connect()
            self.assertFalse(connected)
            self.assertEqual(code, 4401)

        async_to_sync(run)()
