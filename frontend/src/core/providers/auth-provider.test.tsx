import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_REFRESH_INTERVAL_MS, AuthProvider, useAuth } from "@/core/providers/auth-provider";
import { FORBIDDEN_EVENT } from "@/shared/lib/api-client";

const mocks = vi.hoisted(() => ({
  apiClient: { getProfile: vi.fn(), getAccessMap: vi.fn() },
  tokenStore: { access: "token" as string | null, refresh: null, clear: vi.fn(), set: vi.fn() },
}));
vi.mock("@/core/config/api", () => ({ apiClient: mocks.apiClient, tokenStore: mocks.tokenStore }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const before = { role: "PROCTOR", modules: ["monitoring"], permissions: ["sessions.pause"] };
const granted = {
  role: "PROCTOR",
  modules: ["exams", "monitoring"],
  permissions: ["exams.update-any", "sessions.pause"],
};

function Probe() {
  const { isLoading, user, can, hasModule } = useAuth();
  if (isLoading) return <p>loading</p>;
  return (
    <p data-testid="probe">
      {user?.role}|{String(can("exams.update-any"))}|{String(hasModule("exams"))}
    </p>
  );
}

async function renderSignedIn() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("PROCTOR|false|false"));
  // Let the listener/interval effect that follows sign-in commit.
  await act(async () => {});
}

/** Step the clock past the event throttle so the next focus/403 refetches. */
function skipThrottle() {
  vi.setSystemTime(Date.now() + 10_000);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  mocks.tokenStore.access = "token";
  mocks.apiClient.getProfile.mockResolvedValue({ id: 7, username: "zz-proctor", role: "PROCTOR" });
  mocks.apiClient.getAccessMap.mockResolvedValue(before);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AuthProvider access refresh", () => {
  it("picks up an admin's grant when the tab regains focus, without a re-login", async () => {
    await renderSignedIn();
    mocks.apiClient.getAccessMap.mockResolvedValue(granted);
    skipThrottle();
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("PROCTOR|true|true"));
    expect(mocks.apiClient.getProfile).toHaveBeenCalledTimes(1);
  });

  it("re-reads the access map periodically", async () => {
    await renderSignedIn();
    mocks.apiClient.getAccessMap.mockResolvedValue(granted);
    act(() => {
      vi.advanceTimersByTime(ACCESS_REFRESH_INTERVAL_MS);
    });
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("PROCTOR|true|true"));
  });

  it("re-reads the access map after a 403, and drops a revoked permission", async () => {
    mocks.apiClient.getAccessMap.mockResolvedValue(granted);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("PROCTOR|true|true"));

    mocks.apiClient.getAccessMap.mockResolvedValue(before);
    skipThrottle();
    act(() => {
      window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    });
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("PROCTOR|false|false"),
    );
  });

  it("throttles bursts of focus/403 events", async () => {
    await renderSignedIn();
    const initialCalls = mocks.apiClient.getAccessMap.mock.calls.length;
    skipThrottle();
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("focus"));
    window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    await waitFor(() =>
      expect(mocks.apiClient.getAccessMap).toHaveBeenCalledTimes(initialCalls + 1),
    );
  });

  it("reloads the profile when the admin changed the user's role", async () => {
    await renderSignedIn();
    mocks.apiClient.getAccessMap.mockResolvedValue({ ...granted, role: "PROGRAM_HEAD" });
    mocks.apiClient.getProfile.mockResolvedValue({ id: 7, username: "zz-proctor", role: "PROGRAM_HEAD" });
    skipThrottle();
    fireEvent(window, new Event("focus"));
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("PROGRAM_HEAD|true|true"),
    );
  });

  it("does nothing while signed out", async () => {
    mocks.tokenStore.access = null;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("|false|false"));
    act(() => {
      vi.advanceTimersByTime(ACCESS_REFRESH_INTERVAL_MS * 2);
    });
    fireEvent(window, new Event("focus"));
    expect(mocks.apiClient.getAccessMap).not.toHaveBeenCalled();
  });
});
