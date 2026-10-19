import type { SessionReportRow } from "@/core/config/api";

/** One ongoing examination and the candidates currently sitting it. */
export interface ExamGroup {
  examId: number;
  title: string;
  department: string | null;
  sessions: SessionReportRow[];
  /** Candidates actively sitting the exam. */
  live: number;
  /** Candidates a proctor has paused. */
  paused: number;
  /** Candidates with at least one unresolved alert. */
  flagged: number;
  /** Unresolved alerts across all candidates. */
  alerts: number;
  /** Mean of the candidates' running EBI averages, or null when none has a score yet. */
  avgEbi: number | null;
  /** When the earliest candidate started, ISO string. */
  startedAt: string | null;
}

/**
 * Group live sessions under their exam. Exams come back in title order (then
 * id), not by alert count, so cards don't reshuffle under the cursor on every
 * 5-second refetch.
 */
export function groupSessionsByExam(sessions: SessionReportRow[]): ExamGroup[] {
  const byExam = new Map<number, SessionReportRow[]>();
  for (const s of sessions) {
    const list = byExam.get(s.exam_id);
    if (list) list.push(s);
    else byExam.set(s.exam_id, [s]);
  }

  const groups: ExamGroup[] = [];
  for (const [examId, list] of byExam) {
    const paused = list.filter((s) => s.status === "paused").length;
    const scores = list
      .map((s) => s.ebi_average)
      .filter((v): v is number => typeof v === "number");
    const starts = list.map((s) => s.started_at).filter(Boolean);
    groups.push({
      examId,
      title: list[0].exam_title,
      department: list[0].department_abbreviation ?? list[0].department_name ?? null,
      sessions: list,
      live: list.length - paused,
      paused,
      flagged: list.filter((s) => s.unresolved_alert_count > 0).length,
      alerts: list.reduce((sum, s) => sum + s.unresolved_alert_count, 0),
      avgEbi: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      startedAt: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    });
  }
  return groups.sort((a, b) => a.title.localeCompare(b.title) || a.examId - b.examId);
}

/** The `?exam=` search param as an exam id, or null when absent or not a number. */
export function parseExamParam(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
