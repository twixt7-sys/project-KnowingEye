import { describe, expect, it } from "vitest";

import { examPreviewPath, parsePreviewQuestionParam } from "./exam-paths";

describe("examPreviewPath", () => {
  it("links to the exam's preview page", () => {
    expect(examPreviewPath(5)).toBe("/examiner/exams/5/preview");
  });

  it("deep-links to a question", () => {
    expect(examPreviewPath(5, 9)).toBe("/examiner/exams/5/preview?q=9");
  });
});

describe("parsePreviewQuestionParam", () => {
  it("reads a question id", () => {
    expect(parsePreviewQuestionParam("12")).toBe(12);
  });

  it.each([null, "", "abc", "0", "-3", "1.5"])("rejects %j", (raw) => {
    expect(parsePreviewQuestionParam(raw)).toBeNull();
  });
});
