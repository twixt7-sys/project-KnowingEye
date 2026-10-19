import { useQuery } from "@tanstack/react-query";

import { formatApiError } from "@/core/config/api";
import { examBuilderQueries } from "@/features/exams/queries/queries";

interface CompletedExamineesPanelProps {
  examId: number;
  /** Whether "exclude completed examinees" is on for the exam (the saved setting). */
  enforced: boolean;
}

/**
 * Per-exam exclusion list: everyone who already finished this exam. When the
 * exam setting is on they cannot start it again and are skipped by the roster.
 */
export function CompletedExamineesPanel({ examId, enforced }: CompletedExamineesPanelProps) {
  const query = useQuery(examBuilderQueries.completedExaminees(examId));
  const rows = query.data?.results ?? [];

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          Already completed{query.data ? ` (${query.data.count})` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">
          Examinees with a finished attempt on this exam.{" "}
          {enforced
            ? "They are excluded: they cannot start it again and are skipped when adding candidates."
            : 'Turn on "Exclude examinees who already completed this exam" in Settings to stop them retaking it and keep them off the roster.'}
        </p>
      </div>
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
          enforced ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        }`}
        data-testid="exclusion-status"
      >
        {enforced ? "Exclusion enforced" : "Exclusion off"}
      </span>

      {query.error ? (
        <p className="text-sm text-destructive">{formatApiError(query.error)}</p>
      ) : (
        <ul className="divide-y border rounded-lg" aria-label="Examinees who already completed this exam">
          {query.isLoading ? (
            <li className="p-4 text-sm text-muted-foreground">Loading…</li>
          ) : rows.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">
              Nobody has completed this exam yet.
            </li>
          ) : (
            rows.map((r) => (
              <li key={r.user_id} className="p-3 text-sm flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {r.attempts_completed} attempt{r.attempts_completed === 1 ? "" : "s"}
                  </span>
                  {r.last_score != null && (
                    <span>
                      {r.last_score.toFixed(0)}%
                      {r.passed != null && (r.passed ? " passed" : " not passed")}
                    </span>
                  )}
                  {r.last_completed_at && (
                    <span>{new Date(r.last_completed_at).toLocaleDateString()}</span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {r.on_roster ? "On roster" : "Not on roster"}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
