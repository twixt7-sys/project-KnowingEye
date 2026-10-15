"""Session-level EBI running-average persistence (features.behavior.services)."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from features.behavior.services import persist_analysis, record_frame_metrics
from features.exams.models import Exam
from features.session.models import ExamSession

User = get_user_model()


def _frame(ebi, *, face=None, identity=None, upper=None, gaze=None):
    """Build a minimal analysis payload carrying an EBI + components."""
    return {
        "metrics": {
            "exam_behavior_index_pct": ebi,
            "overall_compliance_pct": ebi,
            "ebi_components": {
                "face_presence": face,
                "face_identity": identity,
                "upper_body_presence": upper,
                "looking_away_compliance": gaze,
            },
        },
        "events": [],
        "alerts": [],
    }


class EbiAggregateTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user(
            username="admin_ebi",
            email="admin_ebi@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="student_ebi",
            email="student_ebi@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        exam = Exam.objects.create(
            title="EBI Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=admin,
        )
        self.session = ExamSession.objects.create(exam=exam, user=self.examinee)

    def test_running_mean_matches_arithmetic_mean(self):
        for value in (90.0, 60.0, 30.0):
            record_frame_metrics(self.session, _frame(value))
        self.session.refresh_from_db()
        self.assertEqual(self.session.ebi_sample_count, 3)
        self.assertAlmostEqual(self.session.ebi_average, 60.0, places=2)

    def test_component_means_tracked(self):
        record_frame_metrics(
            self.session, _frame(75.0, face=100.0, identity=50.0, upper=100.0, gaze=50.0)
        )
        record_frame_metrics(
            self.session, _frame(75.0, face=100.0, identity=70.0, upper=80.0, gaze=40.0)
        )
        self.session.refresh_from_db()
        self.assertAlmostEqual(self.session.ebi_face_presence_avg, 100.0, places=2)
        self.assertAlmostEqual(self.session.ebi_face_identity_avg, 60.0, places=2)
        self.assertAlmostEqual(self.session.ebi_upper_body_avg, 90.0, places=2)
        self.assertAlmostEqual(self.session.ebi_looking_away_avg, 45.0, places=2)

    def test_identity_averaged_only_over_evaluated_frames(self):
        # Frame 1: identity not evaluated. Frame 2: identity = 80.
        record_frame_metrics(self.session, _frame(50.0, face=50.0, upper=50.0, gaze=50.0))
        record_frame_metrics(
            self.session, _frame(80.0, face=80.0, identity=80.0, upper=80.0, gaze=80.0)
        )
        self.session.refresh_from_db()
        self.assertEqual(self.session.ebi_sample_count, 2)
        self.assertEqual(self.session.ebi_identity_sample_count, 1)
        # Identity mean is over the single evaluated frame, not diluted by the
        # not-evaluated frame.
        self.assertAlmostEqual(self.session.ebi_face_identity_avg, 80.0, places=2)

    def test_persist_analysis_folds_ebi(self):
        persist_analysis(self.session, _frame(88.0))
        self.session.refresh_from_db()
        self.assertEqual(self.session.ebi_sample_count, 1)
        self.assertAlmostEqual(self.session.ebi_average, 88.0, places=2)

    def test_missing_ebi_is_a_noop(self):
        updated = record_frame_metrics(self.session, {"events": [], "alerts": []})
        self.assertFalse(updated)
        self.session.refresh_from_db()
        self.assertEqual(self.session.ebi_sample_count, 0)
        self.assertIsNone(self.session.ebi_average)
