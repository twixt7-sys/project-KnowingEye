import { useQuery } from "@tanstack/react-query";

import { formatApiError } from "@/core/config/api";
import { ExamCatalog } from "@/features/dashboard/components/exam-catalog";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { PageHeader } from "@/shared/components/layout/page-header";
import { PageShell } from "@/shared/components/layout/page-shell";

/**
 * Archived exams, on a page of their own. The main dashboard lists only the
 * exams still in use; archiving moves one here and unarchiving moves it back.
 */
export function ExaminerArchivedPage() {
  const examsQuery = useQuery(dashboardQueries.examinerExams());
  const loadError =
    examsQuery.error != null ? formatApiError(examsQuery.error, "Could not load exams") : null;

  return (
    <PageShell fill>
      <PageHeader
        eyebrow="Examiner"
        title="Archived exams"
        description="Exams that no longer accept attempts. Unarchive one to restore it."
        className="shrink-0"
      />
      <ExamCatalog
        view="archived"
        exams={examsQuery.data ?? []}
        loading={examsQuery.isLoading}
        error={loadError}
        onRetry={() => void examsQuery.refetch()}
      />
    </PageShell>
  );
}
