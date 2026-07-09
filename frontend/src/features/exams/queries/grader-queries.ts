import { fetchPendingGradeRows } from "@/features/exams/api/grader-api";
import { examGraderKeys } from "@/features/exams/queries/grader-keys";

export const examGraderQueries = {
  queue: (examId: number) => ({
    queryKey: examGraderKeys.queue(examId),
    queryFn: () => fetchPendingGradeRows(examId),
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
};
