import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ArrowLeft, ClipboardList, Loader2, Save } from "lucide-react";

import { formatApiError } from "@/core/config/api";
import {
  gradeExamResponse,
  recalculateExamSession,
  type PendingGradeRow,
} from "@/features/exams/api/grader-api";
import { examGraderQueries } from "@/features/exams/queries/grader-queries";
import { examGraderKeys } from "@/features/exams/queries/grader-keys";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export function ExamGraderPage() {
  const { examId } = useParams();
  const id = Number(examId);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, { points: string; comment: string }>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const queueQuery = useQuery(examGraderQueries.queue(id));
  const rows = queueQuery.data ?? [];

  const gradeMutation = useMutation({
    mutationFn: async (row: PendingGradeRow) => {
      const draft = drafts[row.id] ?? { points: String(row.points ?? 0), comment: "" };
      const points = Number(draft.points);
      await gradeExamResponse(row.id, {
        points_awarded: points,
        is_correct: points >= (row.points ?? 0),
        grader_comment: draft.comment,
        flagged_for_review: false,
      });
      await recalculateExamSession(row.session_id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: examGraderKeys.queue(id) });
    },
    onError: (e) => setActionError(formatApiError(e, "Failed to save grade")),
  });

  if (queueQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading grading queue…
      </div>
    );
  }

  const displayError =
    actionError ??
    (queueQuery.error ? formatApiError(queueQuery.error, "Failed to load grading queue") : null);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        to={`/examiner/exams/${examId}/edit`}
        className="mb-6 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back to exam builder
      </Link>

      <PageHeaderV2
        title="Speed Grader"
        description="Grade open-ended responses awaiting review."
      />

      {displayError && <p className="mb-4 text-destructive">{displayError}</p>}

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No responses pending review"
          description="All flagged responses for this exam have been graded."
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{row.examinee}</p>
              <p className="mt-1 font-medium">{row.question_text}</p>
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">
                {row.answer_text || "(no answer)"}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  max={row.points}
                  placeholder={`Points (max ${row.points})`}
                  value={drafts[row.id]?.points ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [row.id]: { points: e.target.value, comment: d[row.id]?.comment ?? "" },
                    }))
                  }
                />
                <Input
                  placeholder="Grader comment"
                  value={drafts[row.id]?.comment ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [row.id]: { points: d[row.id]?.points ?? "", comment: e.target.value },
                    }))
                  }
                />
              </div>
              <Button
                type="button"
                className="mt-3"
                disabled={gradeMutation.isPending}
                onClick={() => gradeMutation.mutate(row)}
              >
                <Save className="h-4 w-4" /> Save grade
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
