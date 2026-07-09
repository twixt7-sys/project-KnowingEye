export const examGraderKeys = {
  all: ["exam-grader"] as const,
  queue: (examId: number) => [...examGraderKeys.all, examId, "queue"] as const,
};
