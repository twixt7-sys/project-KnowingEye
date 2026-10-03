import type { Exam, SessionReportRow } from "@/core/config/api";

export type DashboardExam = {
  id: string;
  title: string;
  course: string;
  date: string;
  duration: string;
  type: "upcoming" | "completed";
  monitoringEnabled: boolean;
  author?: string;
  score?: number;
  passed?: boolean | null;
  sessionId?: string;
  attemptsLabel?: string;
  extraTime?: string | null;
};

function mapExamToCard(exam: Exam, type: "upcoming" | "completed"): DashboardExam {
  return {
    id: String(exam.id),
    title: exam.title,
    course: exam.exam_code ?? `Exam #${exam.id}`,
    date: exam.available_from
      ? new Date(exam.available_from).toLocaleDateString()
      : new Date(exam.created_at).toLocaleDateString(),
    duration: `${exam.duration_minutes} mins`,
    type,
    monitoringEnabled: exam.monitoring_enabled !== false,
    author: exam.created_by_name || undefined,
  };
}

export function toAvailableCard(exam: Exam): DashboardExam {
  return {
    ...mapExamToCard(exam, "upcoming"),
    attemptsLabel:
      exam.attempts_remaining == null
        ? "Unlimited attempts"
        : `${exam.attempts_remaining} attempt(s) left`,
    extraTime: exam.extra_time_minutes ? `+${exam.extra_time_minutes} min accommodation` : null,
  };
}

export function toCompletedCard(session: SessionReportRow): DashboardExam {
  const submitted = session.submitted_at
    ? new Date(session.submitted_at).toLocaleDateString()
    : new Date(session.started_at).toLocaleDateString();
  return {
    id: String(session.exam_id),
    sessionId: session.id,
    title: session.exam_title,
    course: `Attempt · ${submitted}`,
    date: submitted,
    duration: "",
    type: "completed",
    monitoringEnabled: false,
    score: session.percentage_score ?? undefined,
    passed: session.passed,
  };
}

/** Exams the examinee can still start: published, inside their window, attempts left. */
export function isTakeable(exam: Exam): boolean {
  return exam.is_open !== false && (exam.attempts_remaining ?? 1) > 0;
}

// --- Available exams: search / filter / sort / paginate (all client-side) -----------------

export type ProctoringFilter = "all" | "proctored" | "open";

export const AVAILABLE_SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "available_until", label: "Closing soonest" },
  { value: "title", label: "Title (A–Z)" },
  { value: "duration_minutes", label: "Shortest first" },
];

export const DEFAULT_AVAILABLE_SORT = "-created_at";

export function filterAvailableExams(
  exams: Exam[],
  { search, proctoring }: { search: string; proctoring: ProctoringFilter },
): Exam[] {
  const needle = search.trim().toLowerCase();
  return exams.filter((exam) => {
    const proctored = exam.monitoring_enabled !== false;
    if (proctoring === "proctored" && !proctored) return false;
    if (proctoring === "open" && proctored) return false;
    if (!needle) return true;
    return [exam.title, exam.exam_code, exam.created_by_name].some((field) =>
      field?.toLowerCase().includes(needle),
    );
  });
}

type SortKey = "created_at" | "available_until" | "title" | "duration_minutes";

function sortKeyOf(exam: Exam, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return exam.title;
    case "duration_minutes":
      return exam.duration_minutes;
    case "available_until": {
      const ms = exam.available_until ? Date.parse(exam.available_until) : Number.NaN;
      return Number.isNaN(ms) ? null : ms;
    }
    default: {
      const ms = Date.parse(exam.created_at);
      return Number.isNaN(ms) ? null : ms;
    }
  }
}

/** `-` prefix sorts descending. Exams missing the sort value (e.g. no deadline) always go last. */
export function sortAvailableExams(exams: Exam[], sort: string): Exam[] {
  const dir = sort.startsWith("-") ? -1 : 1;
  const key = (sort.startsWith("-") ? sort.slice(1) : sort) as SortKey;
  return [...exams].sort((a, b) => {
    const av = sortKeyOf(a, key);
    const bv = sortKeyOf(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const diff =
      typeof av === "string" && typeof bv === "string"
        ? av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
        : Number(av) - Number(bv);
    return diff * dir;
  });
}

/** Slice one page, clamping an out-of-range page (e.g. after a filter shrinks the list). */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { page: safePage, items: items.slice(start, start + pageSize) };
}
