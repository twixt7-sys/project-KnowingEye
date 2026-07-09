import {
  fetchExamAssignments,
  fetchExamById,
  fetchExamReadiness,
  fetchQuestions,
} from "@/features/exams/api/exam-api";
import { examBuilderKeys } from "@/features/exams/queries/keys";

export const examBuilderQueries = {
  exam: (examId: number) => ({
    queryKey: examBuilderKeys.detail(examId),
    queryFn: () => fetchExamById(examId),
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
  questions: (examId: number) => ({
    queryKey: examBuilderKeys.questions(examId),
    queryFn: async () => {
      const list = await fetchQuestions(examId);
      return list.sort((a, b) => a.order - b.order);
    },
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
  readiness: (examId: number) => ({
    queryKey: examBuilderKeys.readiness(examId),
    queryFn: () => fetchExamReadiness(examId),
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
  assignments: (examId: number) => ({
    queryKey: examBuilderKeys.assignments(examId),
    queryFn: () => fetchExamAssignments(examId).catch(() => []),
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
};
