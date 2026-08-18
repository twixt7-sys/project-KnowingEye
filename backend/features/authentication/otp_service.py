"""OTP issuance and verification for email confirmation.

Directive Area 01 ("Registration & verification"): "implement OTP
verification", "add email verification", and "decide exactly where OTP
sits in the registration flow, and make the flow visually clear". The flow
this backs: register (account created, ``email_verified=False``) -> OTP
emailed automatically -> user submits the 6-digit code from the profile/
verify-email screen -> ``email_verified=True``. A user may sign in before
verifying (registration already worked without this and shouldn't
regress), but the frontend uses ``email_verified`` to keep a "verify your
email" prompt visible until it's done.
"""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import EmailVerification


def _generate_code() -> str:
    length = settings.OTP_CODE_LENGTH
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _active_code_qs(user, purpose: str):
    return EmailVerification.objects.filter(
        user=user, purpose=purpose, consumed_at__isnull=True
    )


def issue_otp(user, purpose: str = EmailVerification.Purpose.EMAIL_VERIFY) -> None:
    """Generate a fresh OTP, invalidate any prior pending one, and email it.

    Raises:
        ValidationError: If a code was already sent within the resend
            cooldown window.
    """
    now = timezone.now()
    cooldown = timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)
    latest = _active_code_qs(user, purpose).order_by("-created_at").first()
    if latest and now - latest.created_at < cooldown:
        wait_seconds = int((cooldown - (now - latest.created_at)).total_seconds())
        raise ValidationError(
            {"detail": f"A code was already sent. Try again in {max(wait_seconds, 1)}s."}
        )

    # Invalidate any still-pending code so only the newest one can be used.
    _active_code_qs(user, purpose).update(consumed_at=now)

    code = _generate_code()
    EmailVerification.objects.create(
        user=user,
        purpose=purpose,
        code_hash=make_password(code),
        expires_at=now + timedelta(minutes=settings.OTP_TTL_MINUTES),
    )

    send_mail(
        subject="Verify your email",
        message=(
            f"Your Knowing Eye verification code is {code}.\n\n"
            f"This code expires in {settings.OTP_TTL_MINUTES} minutes. "
            "If you didn't request this, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def verify_otp(user, code: str, purpose: str = EmailVerification.Purpose.EMAIL_VERIFY) -> None:
    """Confirm a submitted OTP and mark the user's email verified.

    Raises:
        ValidationError: If there is no pending code, it expired, too many
            incorrect attempts were made, or the code doesn't match.
    """
    entry = _active_code_qs(user, purpose).order_by("-created_at").first()
    if entry is None:
        raise ValidationError({"code": "No pending verification code. Request a new one."})

    if timezone.now() > entry.expires_at:
        raise ValidationError({"code": "This code has expired. Request a new one."})

    if entry.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise ValidationError(
            {"code": "Too many incorrect attempts. Request a new code."}
        )

    if not check_password(code, entry.code_hash):
        entry.attempts += 1
        entry.save(update_fields=["attempts"])
        raise ValidationError({"code": "Incorrect code."})

    entry.consumed_at = timezone.now()
    entry.save(update_fields=["consumed_at"])

    if purpose == EmailVerification.Purpose.EMAIL_VERIFY:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
