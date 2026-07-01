"""Application-wide constants and domain enum mirrors."""

from __future__ import annotations

DEFAULT_PAGE_SIZE = 50
MAX_REPORT_EXPORT_ROWS = 1000


class UserRole:
    ADMIN = "ADMIN"
    EXAMINEE = "EXAMINEE"


class ExamStatus:
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class SessionStatus:
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    TERMINATED = "terminated"
    EXPIRED = "expired"


class BehaviorEventType:
    NO_FACE = "no_face"
    MULTIPLE_FACES = "multiple_faces"
    LOOKING_AWAY = "looking_away"
    BAD_POSTURE = "bad_posture"
    LEAVING_SEAT = "leaving_seat"
    IDENTITY_MISMATCH = "identity_mismatch"
    SUSPICIOUS_PATTERN = "suspicious_pattern"


class AlertSeverity:
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
