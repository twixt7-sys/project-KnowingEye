import {
  fetchExamAssignments,
  fetchExamById,
  fetchExamPreview,
  fetchExamReadiness,
  fetchExamSections,
  fetchQuestions,
} from "@/features/exams/api/exam-api";
import { examBuilderKeys, examPreviewKeys } from "@/features/exams/queries/keys";

/** Each fetch is a fresh random draw (pools, shuffling), so it is never reused or refetched mid-preview. */
export const examPreviewQueries = {
  preview: (examId: number) => ({
    queryKey: examPreviewKeys.detail(examId),
    queryFn: () => fetchExamPreview(examId),
    enabled: examId > 0 && !Number.isNaN(examId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  }),
};

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
  sections: (examId: number) => ({
    queryKey: examBuilderKeys.sections(examId),
    queryFn: async () => {
      const list = await fetchExamSections(examId);
      return list.sort((a, b) => a.order - b.order);
    },
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
};
