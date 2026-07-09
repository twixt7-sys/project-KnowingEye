import { describe, expect, it } from "vitest";

import { examBuilderKeys } from "./keys";

describe("examBuilderKeys", () => {
  it("builds stable root and detail keys", () => {
    expect(examBuilderKeys.all).toEqual(["exam-builder"]);
    expect(examBuilderKeys.detail(42)).toEqual(["exam-builder", 42]);
  });

  it("scopes nested resources under the exam id", () => {
    expect(examBuilderKeys.questions(7)).toEqual(["exam-builder", 7, "questions"]);
    expect(examBuilderKeys.readiness(7)).toEqual(["exam-builder", 7, "readiness"]);
    expect(examBuilderKeys.assignments(7)).toEqual(["exam-builder", 7, "assignments"]);
  });

  it("returns distinct keys per exam id", () => {
    expect(examBuilderKeys.detail(1)).not.toEqual(examBuilderKeys.detail(2));
    expect(examBuilderKeys.questions(1)).not.toEqual(examBuilderKeys.questions(2));
  });
});
