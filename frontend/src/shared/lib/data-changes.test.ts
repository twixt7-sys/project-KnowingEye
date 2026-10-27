import { describe, expect, it, vi } from "vitest";

import {
  changesForRequest,
  publishDataChanges,
  subscribeDataChanges,
} from "@/shared/lib/data-changes";

describe("changesForRequest", () => {
  it("ignores reads", () => {
    expect(changesForRequest("GET", "/exams/4/")).toEqual([]);
  });

  it("ties exam writes to their exam", () => {
    expect(changesForRequest("PATCH", "/exams/4/")).toEqual([{ topic: "exams", examId: 4 }]);
    expect(changesForRequest("DELETE", "/exams/4/questions/9/")).toEqual([
      { topic: "exams", examId: 4 },
    ]);
    expect(changesForRequest("POST", "/exams/")).toEqual([{ topic: "exams", examId: null }]);
  });

  it("skips dry runs and background traffic", () => {
    const body = JSON.stringify({ questions: [], dry_run: true });
    expect(changesForRequest("POST", "/exams/4/questions/import/", body)).toEqual([]);
    expect(changesForRequest("POST", "/sessions/abc/heartbeat/")).toEqual([]);
    expect(changesForRequest("POST", "/sessions/abc/responses/")).toEqual([]);
    expect(changesForRequest("POST", "/sessions/abc/log-event/")).toEqual([]);
    expect(changesForRequest("POST", "/monitoring/frame/")).toEqual([]);
    expect(changesForRequest("POST", "/auth/token/")).toEqual([]);
  });

  it("maps the other areas to their topics", () => {
    expect(changesForRequest("POST", "/sessions/abc/terminate/")).toEqual([{ topic: "sessions" }]);
    expect(changesForRequest("PATCH", "/responses/3/grade/")).toEqual([{ topic: "sessions" }]);
    expect(changesForRequest("POST", "/behavior/alerts/resolve_all/")).toEqual([
      { topic: "alerts" },
    ]);
    expect(changesForRequest("DELETE", "/departments/2/")).toEqual([{ topic: "reference" }]);
    expect(changesForRequest("POST", "/auth/users/2/set-role/")).toEqual([{ topic: "users" }]);
    expect(changesForRequest("POST", "/auth/profile/avatar/")).toEqual([
      { topic: "me" },
      { topic: "users" },
    ]);
  });
});

describe("publishDataChanges", () => {
  it("reaches subscribers until they unsubscribe, and survives a throwing one", () => {
    const listener = vi.fn();
    const broken = subscribeDataChanges(() => {
      throw new Error("boom");
    });
    const unsubscribe = subscribeDataChanges(listener);

    publishDataChanges([{ topic: "alerts" }], "remote");
    expect(listener).toHaveBeenCalledWith([{ topic: "alerts" }], "remote");

    unsubscribe();
    broken();
    publishDataChanges([{ topic: "alerts" }], "local");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
