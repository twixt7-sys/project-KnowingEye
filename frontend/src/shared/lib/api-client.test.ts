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

describe("ApiClient exam lifecycle", () => {
  beforeEach(() => {
    tokenStore.set("access-token", "refresh-token");
  });

  afterEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it("unpublishExam POSTs to the unpublish endpoint", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ message: "ok", exam: { id: 7, status: "draft" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiClient.unpublishExam(7);

    expect(res.exam.status).toBe("draft");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/exams\/7\/unpublish\/$/);
    expect(init?.method).toBe("POST");
  });
});

describe("ApiClient list endpoints", () => {
  beforeEach(() => {
    tokenStore.set("access-token", "refresh-token");
  });

  afterEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("getExams follows pagination instead of stopping at the first page", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const page = new URL(String(input)).searchParams.get("page");
      return page === "1"
        ? jsonResponse({ count: 3, next: "more", previous: null, results: [{ id: 1 }, { id: 2 }] })
        : jsonResponse({ count: 3, next: null, previous: "prev", results: [{ id: 3 }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const exams = await apiClient.getExams({ status: "archived" });

    expect(exams.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = new URL(String(fetchMock.mock.calls[0][0]));
    expect(first.searchParams.get("status")).toBe("archived");
    expect(first.searchParams.get("page_size")).toBe("100");
  });

  it("listDepartments passes active_only and accepts an unpaginated array", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse([{ id: 1 }, { id: 2 }]));
    vi.stubGlobal("fetch", fetchMock);

    const departments = await apiClient.listDepartments({ active_only: true });

    expect(departments).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("active_only")).toBe("1");
  });
});
