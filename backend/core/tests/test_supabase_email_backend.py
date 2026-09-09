"""Tests for the Supabase-relayed email backend."""

from __future__ import annotations

from unittest.mock import Mock, patch

import requests
from django.core.mail import EmailMessage
from django.test import SimpleTestCase, override_settings

from core.utils.supabase_email_backend import SupabaseEmailBackend


@override_settings(
    SUPABASE_URL="https://example.supabase.co",
    SUPABASE_OTP_FUNCTION_SECRET="test-secret",
)
class SupabaseEmailBackendTests(SimpleTestCase):
    def _message(self):
        return EmailMessage(
            subject="Verify your email",
            body="Your code is 123456.",
            from_email="no-reply@knowingeye.local",
            to=["user@example.com"],
        )

    @patch("core.utils.supabase_email_backend.requests.post")
    def test_send_messages_posts_to_edge_function(self, mock_post):
        mock_post.return_value = Mock(status_code=200)
        mock_post.return_value.raise_for_status = Mock()

        backend = SupabaseEmailBackend()
        sent = backend.send_messages([self._message()])

        self.assertEqual(sent, 1)
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://example.supabase.co/functions/v1/send-email")
        self.assertEqual(kwargs["headers"]["x-otp-secret"], "test-secret")
        self.assertEqual(kwargs["json"]["to"], ["user@example.com"])
        self.assertEqual(kwargs["json"]["subject"], "Verify your email")

    @patch("core.utils.supabase_email_backend.requests.post")
    def test_send_messages_no_messages_returns_zero(self, mock_post):
        backend = SupabaseEmailBackend()
        self.assertEqual(backend.send_messages([]), 0)
        mock_post.assert_not_called()

    @patch("core.utils.supabase_email_backend.requests.post")
    def test_from_omitted_when_supabase_from_email_unset(self, mock_post):
        """message.from_email is almost always Django's unverified placeholder -
        it must never be forwarded unless SUPABASE_FROM_EMAIL opts in, or the
        edge function's own verified default never gets a chance to apply."""
        mock_post.return_value = Mock(status_code=200)
        mock_post.return_value.raise_for_status = Mock()

        backend = SupabaseEmailBackend()
        backend.send_messages([self._message()])

        _, kwargs = mock_post.call_args
        self.assertNotIn("from", kwargs["json"])

    @patch("core.utils.supabase_email_backend.requests.post")
    @override_settings(SUPABASE_FROM_EMAIL="verified@example.com")
    def test_from_included_when_supabase_from_email_set(self, mock_post):
        mock_post.return_value = Mock(status_code=200)
        mock_post.return_value.raise_for_status = Mock()

        backend = SupabaseEmailBackend()
        backend.send_messages([self._message()])

        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["json"]["from"], "verified@example.com")

    @patch("core.utils.supabase_email_backend.requests.post")
    def test_send_messages_raises_on_failure_unless_fail_silently(self, mock_post):
        mock_post.side_effect = requests.ConnectionError("boom")

        backend = SupabaseEmailBackend(fail_silently=True)
        self.assertEqual(backend.send_messages([self._message()]), 0)

        backend_strict = SupabaseEmailBackend(fail_silently=False)
        with self.assertRaises(requests.RequestException):
            backend_strict.send_messages([self._message()])
