import { describe, expect, it } from "vitest";

import type { SessionReportRow } from "@/core/config/api";

import { groupSessionsByExam, parseExamParam } from "./exam-groups";

function row(over: Partial<SessionReportRow>): SessionReportRow {
  return {
    id: "s",
    exam_id: 1,
    exam_title: "Exam",
    user: "u",
    user_full_name: "U",
    status: "in_progress",
    started_at: "2026-10-18T08:00:00Z",
    submitted_at: null,
    percentage_score: null,
    passed: null,
    alert_count: 0,
    unresolved_alert_count: 0,
    behavior_event_count: 0,
    ...over,
  };
}

describe("groupSessionsByExam", () => {
  it("returns nothing when no exam is running", () => {
    expect(groupSessionsByExam([])).toEqual([]);
  });

  it("groups candidates under their exam and counts live, paused and flagged", () => {
    const groups = groupSessionsByExam([
      row({ id: "a", exam_id: 2, exam_title: "Biology", unresolved_alert_count: 3 }),
      row({ id: "b", exam_id: 1, exam_title: "Algebra" }),
      row({ id: "c", exam_id: 2, exam_title: "Biology", status: "paused" }),
      row({ id: "d", exam_id: 2, exam_title: "Biology", unresolved_alert_count: 1 }),
    ]);

    expect(groups.map((g) => g.title)).toEqual(["Algebra", "Biology"]);
    const biology = groups[1];
    expect(biology.sessions.map((s) => s.id)).toEqual(["a", "c", "d"]);
    expect(biology).toMatchObject({ live: 2, paused: 1, flagged: 2, alerts: 4 });
    expect(groups[0]).toMatchObject({ live: 1, paused: 0, flagged: 0, alerts: 0 });
  });

  it("averages only the candidates that have an EBI and finds the earliest start", () => {
    const [group] = groupSessionsByExam([
      row({ id: "a", ebi_average: 80, started_at: "2026-10-18T09:00:00Z" }),
      row({ id: "b", ebi_average: 60, started_at: "2026-10-18T08:30:00Z" }),
      row({ id: "c", ebi_average: null, started_at: "2026-10-18T10:00:00Z" }),
    ]);
    expect(group.avgEbi).toBe(70);
    expect(group.startedAt).toBe("2026-10-18T08:30:00Z");
  });

  it("has no average when nobody has been scored yet", () => {
    const [group] = groupSessionsByExam([row({ ebi_average: null })]);
    expect(group.avgEbi).toBeNull();
  });

  it("keeps a stable title order whatever the alert counts", () => {
    const groups = groupSessionsByExam([
      row({ exam_id: 1, exam_title: "Zoology", unresolved_alert_count: 9 }),
      row({ exam_id: 2, exam_title: "Art", unresolved_alert_count: 0 }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Art", "Zoology"]);
  });
});

describe("parseExamParam", () => {
  it("accepts a positive integer id", () => {
    expect(parseExamParam("12")).toBe(12);
  });

  it("rejects anything else", () => {
    for (const bad of [null, "", "abc", "0", "-3", "1.5"]) {
      expect(parseExamParam(bad)).toBeNull();
    }
  });
});
