from django.urls import path

from features.reports.views import (
    analytics_timeseries,
    export_integrity_csv,
    export_integrity_pdf,
    export_sessions_csv,
    export_sessions_pdf,
    integrity_report_view,
    integrity_sessions_view,
    list_session_reports,
    report_summary,
    school_year_detail,
    school_year_report,
    session_report,
    session_report_pdf,
)


urlpatterns = [
    path("summary/", report_summary, name="report-summary"),
    path("sessions/", list_session_reports, name="report-sessions-list"),
    path("sessions/<uuid:session_id>/", session_report, name="report-session-detail"),
    path(
        "sessions/<uuid:session_id>/pdf/",
        session_report_pdf,
        name="report-session-pdf",
    ),
    path("export/csv/", export_sessions_csv, name="report-export-csv"),
    path("export/pdf/", export_sessions_pdf, name="report-export-pdf"),
    path("timeseries/", analytics_timeseries, name="report-timeseries"),
    path("integrity/", integrity_report_view, name="report-integrity"),
    path("integrity/sessions/", integrity_sessions_view, name="report-integrity-sessions"),
    path("integrity/export/csv/", export_integrity_csv, name="report-integrity-csv"),
    path("integrity/export/pdf/", export_integrity_pdf, name="report-integrity-pdf"),
    path("school-years/", school_year_report, name="report-school-years"),
    path("school-years/<int:start_year>/", school_year_detail, name="report-school-year-detail"),
]
