import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { invalidateEverything, invalidateForChanges } from "@/core/sync/invalidate";

function seededClient(keys: unknown[][]) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  for (const key of keys) client.setQueryData(key, { seeded: true });
  return client;
}

function staleKeys(client: QueryClient): string[] {
  return client
    .getQueryCache()
    .getAll()
    .filter((query) => query.isStale())
    .map((query) => JSON.stringify(query.queryKey))
    .sort();
}

describe("invalidateForChanges", () => {
  it("refreshes every screen showing an exam, and only that exam's builder", async () => {
    const client = seededClient([
      ["dashboard", "examiner-exams"],
      ["exam-builder", 4],
      ["exam-builder", 4, "questions"],
      ["exam-builder", 5],
      ["exam-preview", 4],
      ["reports", "summary"],
      ["admin", "users", {}],
    ]);
    await invalidateForChanges(client, [{ topic: "exams", examId: 4 }]);
    expect(staleKeys(client)).toEqual(
      [
        ["dashboard", "examiner-exams"],
        ["exam-builder", 4],
        ["exam-builder", 4, "questions"],
        ["exam-preview", 4],
        ["reports", "summary"],
      ]
        .map((k) => JSON.stringify(k))
        .sort(),
    );
  });

  it("refreshes department lists everywhere they are cached", async () => {
    const client = seededClient([
      ["admin", "departments"],
      ["dashboard", "departments", { activeOnly: true }],
      ["reports", "departments"],
      ["exam-builder", 4],
    ]);
    await invalidateForChanges(client, [{ topic: "reference" }]);
    expect(staleKeys(client)).not.toContain(JSON.stringify(["exam-builder", 4]));
    expect(staleKeys(client)).toHaveLength(3);
  });
});

describe("invalidateEverything", () => {
  it("marks every query stale", async () => {
    const client = seededClient([["dashboard"], ["exam-preview", 1], ["monitoring", "health"]]);
    await invalidateEverything(client);
    expect(staleKeys(client)).toHaveLength(3);
  });
});
