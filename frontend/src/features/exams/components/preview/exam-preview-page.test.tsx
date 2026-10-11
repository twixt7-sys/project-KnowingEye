import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamPreviewPage } from "./exam-preview-page";

const hook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/features/exams/hooks/use-exam-preview", () => ({
  useExamPreview: () => hook.value,
}));

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const exit = vi.fn();
const start = vi.fn();
const question = {
  id: 11,
  question_text: "What is 2 + 2?",
  question_type: "short_answer",
  options: [],
  points: 1,
  order: 1,
};
const exam = {
  id: 5,
  title: "Midterm Algebra",
  duration_minutes: 30,
  instructions: "Answer every question.",
  monitoring_enabled: true,
};
const ready = {
  exit,
  start,
  loading: false,
  error: null,
  exam,
  phase: "instructions",
  isEmpty: false,
  questions: [question],
  sections: [],
  activeQuestion: question,
  currentQuestion: 0,
  requestedQuestionMissing: false,
  answers: {},
  answeredCount: 0,
  progress: 0,
  flaggedCount: 0,
  timeRemaining: 1800,
  setAnswer: vi.fn(),
  toggleFlag: vi.fn(),
  setCurrentQuestion: vi.fn(),
};

beforeEach(() => {
  exit.mockClear();
  start.mockClear();
  hook.value = ready;
});

describe("ExamPreviewPage", () => {
  it("shows a spinner while loading", () => {
    hook.value = { ...ready, loading: true, exam: undefined };
    render(<ExamPreviewPage />);
    expect(screen.getByText("Loading preview…")).toBeInTheDocument();
  });

  it("explains a load failure and lets the examiner leave", () => {
    hook.value = { ...ready, error: "You can only preview exams you created.", exam: undefined };
    render(<ExamPreviewPage />);
    expect(screen.getByText("You can only preview exams you created.")).toBeInTheDocument();
    screen.getByRole("button", { name: "Exit preview" }).click();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("shows an empty state for an exam with no questions", () => {
    hook.value = { ...ready, isEmpty: true, questions: [], activeQuestion: undefined };
    render(<ExamPreviewPage />);
    expect(screen.getByText("No questions to preview")).toBeInTheDocument();
  });

  it("opens with the instructions, even for a monitored exam", () => {
    render(<ExamPreviewPage />);
    expect(screen.getByText("Preview mode - nothing is saved")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Midterm Algebra" })).toBeInTheDocument();
    expect(screen.getByText("Answer every question.")).toBeInTheDocument();
    expect(screen.getByText(/camera and identity check/i)).toBeInTheDocument();

    screen.getByRole("button", { name: "Start preview" }).click();
    expect(start).toHaveBeenCalledOnce();
  });

  it("runs the exam without a way to submit it", () => {
    hook.value = { ...ready, phase: "running" };
    render(<ExamPreviewPage />);

    expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    expect(screen.getByText("Preview mode - nothing is saved")).toBeInTheDocument();
    expect(screen.queryByText("Submit Exam")).not.toBeInTheDocument();
    expect(screen.queryByText(/Monitoring Active/)).not.toBeInTheDocument();

    // Every way out - the header and last-question "End preview" buttons and
    // the banner's "Exit preview" - leaves immediately.
    const exits = [
      ...screen.getAllByRole("button", { name: "End preview" }),
      screen.getByRole("button", { name: "Exit preview" }),
    ];
    for (const button of exits) button.click();
    expect(exit).toHaveBeenCalledTimes(exits.length);
  });

  it("says when a linked question wasn't part of the draw", () => {
    hook.value = { ...ready, phase: "running", requestedQuestionMissing: true };
    render(<ExamPreviewPage />);
    expect(screen.getByText(/isn't part of this random draw/i)).toBeInTheDocument();
  });
});
