import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExamPausedOverlay } from "./exam-paused-overlay";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

describe("ExamPausedOverlay", () => {
  it("tells the examinee the exam is paused and shows the frozen time", () => {
    render(<ExamPausedOverlay secondsRemaining={754} />);

    expect(screen.getByRole("heading", { name: "Exam paused" })).toBeInTheDocument();
    expect(screen.getByText(/timer is stopped/i)).toBeInTheDocument();
    expect(screen.getByText("00:12:34")).toBeInTheDocument();
  });

  it("shows the proctor's note when there is one", () => {
    render(<ExamPausedOverlay secondsRemaining={60} reason="Please wait, fire drill." />);

    expect(screen.getByText("Note from your proctor")).toBeInTheDocument();
    expect(screen.getByText("Please wait, fire drill.")).toBeInTheDocument();
  });

  it("omits the note section when there is no reason", () => {
    render(<ExamPausedOverlay secondsRemaining={60} reason="" />);

    expect(screen.queryByText("Note from your proctor")).not.toBeInTheDocument();
  });
});
