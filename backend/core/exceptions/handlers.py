from rest_framework.views import exception_handler


def handle_api_exception(exc, context):
    response = exception_handler(exc, context)
    return response
