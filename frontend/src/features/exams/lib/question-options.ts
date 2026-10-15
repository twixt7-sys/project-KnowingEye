import type { QuestionOptionDraft } from "@/features/exams/schemas/builder-schemas";

// Answers are recorded and graded by option *text*, so a choice that is only a
// picture still needs a label. The builder generates "Option N" (N = its row
// in the form) and hides it again when the question is reopened for editing.
const GENERATED_LABEL = /^Option \d+$/;

// Mirrors MIN_CHOICES / MAX_CHOICES in backend/features/exams/serializers.py.
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;

type OptionsState = { options: QuestionOptionDraft[]; correct_answer: string };

export function hasOptionContent(option: QuestionOptionDraft): boolean {
  return Boolean(option.text.trim() || option.image);
}

/** The text a choice is stored (and graded) under, or "" for an empty row. */
export function optionLabel(option: QuestionOptionDraft, index: number): string {
  const text = option.text.trim();
  if (text) return text;
  return option.image ? `Option ${index + 1}` : "";
}

/** Appends an empty row, up to MAX_OPTIONS. */
export function addOption<T extends OptionsState>(draft: T): T {
  if (draft.options.length >= MAX_OPTIONS) return draft;
  return { ...draft, options: [...draft.options, { text: "", image: null }] };
}

/**
 * Removes a row, down to MIN_OPTIONS. The correct answer is stored by label,
 * and a picture-only label is its row number, so it is re-pointed at the row it
 * belonged to; removing the correct row itself clears it.
 */
export function removeOption<T extends OptionsState>(draft: T, index: number): T {
  if (draft.options.length <= MIN_OPTIONS || !draft.options[index]) return draft;

  const correctIndex = draft.options.findIndex(
    (option, i) => optionLabel(option, i) !== "" && optionLabel(option, i) === draft.correct_answer
  );
  const options = draft.options.filter((_, i) => i !== index);

  let correct_answer = draft.correct_answer;
  if (correctIndex === index) {
    correct_answer = "";
  } else if (correctIndex >= 0) {
    const shifted = correctIndex > index ? correctIndex - 1 : correctIndex;
    correct_answer = optionLabel(options[shifted], shifted);
  }
  return { ...draft, options, correct_answer };
}

/**
 * Rows whose label matches another row's (ignoring case and spacing). Answers
 * are graded by label, so two rows sharing one would both count as correct.
 */
export function duplicateOptionIndexes(options: QuestionOptionDraft[]): Set<number> {
  const rowsByLabel = new Map<string, number[]>();
  options.forEach((option, index) => {
    const label = optionLabel(option, index).toLowerCase();
    if (label) rowsByLabel.set(label, [...(rowsByLabel.get(label) ?? []), index]);
  });
  return new Set([...rowsByLabel.values()].filter((rows) => rows.length > 1).flat());
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
