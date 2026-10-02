import { formatApiError } from "@/core/config/api";

/** One problem with one imported row, as reported by the backend. */
export interface ImportIssue {
  row: number;
  /** Which part of the row is wrong: question_text, options, correct_answer, ... or "row". */
  field: string;
  message: string;
}

export interface ImportProblems {
  issues: ImportIssue[];
  /** Problems not tied to a row (empty file, missing headings, permissions...). */
  general: string[];
}

const ROW_LINE = /^Row \d+:/;

/**
 * Pull row-level issues out of a failed import/dry-run response.
 *
 * The API wraps errors as `{ success, error: { details: { errors, issues } } }`;
 * older handlers return the details object directly, so both are accepted.
 */
export function extractImportProblems(err: unknown): ImportProblems {
  const payload = (err as { payload?: unknown } | null)?.payload as
    | { error?: { details?: unknown }; errors?: unknown; issues?: unknown }
    | undefined;
  const details = (payload?.error?.details ?? payload) as
    | { errors?: unknown; issues?: unknown }
    | undefined;

  const issues: ImportIssue[] = Array.isArray(details?.issues)
    ? details.issues.map((raw: { row?: unknown; field?: unknown; message?: unknown }) => ({
        row: Number(raw.row),
        field: String(raw.field ?? "row"),
        message: String(raw.message ?? ""),
      }))
    : [];
  const general = Array.isArray(details?.errors)
    ? details.errors.map(String).filter((line) => !ROW_LINE.test(line))
    : [];

  if (!issues.length && !general.length) {
    general.push(formatApiError(err, "The import could not be checked. Please try again."));
  }
  return { issues, general };
}

/** Group issues by sheet row for the preview table. */
export function issuesByRow(issues: ImportIssue[]): Map<number, ImportIssue[]> {
  const map = new Map<number, ImportIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.row) ?? [];
    list.push(issue);
    map.set(issue.row, list);
  }
  return map;
}
