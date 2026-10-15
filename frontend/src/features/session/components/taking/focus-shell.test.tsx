import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FocusShell } from "./focus-shell";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const baseProps = {
  monitoringEnabled: false,
  disableCopyPaste: false,
  webcamActive: false,
  behaviorAlerts: [],
  timeRemaining: 600,
  submitting: false,
  onSubmitClick: vi.fn(),
};

/** Fires a context-menu event on the page text and reports whether it was cancelled. */
function contextMenuWasBlocked() {
  const event = createEvent.contextMenu(screen.getByText("Question text"));
  fireEvent(screen.getByText("Question text"), event);
  return event.defaultPrevented;
}

describe("FocusShell", () => {
  it("blocks the context menu on exam content for students", () => {
    render(
      <FocusShell {...baseProps}>
        <p>Question text</p>
      </FocusShell>
    );
    expect(contextMenuWasBlocked()).toBe(true);
    expect(screen.getByRole("button", { name: "Submit Exam" })).toBeInTheDocument();
    expect(screen.queryByText(/nothing is saved/i)).not.toBeInTheDocument();
  });

  it("lifts the deterrents and shows the banner in preview", () => {
    const onExitPreview = vi.fn();
    render(
      <FocusShell {...baseProps} preview onExitPreview={onExitPreview}>
        <p>Question text</p>
      </FocusShell>
    );
    expect(contextMenuWasBlocked()).toBe(false);
    expect(screen.getByText("Preview mode - nothing is saved")).toBeInTheDocument();

    screen.getByRole("button", { name: "Exit preview" }).click();
    expect(onExitPreview).toHaveBeenCalledOnce();
  });

  it("ends the preview instead of submitting", () => {
    const onSubmitClick = vi.fn();
    render(
      <FocusShell {...baseProps} preview onSubmitClick={onSubmitClick}>
        <p>Question text</p>
      </FocusShell>
    );
    expect(screen.queryByRole("button", { name: "Submit Exam" })).not.toBeInTheDocument();
    screen.getByRole("button", { name: "End preview" }).click();
    expect(onSubmitClick).toHaveBeenCalledOnce();
  });
});
