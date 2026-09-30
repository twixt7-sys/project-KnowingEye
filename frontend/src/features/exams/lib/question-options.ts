import type { QuestionOptionDraft } from "@/features/exams/schemas/builder-schemas";

// Answers are recorded and graded by option *text*, so a choice that is only a
// picture still needs a label. The builder generates "Option N" (N = its row
// in the form) and hides it again when the question is reopened for editing.
const GENERATED_LABEL = /^Option \d+$/;

export function hasOptionContent(option: QuestionOptionDraft): boolean {
  return Boolean(option.text.trim() || option.image);
}

/** The text a choice is stored (and graded) under, or "" for an empty row. */
export function optionLabel(option: QuestionOptionDraft, index: number): string {
  const text = option.text.trim();
  if (text) return text;
  return option.image ? `Option ${index + 1}` : "";
}

/** Drops empty rows; picture-only rows are kept and given a label. */
export function optionsToPayload(options: QuestionOptionDraft[]): QuestionOptionDraft[] {
  return options.flatMap((option, index) =>
    hasOptionContent(option) ? [{ text: optionLabel(option, index), image: option.image }] : []
  );
}

/**
 * Turns saved options back into form rows, blanking generated labels so a
 * picture-only choice shows an empty text box again. The correct answer is
 * re-pointed at the relabelled row.
 */
export function optionsToDraft(
  saved: QuestionOptionDraft[],
  correctAnswer: string
): { options: QuestionOptionDraft[]; correct_answer: string } {
  let correct = correctAnswer;
  const options = saved.map((option, index) => {
    if (option.image && GENERATED_LABEL.test(option.text)) {
      if (option.text === correctAnswer) correct = `Option ${index + 1}`;
      return { text: "", image: option.image };
    }
    return { ...option };
  });
  return { options, correct_answer: correct };
}
