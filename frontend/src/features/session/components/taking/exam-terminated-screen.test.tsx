import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExamTerminatedScreen } from "./exam-terminated-screen";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

describe("ExamTerminatedScreen", () => {
  it("tells the examinee the proctor ended the exam, and which one", () => {
    render(<ExamTerminatedScreen examTitle="Midterm Algebra" onExit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Exam terminated" })).toBeInTheDocument();
    expect(screen.getByText("Midterm Algebra")).toBeInTheDocument();
    expect(screen.getByText(/proctor has ended this exam session/i)).toBeInTheDocument();
    expect(screen.getByText(/can no longer answer or submit/i)).toBeInTheDocument();
  });

  it("is announced to assistive tech as an alert", () => {
    render(<ExamTerminatedScreen onExit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Exam terminated");
  });

  it("omits the exam title when there is none", () => {
    render(<ExamTerminatedScreen onExit={vi.fn()} />);

    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("leaves only when the examinee chooses to", () => {
    const onExit = vi.fn();
    render(<ExamTerminatedScreen onExit={onExit} />);
    expect(onExit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /return to dashboard/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("takes focus onto the message, not the button", () => {
    // Whoever was mid-sentence when the exam vanished must not have their next
    // Enter or Space press send them off the page before they read why.
    render(<ExamTerminatedScreen onExit={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("button", { name: /return to dashboard/i })).not.toHaveFocus();
  });
});
