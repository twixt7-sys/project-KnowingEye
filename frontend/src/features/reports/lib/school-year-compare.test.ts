import { describe, expect, it } from "vitest";

import { compareSchoolYears, formatDelta } from "@/features/reports/lib/school-year-compare";
import type { SchoolYearRow } from "@/shared/types/api";

function year(start: number, over: Partial<SchoolYearRow> = {}): SchoolYearRow {
  return {
    school_year: `${start}-${start + 1}`,
    start_year: start,
    period_start: `${start}-06-01`,
    period_end: `${start + 1}-05-31`,
    exams: 2,
    sessions: 10,
    completed_sessions: 9,
    examinees: 8,
    pass_rate: 60,
    average_score: 70,
    average_ebi: 85,
    flagged_sessions: 2,
    flagged_candidates: 2,
    flagged_rate: 20,
    ...over,
  };
}

const byKey = (rows: ReturnType<typeof compareSchoolYears>) =>
  Object.fromEntries(rows.map((r) => [r.key, r]));

describe("compareSchoolYears", () => {
  it("reports deltas in percentage points from the first year to the second", () => {
    const rows = byKey(
      compareSchoolYears(
        year(2024),
        year(2025, { pass_rate: 72.5, average_score: 68, average_ebi: 85, flagged_rate: 10 }),
      ),
    );
    expect(rows.pass_rate.delta).toBe(12.5);
    expect(rows.average_score.delta).toBe(-2);
    expect(rows.average_ebi.delta).toBe(0);
  });

  it("treats a higher pass rate as better and a higher flagged rate as worse", () => {
    const rows = byKey(
      compareSchoolYears(year(2024), year(2025, { pass_rate: 70, flagged_rate: 35 })),
    );
    expect(rows.pass_rate.trend).toBe("better");
    expect(rows.flagged_rate.trend).toBe("worse");
  });

  it("treats a lower flagged rate as better", () => {
    const rows = byKey(compareSchoolYears(year(2024), year(2025, { flagged_rate: 5 })));
    expect(rows.flagged_rate.trend).toBe("better");
    expect(rows.average_score.trend).toBe("same");
  });

  it("has no delta when a year lacks the metric (e.g. no EBI monitoring)", () => {
    const rows = byKey(compareSchoolYears(year(2024, { average_ebi: null }), year(2025)));
    expect(rows.average_ebi.delta).toBeNull();
    expect(rows.average_ebi.trend).toBe("unknown");
  });

  it("does not let float noise read as a change", () => {
    const rows = byKey(
      compareSchoolYears(year(2024, { average_score: 70.1 }), year(2025, { average_score: 70.3 })),
    );
    expect(rows.average_score.delta).toBe(0.2);
  });
});

describe("formatDelta", () => {
  it("signs the value", () => {
    expect(formatDelta(12.5)).toBe("+12.5");
    expect(formatDelta(-2)).toBe("−2.0");
    expect(formatDelta(0)).toBe("0.0");
    expect(formatDelta(null)).toBe("—");
  });
});
