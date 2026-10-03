from rest_framework.negotiation import BaseContentNegotiation


class IgnoreClientContentNegotiation(BaseContentNegotiation):
    """Serve file downloads regardless of the request's ``Accept`` header.

    These views return a raw ``HttpResponse`` (PDF/CSV), so DRF renderers are
    never used for the body. The frontend downloads them with
    ``Accept: application/pdf`` / ``text/csv``, which the default JSON
    renderers can't satisfy, so DRF would answer 406 before the view runs.
    Error responses (404/409) are still rendered as JSON.
    """

    def select_parser(self, request, parsers):
        return parsers[0]

    def select_renderer(self, request, renderers, format_suffix=None):
        return (renderers[0], renderers[0].media_type)
