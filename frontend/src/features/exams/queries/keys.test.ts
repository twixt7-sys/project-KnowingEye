import { describe, expect, it } from "vitest";

import { examBuilderKeys, examPreviewKeys } from "./keys";

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

describe("examPreviewKeys", () => {
  it("is scoped per exam", () => {
    expect(examPreviewKeys.detail(5)).toEqual(["exam-preview", 5]);
    expect(examPreviewKeys.detail(1)).not.toEqual(examPreviewKeys.detail(2));
  });

  it("stays outside the builder's key prefix, so builder invalidations can't refetch a preview", () => {
    const [root] = examPreviewKeys.detail(5);
    expect(root).not.toBe(examBuilderKeys.all[0]);
  });
});
