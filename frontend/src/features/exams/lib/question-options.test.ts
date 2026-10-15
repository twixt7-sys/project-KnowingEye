import { describe, expect, it } from "vitest";

import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  addOption,
  duplicateOptionIndexes,
  hasOptionContent,
  optionLabel,
  optionsToDraft,
  optionsToPayload,
  removeOption,
} from "@/features/exams/lib/question-options";

const IMG = "https://api.example.com/media/a.png";

const rows = (...texts: string[]) => texts.map((text) => ({ text, image: null }));

describe("addOption", () => {
  it("appends an empty row", () => {
    const next = addOption({ options: rows("A", "B"), correct_answer: "A" });
    expect(next.options).toEqual([...rows("A", "B"), { text: "", image: null }]);
    expect(next.correct_answer).toBe("A");
  });

  it("stops at the maximum", () => {
    const full = { options: rows(...Array.from({ length: MAX_OPTIONS }, (_, i) => `C${i}`)), correct_answer: "" };
    expect(addOption(full)).toBe(full);
  });
});

describe("removeOption", () => {
  it("removes the row and keeps the correct answer on its row", () => {
    const next = removeOption({ options: rows("A", "B", "C"), correct_answer: "C" }, 0);
    expect(next.options.map((o) => o.text)).toEqual(["B", "C"]);
    expect(next.correct_answer).toBe("C");
  });

  it("clears the correct answer when its own row is removed", () => {
    const next = removeOption({ options: rows("A", "B", "C"), correct_answer: "B" }, 1);
    expect(next.options.map((o) => o.text)).toEqual(["A", "C"]);
    expect(next.correct_answer).toBe("");
  });

  it("re-points a picture-only correct answer when an earlier row is removed", () => {
    const next = removeOption(
      { options: [...rows("A", "B"), { text: "", image: IMG }], correct_answer: "Option 3" },
      0
    );
    expect(next.correct_answer).toBe("Option 2");
    expect(optionLabel(next.options[1], 1)).toBe("Option 2");
  });

  it("leaves a picture-only correct answer alone when a later row is removed", () => {
    const next = removeOption(
      { options: [{ text: "", image: IMG }, ...rows("B", "C")], correct_answer: "Option 1" },
      2
    );
    expect(next.correct_answer).toBe("Option 1");
  });

  it("keeps an unset correct answer unset", () => {
    expect(removeOption({ options: rows("A", "B", "C"), correct_answer: "" }, 1).correct_answer).toBe("");
  });

  it("will not go below the minimum", () => {
    const min = { options: rows(...Array.from({ length: MIN_OPTIONS }, (_, i) => `C${i}`)), correct_answer: "C0" };
    expect(removeOption(min, 0)).toBe(min);
  });
});

describe("duplicateOptionIndexes", () => {
  it("flags rows that read the same, ignoring case and spacing", () => {
    expect([...duplicateOptionIndexes(rows("Paris", "London", " paris "))]).toEqual([0, 2]);
  });

  it("ignores empty rows and distinct picture-only rows", () => {
    expect(
      duplicateOptionIndexes([...rows("", ""), { text: "", image: IMG }, { text: "", image: IMG }]).size
    ).toBe(0);
  });

  it("flags typed text that collides with a generated picture label", () => {
    expect([...duplicateOptionIndexes([{ text: "Option 2", image: null }, { text: "", image: IMG }])]).toEqual([0, 1]);
  });
});

describe("optionLabel", () => {
  it("prefers the typed text", () => {
    expect(optionLabel({ text: "  Circle ", image: IMG }, 0)).toBe("Circle");
  });

  it("labels a picture-only choice by its row", () => {
    expect(optionLabel({ text: "", image: IMG }, 2)).toBe("Option 3");
  });

  it("returns an empty label for an empty row", () => {
    expect(optionLabel({ text: " ", image: null }, 0)).toBe("");
  });
});

describe("hasOptionContent", () => {
  it("accepts text or a picture, but not neither", () => {
    expect(hasOptionContent({ text: "A", image: null })).toBe(true);
    expect(hasOptionContent({ text: "", image: IMG })).toBe(true);
    expect(hasOptionContent({ text: "  ", image: null })).toBe(false);
  });
});

describe("optionsToPayload", () => {
  it("keeps picture-only choices, labels them, and drops empty rows", () => {
    expect(
      optionsToPayload([
        { text: "Square", image: null },
        { text: "", image: null },
        { text: "", image: IMG },
      ])
    ).toEqual([
      { text: "Square", image: null },
      { text: "Option 3", image: IMG },
    ]);
  });
});

describe("optionsToDraft", () => {
  it("blanks generated labels and re-points the correct answer at the new row", () => {
    const { options, correct_answer } = optionsToDraft(
      [
        { text: "Square", image: null },
        { text: "Option 3", image: IMG },
      ],
      "Option 3"
    );
    expect(options).toEqual([
      { text: "Square", image: null },
      { text: "", image: IMG },
    ]);
    expect(correct_answer).toBe("Option 2");
  });

  it("leaves typed text alone, even when it has a picture", () => {
    const { options, correct_answer } = optionsToDraft(
      [{ text: "Circle", image: IMG }, { text: "Square", image: null }],
      "Circle"
    );
    expect(options[0]).toEqual({ text: "Circle", image: IMG });
    expect(correct_answer).toBe("Circle");
  });

  it("does not treat a text-only 'Option 2' as generated", () => {
    const { options } = optionsToDraft([{ text: "Option 2", image: null }], "Option 2");
    expect(options[0].text).toBe("Option 2");
  });
});
