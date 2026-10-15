import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pauseSession, resumeSession } from "@/features/monitoring/api/monitoring-api";
import { useSessionPause } from "./use-session-pause";

const can = vi.fn<(action: string) => boolean>();

vi.mock("@/core/providers/auth-provider", () => ({ useAuth: () => ({ can }) }));
vi.mock("@/features/monitoring/api/monitoring-api", () => ({
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

const setup = (status: string | undefined) => {
  const onChanged = vi.fn();
  const hook = renderHook(() => useSessionPause({ sessionId: "s1", status, onChanged }));
  return { ...hook, onChanged };
};

describe("useSessionPause", () => {
  beforeEach(() => {
    can.mockImplementation((action) => action === "sessions.pause");
    vi.mocked(pauseSession).mockResolvedValue({
      message: "",
      status: "paused",
      time_remaining_seconds: 1,
    });
    vi.mocked(resumeSession).mockResolvedValue({
      message: "",
      status: "in_progress",
      time_remaining_seconds: 1,
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("is shown for a running or a paused session when the user may pause", () => {
    expect(setup("in_progress").result.current.visible).toBe(true);
    const paused = setup("paused").result.current;
    expect(paused.visible).toBe(true);
    expect(paused.paused).toBe(true);
  });

  it("is hidden without the sessions.pause permission", () => {
    can.mockReturnValue(false);
    expect(setup("in_progress").result.current.visible).toBe(false);
  });

  it.each(["setup", "completed", "terminated", "expired", "pending_review", undefined])(
    "is hidden for a %s session",
    (status) => {
      expect(setup(status).result.current.visible).toBe(false);
    },
  );

  it("pauses with the reason, reports success and closes the dialog", async () => {
    const { result, onChanged } = setup("in_progress");
    act(() => result.current.setDialogOpen(true));

    await act(async () => {
      await result.current.pause("Fire drill");
    });

    expect(pauseSession).toHaveBeenCalledWith("s1", "Fire drill");
    expect(toast.success).toHaveBeenCalledWith("Exam paused.");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.busy).toBe(false);
  });

  it("keeps the dialog open and reports the error when pausing fails", async () => {
    vi.mocked(pauseSession).mockRejectedValue(
      new Error("Cannot pause session with status: Completed"),
    );
    const { result, onChanged } = setup("in_progress");
    act(() => result.current.setDialogOpen(true));

    await act(async () => {
      await result.current.pause("");
    });

    expect(toast.error).toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it("resumes and reports success", async () => {
    const { result, onChanged } = setup("paused");

    await act(async () => {
      await result.current.resume();
    });

    expect(resumeSession).toHaveBeenCalledWith("s1");
    expect(toast.success).toHaveBeenCalledWith("Exam resumed.");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
