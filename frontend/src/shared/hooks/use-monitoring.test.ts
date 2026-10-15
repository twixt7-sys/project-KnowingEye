import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMonitoring } from "./use-monitoring";

vi.mock("../../core/config/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../core/config/api")>()),
  buildMonitoringWsUrl: (id: string) => `ws://test/ws/monitoring/${id}/`,
  apiClient: { sendFrame: vi.fn(), enrollReference: vi.fn() },
}));

/** A stand-in for the browser WebSocket that the test drives by hand. */
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const trackStop = vi.fn();

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getVideoTracks: () => [{ readyState: "live", enabled: true }],
        getTracks: () => [{ stop: trackStop }],
      }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function goLive(options: Parameters<typeof useMonitoring>[0]) {
  const hook = renderHook(() => useMonitoring(options));
  await act(async () => {
    await hook.result.current.start();
  });
  const socket = FakeSocket.instances[0];
  act(() => socket.open());
  expect(hook.result.current.status).toBe("live");
  return { ...hook, socket };
}

describe("useMonitoring - when the session is taken away", () => {
  it("stops, and tells the caller, when the server closes the socket for a termination", async () => {
    const onSessionInactive = vi.fn();
    const { result, socket } = await goLive({ sessionId: "s1", onSessionInactive });

    act(() => socket.serverClose(4410));

    expect(onSessionInactive).toHaveBeenCalledTimes(1);
    // Not "fallback-rest": there is nothing to stream frames to any more.
    expect(result.current.status).toBe("closed");
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("does the same when the session simply ran out of time", async () => {
    const onSessionInactive = vi.fn();
    const { result, socket } = await goLive({ sessionId: "s1", onSessionInactive });

    act(() => socket.serverClose(4408));

    expect(onSessionInactive).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("closed");
  });

  it("still falls back to REST when the connection merely drops", async () => {
    const onSessionInactive = vi.fn();
    const { result, socket } = await goLive({ sessionId: "s1", onSessionInactive });

    act(() => socket.serverClose(1006));

    expect(result.current.status).toBe("fallback-rest");
    expect(onSessionInactive).not.toHaveBeenCalled();
  });

  it("hands a pushed session state to the caller", async () => {
    const onSessionState = vi.fn();
    const { socket } = await goLive({ sessionId: "s1", onSessionState });

    act(() =>
      socket.receive({
        type: "session_state",
        status: "terminated",
        time_remaining_seconds: 12,
        pause_reason: "",
      }),
    );

    expect(onSessionState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "terminated", time_remaining_seconds: 12 }),
    );
  });

  it("leaves the camera for the caller to release", async () => {
    // The page decides what screen follows; it stops the camera itself.
    const { socket } = await goLive({ sessionId: "s1" });

    act(() => socket.serverClose(4410));

    expect(trackStop).not.toHaveBeenCalled();
  });
});
