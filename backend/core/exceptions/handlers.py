"""Global API exception handling with structured logging."""

from __future__ import annotations

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("knowing_eye.api.errors")


def _error_code(exc: Exception, status_code: int) -> str:
    if isinstance(exc, ValidationError):
        return "validation_error"
    if isinstance(exc, Http404):
        return "not_found"
    if isinstance(exc, DjangoPermissionDenied):
        return "permission_denied"
    if isinstance(exc, APIException):
        return getattr(exc, "default_code", "api_error")
    if status_code >= 500:
        return "internal_error"
    return "client_error"


def custom_exception_handler(exc, context):
    """Log API failures and return a consistent JSON envelope."""
    response = exception_handler(exc, context)

    view = context.get("view")
    view_name = view.__class__.__name__ if view else "unknown"

    if response is not None:
        code = _error_code(exc, response.status_code)
        logger.warning(
            "API error [%s] %s.%s status=%s detail=%s",
            code,
            view_name,
            getattr(context.get("request"), "method", "?"),
            response.status_code,
            response.data,
        )
        payload = {
            "success": False,
            "error": {
                "code": code,
                "status": response.status_code,
                "details": response.data,
            },
        }
        response.data = payload
        return response

    logger.exception(
        "Unhandled exception in %s",
        view_name,
        exc_info=exc,
    )
    return Response(
        {
            "success": False,
            "error": {
                "code": "internal_error",
                "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "An unexpected error occurred.",
            },
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


handle_api_exception = custom_exception_handler
