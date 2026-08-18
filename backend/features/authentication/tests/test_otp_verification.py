"""Tests for OTP-based email verification.

Directive Area 01 ("Registration & verification"): "implement OTP
verification" and "add email verification".
"""

from __future__ import annotations

import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from features.authentication.models import EmailVerification
from features.authentication.otp_service import issue_otp, verify_otp

User = get_user_model()


def _code_from_outbox() -> str:
    body = mail.outbox[-1].body
    match = re.search(r"\b(\d{6})\b", body)
    assert match, f"No 6-digit code found in email body: {body!r}"
    return match.group(1)


class OtpServiceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="otp_user",
            email="otp_user@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )

    def test_issue_otp_sends_email_and_creates_row(self):
        issue_otp(self.user)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.user.email, mail.outbox[0].to)
        self.assertEqual(
            EmailVerification.objects.filter(user=self.user, consumed_at__isnull=True).count(), 1
        )

    def test_verify_otp_with_correct_code_marks_email_verified(self):
        issue_otp(self.user)
        code = _code_from_outbox()
        verify_otp(self.user, code)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_verify_otp_with_wrong_code_raises_and_increments_attempts(self):
        issue_otp(self.user)
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            verify_otp(self.user, "000000")
        entry = EmailVerification.objects.get(user=self.user, consumed_at__isnull=True)
        self.assertEqual(entry.attempts, 1)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_verify_otp_locks_out_after_max_attempts(self):
        issue_otp(self.user)
        from rest_framework.exceptions import ValidationError

        for _ in range(5):
            with self.assertRaises(ValidationError):
                verify_otp(self.user, "000000")

        code = _code_from_outbox()
        with self.assertRaises(ValidationError):
            verify_otp(self.user, code)

    def test_verify_otp_rejects_expired_code(self):
        issue_otp(self.user)
        entry = EmailVerification.objects.get(user=self.user, consumed_at__isnull=True)
        entry.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        entry.save(update_fields=["expires_at"])

        code = _code_from_outbox()
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            verify_otp(self.user, code)

    def test_reissue_invalidates_prior_code(self):
        issue_otp(self.user)
        old_code = _code_from_outbox()

        with override_settings(OTP_RESEND_COOLDOWN_SECONDS=0):
            issue_otp(self.user)
        new_code = _code_from_outbox()
        self.assertNotEqual(old_code, new_code)

        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            verify_otp(self.user, old_code)
        verify_otp(self.user, new_code)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_resend_within_cooldown_is_rejected(self):
        issue_otp(self.user)
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            issue_otp(self.user)


class OtpEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="otp_api_user",
            email="otp_api_user@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        self.client.force_authenticate(user=self.user)

    def test_registration_sends_otp_email(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "otp_register",
                "email": "otp_register@test.local",
                "password": "TestPass123!",
                "password2": "TestPass123!",
                "first_name": "Otp",
                "last_name": "Register",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        user = User.objects.get(username="otp_register")
        self.assertFalse(user.email_verified)

    def test_request_then_confirm_verification(self):
        response = self.client.post("/api/auth/profile/verify-email/request/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        code = _code_from_outbox()

        response = self.client.post(
            "/api/auth/profile/verify-email/confirm/", {"code": code}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["user"]["email_verified"])

    def test_confirm_with_wrong_code_returns_400(self):
        self.client.post("/api/auth/profile/verify-email/request/")
        response = self.client.post(
            "/api/auth/profile/verify-email/confirm/", {"code": "999999"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_request_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/auth/profile/verify-email/request/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
