import type { SchoolYearRow } from "@/shared/types/api";

export type MetricKey = "pass_rate" | "average_score" | "average_ebi" | "flagged_rate";

export interface MetricSpec {
  key: MetricKey;
  label: string;
  /** Whether a higher number is the better outcome (flagged rate: lower is better). */
  higherIsBetter: boolean;
}

export const COMPARISON_METRICS: MetricSpec[] = [
  { key: "pass_rate", label: "Pass rate", higherIsBetter: true },
  { key: "average_score", label: "Average score", higherIsBetter: true },
  { key: "average_ebi", label: "Average EBI", higherIsBetter: true },
  { key: "flagged_rate", label: "Flagged rate", higherIsBetter: false },
];

export interface MetricComparison extends MetricSpec {
  from: number | null;
  to: number | null;
  /** `to - from` in percentage points, or null when either year lacks the metric. */
  delta: number | null;
  trend: "better" | "worse" | "same" | "unknown";
}

/** Compare two school years metric by metric; `delta` is `to` minus `from`. */
export function compareSchoolYears(from: SchoolYearRow, to: SchoolYearRow): MetricComparison[] {
  return COMPARISON_METRICS.map((spec) => {
    const a = from[spec.key];
    const b = to[spec.key];
    if (a == null || b == null) {
      return { ...spec, from: a ?? null, to: b ?? null, delta: null, trend: "unknown" };
    }
    // Rounded so 0.1 + 0.2 style float noise never reads as a change.
    const delta = Math.round((b - a) * 10) / 10;
    const improved = spec.higherIsBetter ? delta > 0 : delta < 0;
    const trend = delta === 0 ? "same" : improved ? "better" : "worse";
    return { ...spec, from: a, to: b, delta, trend };
  });
}

export function formatDelta(delta: number | null): string {
  if (delta == null) return "—";
  if (delta === 0) return "0.0";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}`;
}
