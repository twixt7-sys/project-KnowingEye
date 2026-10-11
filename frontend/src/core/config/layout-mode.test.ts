import { describe, expect, it } from "vitest";

import { getLayoutMode } from "./layout-mode";

const staff = { isAuthenticated: true, isStaff: true, isStudent: false };
const student = { isAuthenticated: true, isStaff: false, isStudent: true };

describe("getLayoutMode - exam preview", () => {
  it("gives the examiner's student-view preview a bare layout", () => {
    expect(getLayoutMode("/examiner/exams/5/preview", staff)).toBe("preview");
    expect(getLayoutMode("/examiner/exams/5/preview/", staff)).toBe("preview");
  });

  it("keeps the rest of the examiner exam pages in the workspace layout", () => {
    expect(getLayoutMode("/examiner/exams/5/edit", staff)).toBe("examiner");
    expect(getLayoutMode("/examiner/exams/5/grading", staff)).toBe("examiner");
  });

  it("does not give students the preview layout", () => {
    expect(getLayoutMode("/examiner/exams/5/preview", student)).not.toBe("preview");
  });
});
