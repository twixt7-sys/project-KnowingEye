from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.behavior.models import Alert, BehaviorLog
from features.behavior.services import persist_analysis
from features.exams.models import Exam
from features.session.models import ExamSession

User = get_user_model()


class BehaviorAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_beh",
            email="admin_beh@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="student_beh",
            email="student_beh@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        exam = Exam.objects.create(
            title="Behavior Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(exam=exam, user=self.examinee)

    def test_persist_analysis_creates_records(self):
        analysis = {
            "events": [
                {
                    "event_type": "looking_away",
                    "score_pct": 45.0,
                    "confidence_pct": 80.0,
                    "metadata": {},
                }
            ],
            "alerts": [
                {
                    "type": "gaze_focus",
                    "severity": "medium",
                    "message": "Gaze below threshold",
                    "metric_pct": 45.0,
                }
            ],
        }
        counts = persist_analysis(self.session, analysis)
        self.assertEqual(counts["behavior_logs"], 1)
        self.assertEqual(counts["alerts"], 1)
        self.assertEqual(BehaviorLog.objects.filter(session=self.session).count(), 1)
        self.assertEqual(Alert.objects.filter(session=self.session).count(), 1)

    def test_list_behavior_logs_authenticated(self):
        BehaviorLog.objects.create(
            session=self.session,
            event_type=BehaviorLog.EventType.NO_FACE,
            score=0.4,
            confidence=0.7,
        )
        self.client.force_authenticate(user=self.examinee)
        response = self.client.get(f"/api/behavior/logs/?session={self.session.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
