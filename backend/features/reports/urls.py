from django.urls import path

from features.reports.views import (
    analytics_timeseries,
    export_sessions_csv,
    export_sessions_pdf,
    list_session_reports,
    report_summary,
    session_report,
)


urlpatterns = [
    path("summary/", report_summary, name="report-summary"),
    path("sessions/", list_session_reports, name="report-sessions-list"),
    path("sessions/<uuid:session_id>/", session_report, name="report-session-detail"),
    path("export/csv/", export_sessions_csv, name="report-export-csv"),
    path("export/pdf/", export_sessions_pdf, name="report-export-pdf"),
    path("timeseries/", analytics_timeseries, name="report-timeseries"),
]
