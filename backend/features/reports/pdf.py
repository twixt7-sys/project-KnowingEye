"""Printable reports: the per-session examinee PDF and the exam-integrity PDF."""

from __future__ import annotations

from io import BytesIO
from xml.sax.saxutils import escape

from django.db.models import Avg, Count
from django.utils import timezone

from features.behavior.models import Alert, BehaviorLog


def _fmt_dt(value) -> str:
    if not value:
        return "-"
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M")


def _fmt_pct(value) -> str:
    return f"{float(value):.1f}%" if value is not None else "-"


def _fmt_duration(session) -> str:
    start = session.exam_started_at or session.started_at
    end = session.submitted_at
    if not start or not end or end < start:
        return "-"
    total = int((end - start).total_seconds())
    hours, rem = divmod(total, 3600)
    minutes, seconds = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes:02d}m {seconds:02d}s"
    return f"{minutes}m {seconds:02d}s"


def _outcome(session) -> str:
    if session.passed is None:
        return "Pending review"
    return "Passed" if session.passed else "Not passed"


def build_session_report_pdf(
    session,
    *,
    show_correct_answers: bool,
    hide_scores: bool = False,
    department_analytics=None,
) -> bytes:
    """Render a single exam attempt as a printable A4/Letter-safe PDF."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9, leading=12)
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=10, textColor=colors.grey)
    cell = ParagraphStyle("cell", parent=body, fontSize=8, leading=10)

    def p(text, style=cell):
        return Paragraph(escape(str(text)), style)

    grid = TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8ccd4")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef1f6")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]
    )
    kv_style = TableStyle(
        [
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#4b5563")),
            ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#4b5563")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
    )

    exam = session.exam
    user = session.user
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username
    story = []

    story.append(Paragraph("Knowing Eye - Examinee Exam Report", h1))
    story.append(Paragraph(escape(exam.title or "Untitled exam"), styles["Heading3"]))
    story.append(Spacer(1, 6))

    department = exam.department.name if exam.department_id else "-"
    info = [
        ["Examinee", p(full_name, body), "Username", p(user.username, body)],
        ["Department", p(department, body), "Session ID", p(str(session.id), body)],
        ["Started", _fmt_dt(session.exam_started_at or session.started_at), "Submitted", _fmt_dt(session.submitted_at)],
        ["Time taken", _fmt_duration(session), "Status", session.get_status_display()],
    ]
    t = Table(info, colWidths=[0.95 * inch, 2.2 * inch, 0.85 * inch, 2.9 * inch])
    t.setStyle(kv_style)
    story.append(t)

    # --- Result -----------------------------------------------------------
    story.append(Paragraph("Result", h2))
    result_rows = [
        ["Score", "Points", "Passing score", "Outcome"],
        [
            "-" if hide_scores else _fmt_pct(session.percentage_score),
            "-"
            if hide_scores or session.total_score is None
            else str(session.total_score),
            f"{exam.passing_score}%" if exam.passing_score is not None else "-",
            "Pending review" if hide_scores else _outcome(session),
        ],
    ]
    t = Table(result_rows, colWidths=[1.725 * inch] * 4)
    t.setStyle(grid)
    story.append(t)

    if hide_scores:
        story.append(Spacer(1, 4))
        story.append(
            Paragraph(
                "Your score will appear once manual grading of open-ended answers is complete.",
                small,
            )
        )

    if department_analytics and not hide_scores:
        story.append(Paragraph("Comparison", h2))
        da = department_analytics
        cmp_rows = [
            ["Metric", "Value"],
            ["Exam average score", _fmt_pct(da.get("exam_average_score"))],
            ["Exam pass rate", _fmt_pct(da.get("exam_pass_rate"))],
            [f"{da.get('department_abbreviation') or 'Department'} average score", _fmt_pct(da.get("department_average_score"))],
            ["Department pass rate", _fmt_pct(da.get("department_pass_rate"))],
            [
                "Percentile in department",
                f"{da['percentile_in_department']:.0f}th"
                if da.get("percentile_in_department") is not None
                else "-",
            ],
        ]
        t = Table(cmp_rows, colWidths=[3.45 * inch, 3.45 * inch])
        t.setStyle(grid)
        story.append(t)

    # --- Answers ----------------------------------------------------------
    responses = list(session.responses.select_related("question"))
    order = {qid: i for i, qid in enumerate(session.question_order or [])}
    responses.sort(key=lambda r: (order.get(r.question_id, 10**6), r.question_id))

    story.append(Paragraph("Answers", h2))
    if responses:
        header = ["#", "Question", "Your answer"]
        if show_correct_answers:
            header.append("Correct answer")
        header += ["Result", "Points"]
        rows = [header]
        for i, r in enumerate(responses, start=1):
            q = r.question
            if hide_scores or r.is_correct is None:
                verdict = "Pending"
            else:
                verdict = "Correct" if r.is_correct else "Incorrect"
            awarded = (
                r.points_awarded
                if r.points_awarded is not None and not hide_scores
                else "-"
            )
            row = [
                str(i),
                p(q.question_text),
                p(r.answer_text or "(no answer)"),
            ]
            if show_correct_answers:
                row.append(p(q.correct_answer or "-"))
            row += [verdict, f"{awarded} / {q.points}"]
            rows.append(row)
        if show_correct_answers:
            widths = [0.3, 2.3, 1.6, 1.4, 0.65, 0.65]
        else:
            widths = [0.3, 3.0, 2.3, 0.65, 0.65]
        t = Table(rows, colWidths=[w * inch for w in widths], repeatRows=1)
        t.setStyle(grid)
        story.append(t)
        if not show_correct_answers:
            story.append(Spacer(1, 4))
            story.append(Paragraph("Correct answers are hidden until your instructor releases them.", small))
    else:
        story.append(Paragraph("No answers were recorded for this attempt.", body))

    # --- Proctoring -------------------------------------------------------
    story.append(Paragraph("Proctoring summary", h2))
    ebi = session.ebi_average
    ebi_rows = [
        ["Exam Behavior Index", "Face presence", "Face identity", "Upper body", "Gaze compliance"],
        [
            f"{ebi:.1f}" if ebi is not None else "-",
            *[
                f"{v:.1f}" if v is not None else "-"
                for v in (
                    session.ebi_face_presence_avg,
                    session.ebi_face_identity_avg,
                    session.ebi_upper_body_avg,
                    session.ebi_looking_away_avg,
                )
            ],
        ],
    ]
    t = Table(ebi_rows, colWidths=[1.38 * inch] * 5)
    t.setStyle(grid)
    story.append(t)

    behavior = list(
        BehaviorLog.objects.filter(session=session)
        .values("event_type")
        .annotate(count=Count("id"), avg_score=Avg("score"))
        .order_by("-count")
    )
    if behavior:
        story.append(Spacer(1, 8))
        rows = [["Behavior event", "Occurrences", "Average score"]]
        for b in behavior:
            rows.append(
                [
                    b["event_type"].replace("_", " ").capitalize(),
                    str(b["count"]),
                    f"{b['avg_score'] * 100:.0f}" if b["avg_score"] is not None else "-",
                ]
            )
        t = Table(rows, colWidths=[3.45 * inch, 1.725 * inch, 1.725 * inch], repeatRows=1)
        t.setStyle(grid)
        story.append(t)

    alerts = list(Alert.objects.filter(session=session).order_by("created_at"))
    story.append(Spacer(1, 8))
    if alerts:
        rows = [["Time", "Severity", "Alert"]]
        for a in alerts:
            rows.append(
                [
                    _fmt_dt(a.created_at),
                    a.severity.capitalize(),
                    p(a.message or a.alert_type.replace("_", " ")),
                ]
            )
        t = Table(rows, colWidths=[1.3 * inch, 0.9 * inch, 4.7 * inch], repeatRows=1)
        t.setStyle(grid)
        story.append(t)
    else:
        story.append(Paragraph("No proctoring alerts were raised during this session.", body))

    generated = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M %Z")

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.grey)
        canvas.drawString(doc.leftMargin, 0.45 * inch, f"Generated {generated} - Knowing Eye")
        canvas.drawRightString(
            letter[0] - doc.rightMargin, 0.45 * inch, f"Page {doc.page}"
        )
        canvas.restoreState()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.75 * inch,
        title=f"Exam report - {exam.title}",
        author="Knowing Eye",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def build_integrity_report_pdf(report: dict, rows: list[dict], *, truncated: bool, filters: dict) -> bytes:
    """Render the exam-integrity report: headline totals, per-exam table, flagged candidates."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from features.reports.school_year import school_year_label

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9, leading=12)
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=10, textColor=colors.grey)
    cell = ParagraphStyle("cell", parent=body, fontSize=8, leading=10)

    def p(text, style=cell):
        return Paragraph(escape(str(text)), style)

    grid = TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8ccd4")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef1f6")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]
    )

    totals = report["totals"]
    story = [Paragraph("Knowing Eye - Exam Integrity Report", h1)]

    scope = []
    if filters.get("school_year") is not None:
        scope.append(
            f"School year {school_year_label(filters['school_year'], report.get('school_year_start_month'))}"
        )
    if filters.get("exam_id"):
        scope.append(f"Exam #{filters['exam_id']}")
    if filters.get("department_id"):
        scope.append(f"Department #{filters['department_id']}")
    story.append(Paragraph(escape(", ".join(scope) or "All exams and school years"), body))
    story.append(
        Paragraph(
            "A session is flagged when monitoring raised at least one alert or a proctor "
            "terminated it. A candidate is flagged when any of their sessions is, and is "
            "counted once.",
            small,
        )
    )

    story.append(Paragraph("Overview", h2))
    overview = [
        ["Flagged candidates", "Flagged sessions", "Terminated", "Alerts", "Unresolved"],
        [
            f"{totals['flagged_candidates']} of {totals['candidates']}",
            f"{totals['flagged_sessions']} of {totals['sessions']}",
            str(totals["terminated_sessions"]),
            str(totals["alert_count"]),
            str(totals["unresolved_alerts"]),
        ],
    ]
    t = Table(overview, colWidths=[1.5 * inch, 1.4 * inch, 1.2 * inch, 1.4 * inch, 1.4 * inch])
    t.setStyle(grid)
    story.append(t)

    if totals["alerts_by_type"]:
        story.append(Paragraph("Alerts by type", h2))
        rows_ = [["Alert type", "Count"]] + [
            [p(k.replace("_", " ")), str(v)] for k, v in totals["alerts_by_type"].items()
        ]
        t = Table(rows_, colWidths=[4.5 * inch, 1.5 * inch], repeatRows=1)
        t.setStyle(grid)
        story.append(t)

    story.append(Paragraph("By exam", h2))
    if report["by_exam"]:
        exam_rows = [["Exam", "Candidates", "Flagged", "Terminated", "Alerts", "Unresolved"]]
        for e in report["by_exam"]:
            exam_rows.append(
                [
                    p(e["exam_title"]),
                    str(e["candidates"]),
                    f"{e['flagged_candidates']} ({e['candidate_flag_rate'] or 0:.0f}%)",
                    str(e["terminated_sessions"]),
                    str(e["alert_count"]),
                    str(e["unresolved_alerts"]),
                ]
            )
        t = Table(
            exam_rows,
            colWidths=[2.5 * inch, 0.9 * inch, 1.0 * inch, 0.9 * inch, 0.8 * inch, 0.8 * inch],
            repeatRows=1,
        )
        t.setStyle(grid)
        story.append(t)
    else:
        story.append(Paragraph("No sessions in scope.", body))

    story.append(Paragraph("Flagged candidates and alerts", h2))
    if not rows:
        story.append(Paragraph("No candidates were flagged.", body))
    for r in rows:
        who = r["full_name"] or r["username"]
        seat = f" - seat {r['seat_label']}" if r["seat_label"] else ""
        story.append(
            Paragraph(
                f"<b>{escape(who)}</b> ({escape(r['username'])}){escape(seat)} - "
                f"{escape(r['exam_title'])} - {escape(r['status'].replace('_', ' '))}, "
                f"{_fmt_dt(r['started_at'])}",
                body,
            )
        )
        if r["alerts"]:
            alert_rows = [["Time", "Type", "Severity", "Resolved", "Detail"]]
            for a in r["alerts"]:
                alert_rows.append(
                    [
                        _fmt_dt(a["created_at"]),
                        p(a["alert_type"].replace("_", " ")),
                        a["severity"],
                        "Yes" if a["resolved"] else "No",
                        p(a["message"]),
                    ]
                )
            t = Table(
                alert_rows,
                colWidths=[1.05 * inch, 1.1 * inch, 0.7 * inch, 0.7 * inch, 3.35 * inch],
                repeatRows=1,
            )
            t.setStyle(grid)
            story.append(t)
        else:
            story.append(Paragraph("Terminated by a proctor; no alerts recorded.", small))
        story.append(Spacer(1, 8))
    if truncated:
        story.append(
            Paragraph("The list was cut off at the export limit; narrow the filters to see the rest.", small)
        )

    generated = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M %Z")

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.grey)
        canvas.drawString(doc.leftMargin, 0.45 * inch, f"Generated {generated} - Knowing Eye")
        canvas.drawRightString(letter[0] - doc.rightMargin, 0.45 * inch, f"Page {doc.page}")
        canvas.restoreState()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.8 * inch,
        rightMargin=0.8 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.75 * inch,
        title="Exam integrity report",
        author="Knowing Eye",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
