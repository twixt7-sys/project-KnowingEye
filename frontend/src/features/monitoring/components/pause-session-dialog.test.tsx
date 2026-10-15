import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PauseSessionDialog } from "./pause-session-dialog";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const renderDialog = (over: Partial<Parameters<typeof PauseSessionDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PauseSessionDialog
      open
      studentName="Ada Lovelace"
      busy={false}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...over}
    />,
  );
  return { onConfirm, onOpenChange };
};

describe("PauseSessionDialog", () => {
  it("explains what pausing does, for this examinee", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Pause exam?" })).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace's exam clock stops/)).toBeInTheDocument();
  });

  it("confirms with the note the proctor typed", () => {
    const { onConfirm } = renderDialog();

    fireEvent.change(screen.getByLabelText(/note for the examinee/i), {
      target: { value: "Please wait." },
    });
    fireEvent.click(screen.getByRole("button", { name: /pause exam/i }));

    expect(onConfirm).toHaveBeenCalledWith("Please wait.");
  });

  it("confirms with an empty note when none is typed (the note is optional)", () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /pause exam/i }));

    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("cancels without confirming", () => {
    const { onConfirm, onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("locks both buttons while the request is in flight", () => {
    renderDialog({ busy: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /pause exam/i })).toBeDisabled();
  });
});
