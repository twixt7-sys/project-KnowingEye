"""Django email backend that relays outgoing mail through a Supabase Edge Function.

Plugs into ``EMAIL_BACKEND`` so callers of ``django.core.mail.send_mail``
(``features/authentication/otp_service.py`` in particular) don't change at
all - only where the email actually goes changes. The Edge Function
(``supabase/functions/send-email``) does the real delivery via Resend, using
a server-side API key that never touches this codebase; this backend only
needs the project URL and a shared secret to authenticate the call.

Selected automatically once ``SUPABASE_URL`` is set (see
``core/config/settings/development.py`` and ``production.py``); otherwise
the console/SMTP backends are used unchanged.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage

logger = logging.getLogger(__name__)


class SupabaseEmailBackend(BaseEmailBackend):
    """Sends each ``EmailMessage`` via the Supabase ``send-email`` Edge Function."""

    def send_messages(self, email_messages: list[EmailMessage]) -> int:
        if not email_messages:
            return 0

        base_url = settings.SUPABASE_URL.rstrip("/")
        url = f"{base_url}/functions/v1/send-email"
        headers = {
            "Content-Type": "application/json",
            "x-otp-secret": settings.SUPABASE_OTP_FUNCTION_SECRET,
        }

        sent = 0
        for message in email_messages:
            payload = {
                "to": message.to,
                "subject": message.subject,
                "text": message.body,
            }
            # Only forward an explicit sender if one has been configured for
            # this relay (SUPABASE_FROM_EMAIL). message.from_email is almost
            # always Django's DEFAULT_FROM_EMAIL placeholder, which is not a
            # Resend-verified address - sending it as "from" makes Resend
            # reject every message. Omitting the key lets the edge function
            # fall back to its own verified default.
            if settings.SUPABASE_FROM_EMAIL:
                payload["from"] = settings.SUPABASE_FROM_EMAIL
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=10)
                response.raise_for_status()
            except requests.RequestException:
                logger.exception(
                    "Failed to send email via Supabase edge function to %s", message.to
                )
                if not self.fail_silently:
                    raise
                continue
            sent += 1
        return sent
