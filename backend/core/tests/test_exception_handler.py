"""Tests for custom API exception handling."""

from django.test import RequestFactory, SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from core.exceptions.handlers import custom_exception_handler


class _DummyView(APIView):
    pass


class ExceptionHandlerTests(SimpleTestCase):
    def test_validation_error_envelope(self):
        exc = ValidationError({"field": ["bad"]})
        request = RequestFactory().get("/")
        response = custom_exception_handler(
            exc, {"request": request, "view": _DummyView()}
        )
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("field", response.data["error"]["details"])
