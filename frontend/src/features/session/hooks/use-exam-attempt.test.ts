import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/config/api";
import { useExamAttempt } from "./use-exam-attempt";

vi.mock("@/core/config/api", () => ({
  apiClient: {
    getSession: vi.fn(),
    sessionHeartbeat: vi.fn(),
    saveSessionResponses: vi.fn(),
  },
}));

const api = vi.mocked(apiClient);

const session = (over: Record<string, unknown> = {}) =>
  ({
    id: "s1",
    status: "in_progress",
    time_remaining_seconds: 100,
    responses: [],
    exam: { questions: [] },
    ...over,
  }) as never;

const heartbeat = (over: Record<string, unknown> = {}) =>
  ({
    server_now: "",
    deadline_at: null,
    time_remaining_seconds: 100,
    status: "in_progress",
    pause_reason: "",
    ...over,
  }) as never;

/** Let timers and the promises they trigger run. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

async function mountAttempt() {
  const hook = renderHook(() => useExamAttempt("s1"));
  await advance(0); // initial refresh()
  return hook;
}

describe("useExamAttempt - proctor pause", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    api.getSession.mockResolvedValue(session());
    api.sessionHeartbeat.mockResolvedValue(heartbeat());
    api.saveSessionResponses.mockResolvedValue({ saved: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("counts down while the exam is running", async () => {
    const { result } = await mountAttempt();
    expect(result.current.timeRemaining).toBe(100);
    expect(result.current.paused).toBe(false);

    await advance(5_000);
    expect(result.current.timeRemaining).toBe(95);
  });

  it("freezes the clock once the server reports the exam paused", async () => {
    const { result } = await mountAttempt();

    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "paused", time_remaining_seconds: 80, pause_reason: "Stand by" }),
    );
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.paused).toBe(true);
    expect(result.current.pauseReason).toBe("Stand by");
    expect(result.current.timeRemaining).toBe(80);

    await advance(20_000);
    expect(result.current.timeRemaining).toBe(80); // not ticking
  });

  it("notices a pause on its own timer sync, and a resume within seconds", async () => {
    const { result } = await mountAttempt();

    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "paused", time_remaining_seconds: 70 }),
    );
    await advance(30_000); // the normal sync interval
    expect(result.current.paused).toBe(true);
    expect(result.current.timeRemaining).toBe(70);

    // Resumed with the same time on the clock; the paused poll picks it up fast.
    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "in_progress", time_remaining_seconds: 70 }),
    );
    await advance(3_000);
    expect(result.current.paused).toBe(false);
    expect(result.current.pauseReason).toBe("");

    await advance(5_000);
    expect(result.current.timeRemaining).toBe(65); // ticking again
  });

  it("learns it was paused when an autosave is rejected", async () => {
    const { result } = await mountAttempt();
    expect(result.current.paused).toBe(false);

    api.saveSessionResponses.mockRejectedValue(new Error("This exam is paused."));
    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "paused", time_remaining_seconds: 90 }),
    );

    act(() => {
      result.current.setAnswer(1, { answer_text: "True" });
    });
    await advance(1_600); // autosave debounce, then the rejected save and its resync

    expect(api.saveSessionResponses).toHaveBeenCalled();
    expect(result.current.autosaveStatus).toBe("error");
    expect(result.current.paused).toBe(true);
  });

  it("starts out paused when the loaded session is paused", async () => {
    api.getSession.mockResolvedValue(
      session({ status: "paused", time_remaining_seconds: 42, pause_reason: "Hold on" }),
    );
    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "paused", time_remaining_seconds: 42, pause_reason: "Hold on" }),
    );

    const { result } = await mountAttempt();
    expect(result.current.paused).toBe(true);
    expect(result.current.pauseReason).toBe("Hold on");

    await advance(10_000);
    expect(result.current.timeRemaining).toBe(42);
  });
});
