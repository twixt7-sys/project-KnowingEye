import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExamTakingPage } from "./exam-taking-page";

const taking = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("@/features/session/hooks/use-exam-taking", () => ({
  useExamTaking: () => taking.value,
}));

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const navigate = vi.fn();
const base = {
  navigate,
  loading: false,
  error: null,
  session: { id: "s1", exam: { title: "Midterm Algebra" } },
  terminated: false,
};

describe("ExamTakingPage - terminated", () => {
  it("replaces the exam with the terminated screen", () => {
    taking.value = { ...base, terminated: true, activeQuestion: { id: 1 } };
    render(<ExamTakingPage />);

    expect(screen.getByRole("heading", { name: "Exam terminated" })).toBeInTheDocument();
    expect(screen.getByText("Midterm Algebra")).toBeInTheDocument();
  });

  it("wins over a submit error that raced the termination", () => {
    // A submit refused because the proctor just ended the exam must not tell
    // the examinee "Error Loading Exam".
    taking.value = {
      ...base,
      terminated: true,
      error: "This exam was terminated by your proctor.",
      activeQuestion: { id: 1 },
    };
    render(<ExamTakingPage />);

    expect(screen.getByRole("heading", { name: "Exam terminated" })).toBeInTheDocument();
    expect(screen.queryByText("Error Loading Exam")).not.toBeInTheDocument();
  });

  it("still shows the ordinary error screen for an ordinary failure", () => {
    taking.value = { ...base, error: "Failed to load exam", activeQuestion: undefined };
    render(<ExamTakingPage />);

    expect(screen.getByText("Error Loading Exam")).toBeInTheDocument();
    expect(screen.queryByText("Exam terminated")).not.toBeInTheDocument();
  });

  it("sends the examinee back to the dashboard from the terminated screen", () => {
    taking.value = { ...base, terminated: true, activeQuestion: { id: 1 } };
    render(<ExamTakingPage />);

    screen.getByRole("button", { name: /return to dashboard/i }).click();
    expect(navigate).toHaveBeenCalledWith("/examinee");
  });
});
