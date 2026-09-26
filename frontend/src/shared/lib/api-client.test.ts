import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./api-client";
import { tokenStore } from "./token-store";

describe("ApiClient token refresh", () => {
  beforeEach(() => {
    tokenStore.set("expired-access", "refresh-token-1");
  });

  afterEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it("dedupes concurrent refreshes into a single request", async () => {
    let refreshCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/auth/token/refresh/")) {
          refreshCalls += 1;
          // Real network latency, so both 401s below are mid-flight before
          // either sees the rotated token - this is what makes the race
          // condition (a second refresh call reusing the now-blacklisted
          // token) reproducible without the dedup fix.
          await new Promise((resolve) => setTimeout(resolve, 10));
          return new Response(JSON.stringify({ access: "new-access", refresh: "new-refresh" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (auth === "Bearer new-access") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ detail: "expired" }), { status: 401 });
      }),
    );

    const [a, b] = await Promise.all([
      apiClient.request("/protected-a"),
      apiClient.request("/protected-b"),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    // A losing concurrent refresh call must not wipe the tokens the winning
    // call just saved.
    expect(tokenStore.access).toBe("new-access");
    expect(tokenStore.refresh).toBe("new-refresh");
  });
});
