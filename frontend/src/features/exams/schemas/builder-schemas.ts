import { z } from "zod";

import type { Exam } from "@/core/config/api";

export const builderTabSchema = z.enum(["settings", "questions", "candidates", "publish"]);
export type BuilderTab = z.infer<typeof builderTabSchema>;

export const presentationModeSchema = z.enum(["one_per_page", "section_per_page", "scroll_all"]);
export const showCorrectAnswersSchema = z.enum(["never", "after_release", "immediately"]);
export const questionTypeSchema = z.enum([
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
]);

export const examFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  instructions: z.string(),
  duration_minutes: z.number().min(1),
  passing_score: z.number().min(0).max(100),
  max_attempts: z.number().min(1),
  monitoring_enabled: z.boolean(),
  shuffle_questions: z.boolean(),
  shuffle_options: z.boolean(),
  requires_assignment: z.boolean(),
  is_practice: z.boolean(),
  presentation_mode: presentationModeSchema,
  show_correct_answers: showCorrectAnswersSchema,
  available_from: z.string(),
  available_until: z.string(),
  results_release_at: z.string(),
});

export const questionDraftSchema = z.object({
  question_text: z.string(),
  question_type: questionTypeSchema,
  options: z.array(z.string()),
  correct_answer: z.string(),
  points: z.number().min(1),
});

export type ExamForm = z.infer<typeof examFormSchema>;
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

export const EMPTY_QUESTION: QuestionDraft = {
  question_text: "",
  question_type: "multiple_choice",
  options: ["", "", "", ""],
  correct_answer: "",
  points: 1,
};

export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export function examToForm(exam: Exam): ExamForm {
  return {
    title: exam.title,
    description: exam.description ?? "",
    instructions: exam.instructions ?? "",
    duration_minutes: exam.duration_minutes,
    passing_score: exam.passing_score,
    max_attempts: exam.max_attempts ?? 1,
    monitoring_enabled: exam.monitoring_enabled !== false,
    shuffle_questions: exam.shuffle_questions === true,
    shuffle_options: exam.shuffle_options === true,
    requires_assignment: exam.requires_assignment === true,
    is_practice: exam.is_practice === true,
    presentation_mode: exam.presentation_mode ?? "one_per_page",
    show_correct_answers: exam.show_correct_answers ?? "never",
    available_from: toDatetimeLocal(exam.available_from),
    available_until: toDatetimeLocal(exam.available_until),
    results_release_at: toDatetimeLocal(exam.results_release_at),
  };
}

export function examFormToPayload(form: ExamForm): Partial<Exam> {
  return {
    title: form.title,
    description: form.description,
    instructions: form.instructions,
    duration_minutes: form.duration_minutes,
    passing_score: form.passing_score,
    max_attempts: form.max_attempts,
    monitoring_enabled: form.monitoring_enabled,
    shuffle_questions: form.shuffle_questions,
    shuffle_options: form.shuffle_options,
    requires_assignment: form.requires_assignment,
    is_practice: form.is_practice,
    presentation_mode: form.presentation_mode,
    show_correct_answers: form.show_correct_answers,
    available_from: toIsoOrNull(form.available_from),
    available_until: toIsoOrNull(form.available_until),
    results_release_at: toIsoOrNull(form.results_release_at),
  };
}
