import re


def is_valid_email(email: str) -> bool:
    if not email:
        return False
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()))


def is_valid_username(username: str) -> bool:
    if not username:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9_.-]{3,64}", username))


def is_strong_password(password: str, min_length: int = 8) -> bool:
    """Project-level lightweight password strength check."""
    if not password or len(password) < min_length:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    return has_upper and has_lower and has_digit
