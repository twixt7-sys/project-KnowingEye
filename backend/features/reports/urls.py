from django.urls import path

from features.reports.views import list_session_reports, report_summary, session_report

urlpatterns = [
    path("summary/", report_summary, name="report-summary"),
    path("sessions/", list_session_reports, name="report-sessions-list"),
    path("sessions/<uuid:session_id>/", session_report, name="report-session-detail"),
]
