"""Tests for shared validation utilities."""

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from shared.utils.validators import require_non_blank, validate_percentage, validate_phone


class ValidatorTests(SimpleTestCase):
    def test_require_non_blank(self):
        self.assertEqual(require_non_blank(" hello ", "name"), "hello")
        with self.assertRaises(ValidationError):
            require_non_blank("   ", "name")

    def test_validate_phone(self):
        self.assertEqual(validate_phone("+1 555-0100"), "+1 555-0100")
        with self.assertRaises(ValidationError):
            validate_phone("not-a-phone")

    def test_validate_percentage(self):
        self.assertEqual(validate_percentage(50), 50.0)
        with self.assertRaises(ValidationError):
            validate_percentage(101)
