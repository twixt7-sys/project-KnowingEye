export const examBuilderKeys = {
  all: ["exam-builder"] as const,
  detail: (examId: number) => ["exam-builder", examId] as const,
  questions: (examId: number) => ["exam-builder", examId, "questions"] as const,
  readiness: (examId: number) => ["exam-builder", examId, "readiness"] as const,
  assignments: (examId: number) => ["exam-builder", examId, "assignments"] as const,
  sections: (examId: number) => ["exam-builder", examId, "sections"] as const,
  completedExaminees: (examId: number) =>
    ["exam-builder", examId, "completed-examinees"] as const,
};

// Deliberately outside the "exam-builder" prefix: builder invalidations must
// never refetch (and so reshuffle) a preview that is in progress.
export const examPreviewKeys = {
  detail: (examId: number) => ["exam-preview", examId] as const,
};
