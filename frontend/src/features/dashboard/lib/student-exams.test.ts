import { describe, expect, it } from "vitest";

import type { Exam } from "@/core/config/api";
import {
  filterAvailableExams,
  isTakeable,
  paginate,
  sortAvailableExams,
  toAvailableCard,
} from "@/features/dashboard/lib/student-exams";

function exam(overrides: Partial<Exam> & { id: number; title: string }): Exam {
  return {
    description: "",
    duration_minutes: 60,
    total_questions: 10,
    passing_score: 50,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const algebra = exam({
  id: 1,
  title: "Algebra Midterm",
  exam_code: "MATH-101",
  created_by_name: "Prof. Rivera",
  monitoring_enabled: true,
  duration_minutes: 90,
  created_at: "2026-03-01T00:00:00Z",
  available_until: "2026-06-01T00:00:00Z",
});
const biology = exam({
  id: 2,
  title: "Biology Quiz",
  exam_code: "BIO-200",
  created_by_name: "Dr. Chen",
  monitoring_enabled: false,
  duration_minutes: 30,
  created_at: "2026-02-01T00:00:00Z",
  available_until: "2026-04-01T00:00:00Z",
});
const chemistry = exam({
  id: 3,
  title: "Chemistry 10",
  exam_code: "CHEM-110",
  duration_minutes: 45,
  created_at: "2026-04-01T00:00:00Z",
  available_until: null,
});
const chemistry2 = exam({ id: 4, title: "Chemistry 2", created_at: "2026-01-15T00:00:00Z" });

const all = [algebra, biology, chemistry, chemistry2];
const titles = (list: Exam[]) => list.map((e) => e.title);

describe("isTakeable", () => {
  it("hides closed exams and exams with no attempts left", () => {
    expect(isTakeable(exam({ id: 9, title: "x" }))).toBe(true);
    expect(isTakeable(exam({ id: 9, title: "x", is_open: false }))).toBe(false);
    expect(isTakeable(exam({ id: 9, title: "x", attempts_remaining: 0 }))).toBe(false);
    expect(isTakeable(exam({ id: 9, title: "x", attempts_remaining: null }))).toBe(true);
  });
});

describe("filterAvailableExams", () => {
  it("returns everything for an empty search and the all filter", () => {
    expect(filterAvailableExams(all, { search: "  ", proctoring: "all" })).toHaveLength(4);
  });

  it("matches title, exam code and author case-insensitively", () => {
    expect(titles(filterAvailableExams(all, { search: "ALGEBRA", proctoring: "all" }))).toEqual([
      "Algebra Midterm",
    ]);
    expect(titles(filterAvailableExams(all, { search: "bio-200", proctoring: "all" }))).toEqual([
      "Biology Quiz",
    ]);
    expect(titles(filterAvailableExams(all, { search: "rivera", proctoring: "all" }))).toEqual([
      "Algebra Midterm",
    ]);
  });

  it("splits proctored from open; unset monitoring counts as proctored", () => {
    expect(titles(filterAvailableExams(all, { search: "", proctoring: "open" }))).toEqual([
      "Biology Quiz",
    ]);
    expect(titles(filterAvailableExams(all, { search: "", proctoring: "proctored" }))).toEqual([
      "Algebra Midterm",
      "Chemistry 10",
      "Chemistry 2",
    ]);
  });

  it("combines search with the proctoring filter", () => {
    expect(filterAvailableExams(all, { search: "chem", proctoring: "open" })).toEqual([]);
  });
});

describe("sortAvailableExams", () => {
  it("sorts by creation date in both directions", () => {
    expect(titles(sortAvailableExams(all, "-created_at"))).toEqual([
      "Chemistry 10",
      "Algebra Midterm",
      "Biology Quiz",
      "Chemistry 2",
    ]);
    expect(titles(sortAvailableExams(all, "created_at"))[0]).toBe("Chemistry 2");
  });

  it("sorts titles naturally, so Chemistry 2 precedes Chemistry 10", () => {
    expect(titles(sortAvailableExams(all, "title"))).toEqual([
      "Algebra Midterm",
      "Biology Quiz",
      "Chemistry 2",
      "Chemistry 10",
    ]);
  });

  it("sorts by duration", () => {
    expect(sortAvailableExams(all, "duration_minutes").map((e) => e.duration_minutes)).toEqual([
      30, 45, 60, 90,
    ]);
  });

  it("puts exams with no deadline last, whichever direction is chosen", () => {
    const asc = titles(sortAvailableExams(all, "available_until"));
    expect(asc.slice(0, 2)).toEqual(["Biology Quiz", "Algebra Midterm"]);
    expect(asc.slice(2).sort()).toEqual(["Chemistry 10", "Chemistry 2"]);

    const desc = titles(sortAvailableExams(all, "-available_until"));
    expect(desc.slice(0, 2)).toEqual(["Algebra Midterm", "Biology Quiz"]);
    expect(desc.slice(2).sort()).toEqual(["Chemistry 10", "Chemistry 2"]);
  });

  it("does not mutate its input", () => {
    const input = [...all];
    sortAvailableExams(input, "title");
    expect(input).toEqual(all);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    expect(paginate(items, 1, 10)).toEqual({ page: 1, items: items.slice(0, 10) });
    expect(paginate(items, 3, 10)).toEqual({ page: 3, items: [21, 22, 23, 24, 25] });
  });

  it("clamps a page past the end back to the last page", () => {
    expect(paginate(items, 9, 10).page).toBe(3);
    expect(paginate(items, 9, 10).items).toEqual([21, 22, 23, 24, 25]);
  });

  it("handles an empty list", () => {
    expect(paginate([], 4, 10)).toEqual({ page: 1, items: [] });
  });
});

describe("toAvailableCard", () => {
  it("labels attempts and accommodation time", () => {
    expect(toAvailableCard(exam({ id: 5, title: "x", attempts_remaining: 2 })).attemptsLabel).toBe(
      "2 attempt(s) left",
    );
    expect(toAvailableCard(exam({ id: 5, title: "x" })).attemptsLabel).toBe("Unlimited attempts");
    expect(toAvailableCard(exam({ id: 5, title: "x", extra_time_minutes: 15 })).extraTime).toBe(
      "+15 min accommodation",
    );
  });
});
