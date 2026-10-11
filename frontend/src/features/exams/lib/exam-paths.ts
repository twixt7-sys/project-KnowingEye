/** Route of the exam builder. */
export function examBuilderPath(examId: number): string {
  return `/examiner/exams/${examId}/edit`;
}

/** Route of the examiner's "Preview as student" page; `questionId` opens it at that question. */
export function examPreviewPath(examId: number, questionId?: number): string {
  const base = `/examiner/exams/${examId}/preview`;
  return questionId != null ? `${base}?q=${questionId}` : base;
}

/** The `?q=` question id of a preview deep link, or null when absent or not a valid id. */
export function parsePreviewQuestionParam(raw: string | null): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
