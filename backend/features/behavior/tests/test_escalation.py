"""Tests for the escalation ladder (Directive Area 04 - "Anomaly accumulation model").

The scoring core is pure (no DB), so these run against synthetic event
streams - exactly what the Directive asks for: "unit-test the escalation
ladder with synthetic event streams... the cheapest, most convincing demo
you can put in front of the panel."
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.security.service import apply_role_defaults
from features.behavior.escalation import (
    EscalationTier,
    EventRecord,
    compute_escalation_for_session,
    tier_from_events,
)
from features.behavior.models import BehaviorLog
from features.exams.models import Department, Exam
from features.session.models import ExamSession

User = get_user_model()

NOW = datetime(2026, 1, 1, 12, 0, 0, tzinfo=dt_timezone.utc)

# A small, easy-to-reason-about weight table for synthetic-stream tests that
# want to isolate one rule at a time, independent of the live pipeline.yaml
# values (which are exercised separately by the "real weights" tests below).
_TEST_WEIGHTS = {"minor": 0.3, "moderate": 0.6, "major": 1.0}


def _events(*, event_type: str, count: int, start: datetime, step_seconds: int = 1) -> list[EventRecord]:
    """Generate ``count`` events ending exactly at ``start`` and stepping
    backward in time - so they are all valid ("not in the future") relative
    to a ``now`` equal to ``start``, matching how real BehaviorLog rows are
    always timestamped at or before the query time."""
    return [
        EventRecord(event_type=event_type, timestamp=start - timedelta(seconds=i * step_seconds))
        for i in range(count)
    ]


class TierFromEventsSyntheticStreamTests(TestCase):
    """Pure-function tests - no database, no ML dependency."""

    def test_no_events_is_normal(self):
        result = tier_from_events([], now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3)
        self.assertEqual(result.tier, EscalationTier.NORMAL)
        self.assertEqual(result.combined_score, 0.0)
        self.assertFalse(result.recommend_intervention)

    def test_single_low_weight_event_is_warning_not_suspicious(self):
        """One frame of a mild signal must not escalate - duration/frequency matters."""
        events = _events(event_type="minor", count=1, start=NOW)
        result = tier_from_events(events, now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3)
        self.assertEqual(result.tier, EscalationTier.WARNING)

    def test_single_high_weight_event_alone_is_still_warning(self):
        """Even the highest non-critical-on-sight weight shouldn't fire on one frame."""
        events = _events(event_type="major", count=1, start=NOW)
        result = tier_from_events(events, now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3)
        self.assertEqual(result.tier, EscalationTier.WARNING)

    def test_repeated_low_weight_events_trigger_suspicious_via_min_flags(self):
        """3x a 0.3-weight signal (0.9 combined, below the 1.5 score bar) still
        escalates via the repeated-occurrence rule - frequency matters even
        when the weighted total alone wouldn't cross the line."""
        events = _events(event_type="minor", count=3, start=NOW)
        result = tier_from_events(events, now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3)
        self.assertEqual(result.tier, EscalationTier.SUSPICIOUS)
        self.assertLess(result.combined_score, 1.5)

    def test_combined_distinct_signals_score_higher_than_isolated(self):
        """Two different moderate signals together should outscore either alone,
        per Directive Area 04: weight combined signals higher than one isolated signal."""
        isolated = tier_from_events(
            _events(event_type="moderate", count=1, start=NOW),
            now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3,
        )
        combined = tier_from_events(
            [
                EventRecord(event_type="moderate", timestamp=NOW),
                EventRecord(event_type="minor", timestamp=NOW),
            ],
            now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3,
        )
        self.assertGreater(combined.combined_score, isolated.combined_score)
        self.assertEqual(combined.distinct_signal_types, 2)

    def test_events_outside_window_are_ignored(self):
        stale = _events(event_type="major", count=5, start=NOW - timedelta(seconds=120))
        result = tier_from_events(stale, now=NOW, weights=_TEST_WEIGHTS, window_seconds=60, min_flags=3)
        self.assertEqual(result.tier, EscalationTier.NORMAL)

    def test_identity_mismatch_is_critical_on_sight(self):
        """A single identity_mismatch is critical immediately - no repetition needed."""
        events = [EventRecord(event_type="identity_mismatch", timestamp=NOW)]
        result = tier_from_events(events, now=NOW, weights={"identity_mismatch": 0.95}, window_seconds=60, min_flags=3)
        self.assertEqual(result.tier, EscalationTier.CRITICAL)
        self.assertTrue(result.recommend_intervention)

    def test_only_critical_recommends_intervention(self):
        for tier_events, weights in [
            ([], _TEST_WEIGHTS),
            (_events(event_type="minor", count=1, start=NOW), _TEST_WEIGHTS),
        ]:
            result = tier_from_events(tier_events, now=NOW, weights=weights, window_seconds=60, min_flags=3)
            self.assertIn(result.tier, (EscalationTier.NORMAL, EscalationTier.WARNING))
            self.assertFalse(result.recommend_intervention)


class TierFromEventsRealWeightsTests(TestCase):
    """Same ladder, exercised against the live pipeline.yaml weights (no override) -
    confirms the defaults loaded from config produce sane tiers, not just the
    isolated synthetic-weight tests above."""

    def test_single_no_face_event_does_not_immediately_escalate(self):
        events = _events(event_type="no_face", count=1, start=NOW)
        result = tier_from_events(events, now=NOW)
        self.assertIn(result.tier, (EscalationTier.NORMAL, EscalationTier.WARNING))

    def test_repeated_no_face_escalates(self):
        events = _events(event_type="no_face", count=3, start=NOW)
        result = tier_from_events(events, now=NOW)
        self.assertIn(result.tier, (EscalationTier.SUSPICIOUS, EscalationTier.CRITICAL))

    def test_multiple_combined_signal_types_reach_critical(self):
        events = [
            EventRecord(event_type="no_face", timestamp=NOW),
            EventRecord(event_type="multiple_faces", timestamp=NOW),
            EventRecord(event_type="looking_away", timestamp=NOW),
        ]
        result = tier_from_events(events, now=NOW)
        self.assertEqual(result.tier, EscalationTier.CRITICAL)
        self.assertTrue(result.recommend_intervention)


def make_user(role, username):
    user = User.objects.create_user(
        username=username, email=f"{username}@test.local", password="TestPass123!", role=role,
    )
    apply_role_defaults(user)
    return user


class ComputeEscalationForSessionTests(TestCase):
    """DB-backed integration test: queries real BehaviorLog rows for a session."""

    def setUp(self):
        self.student = make_user(User.Role.STUDENT, "escalation_student")
        self.faculty = make_user(User.Role.FACULTY, "escalation_faculty")
        department = Department.objects.create(name="Escalation Dept", abbreviation="ESC")
        self.exam = Exam.objects.create(
            title="Escalation exam", department=department, created_by=self.faculty,
            status=Exam.Status.ACTIVE,
        )
        self.session = ExamSession.objects.create(
            exam=self.exam, user=self.student, status=ExamSession.Status.IN_PROGRESS,
        )

    def test_no_logs_is_normal(self):
        result = compute_escalation_for_session(self.session)
        self.assertEqual(result.tier, EscalationTier.NORMAL)

    def test_persisted_identity_mismatch_is_critical(self):
        BehaviorLog.objects.create(
            session=self.session,
            event_type=BehaviorLog.EventType.IDENTITY_MISMATCH,
            score=0.1,
            confidence=0.9,
        )
        result = compute_escalation_for_session(self.session)
        self.assertEqual(result.tier, EscalationTier.CRITICAL)
        self.assertTrue(result.recommend_intervention)
