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

describe("useExamAttempt - proctor push and termination", () => {
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

  it("shows a pushed pause at once, without waiting for a heartbeat", async () => {
    const { result } = await mountAttempt();
    api.sessionHeartbeat.mockClear();

    act(() => {
      result.current.applySessionState({
        status: "paused",
        time_remaining_seconds: 61,
        pause_reason: "Fire drill",
      });
    });

    expect(result.current.paused).toBe(true);
    expect(result.current.pauseReason).toBe("Fire drill");
    expect(result.current.timeRemaining).toBe(61);
    expect(api.sessionHeartbeat).not.toHaveBeenCalled();
  });

  it("notices a pause within the heartbeat interval when nothing is pushed", async () => {
    // An exam with monitoring off has no socket to push on: the heartbeat is
    // the only way the examinee is told.
    const { result } = await mountAttempt();
    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "paused", time_remaining_seconds: 70 }),
    );

    await advance(9_000);
    expect(result.current.paused).toBe(false);
    await advance(1_500);
    expect(result.current.paused).toBe(true);
  });

  it("shows a pushed termination at once", async () => {
    const { result } = await mountAttempt();
    expect(result.current.terminated).toBe(false);

    act(() => {
      result.current.applySessionState({ status: "terminated", time_remaining_seconds: 40 });
    });

    expect(result.current.terminated).toBe(true);
    expect(result.current.session?.status).toBe("terminated");
  });

  it("learns of a termination from its heartbeat when no push arrived", async () => {
    const { result } = await mountAttempt();
    api.sessionHeartbeat.mockResolvedValue(
      heartbeat({ status: "terminated", time_remaining_seconds: 40 }),
    );

    await advance(10_500);
    expect(result.current.terminated).toBe(true);
  });

  it("learns of a termination when an autosave is refused", async () => {
    const { result } = await mountAttempt();
    api.saveSessionResponses.mockRejectedValue(new Error("terminated"));
    api.sessionHeartbeat.mockResolvedValue(heartbeat({ status: "terminated" }));

    act(() => {
      result.current.setAnswer(1, { answer_text: "True" });
    });
    await advance(1_600);

    expect(result.current.terminated).toBe(true);
  });

  it("is not revived by a heartbeat that was already in flight when the exam was terminated", async () => {
    const { result } = await mountAttempt();

    // The proctor acts while this heartbeat is on its way back with the old state.
    let answerLate: (hb: ReturnType<typeof heartbeat>) => void = () => {};
    api.sessionHeartbeat.mockReturnValueOnce(
      new Promise((resolve) => {
        answerLate = resolve as typeof answerLate;
      }),
    );
    let sync: Promise<void> = Promise.resolve();
    act(() => {
      sync = result.current.syncNow();
    });

    act(() => {
      result.current.applySessionState({ status: "terminated" });
    });
    expect(result.current.terminated).toBe(true);

    await act(async () => {
      answerLate(heartbeat({ status: "in_progress", time_remaining_seconds: 99 }));
      await sync;
    });

    expect(result.current.terminated).toBe(true);
    expect(result.current.paused).toBe(false);
  });

  it("stops ticking, polling and autosaving once terminated", async () => {
    const { result } = await mountAttempt();

    act(() => {
      result.current.setAnswer(1, { answer_text: "True" });
    });
    act(() => {
      result.current.applySessionState({ status: "terminated", time_remaining_seconds: 80 });
    });
    api.sessionHeartbeat.mockClear();
    api.saveSessionResponses.mockClear();

    await advance(60_000);

    expect(result.current.timeRemaining).toBe(80); // frozen
    expect(api.sessionHeartbeat).not.toHaveBeenCalled(); // nothing left to learn
    expect(api.saveSessionResponses).not.toHaveBeenCalled(); // pending save dropped
  });

  it("discards the cached answers of a terminated attempt", async () => {
    const { result } = await mountAttempt();
    act(() => {
      result.current.setAnswer(1, { answer_text: "True" });
    });
    expect(localStorage.getItem("knowing-eye-attempt-s1")).not.toBeNull();

    act(() => {
      result.current.applySessionState({ status: "terminated" });
    });

    expect(localStorage.getItem("knowing-eye-attempt-s1")).toBeNull();
  });

  it("resumes normally from a pushed pause", async () => {
    const { result } = await mountAttempt();
    act(() => {
      result.current.applySessionState({ status: "paused", time_remaining_seconds: 50 });
    });
    act(() => {
      result.current.applySessionState({ status: "in_progress", time_remaining_seconds: 50 });
    });

    expect(result.current.paused).toBe(false);
    expect(result.current.pauseReason).toBe("");
    await advance(5_000);
    expect(result.current.timeRemaining).toBe(45);
  });
});
