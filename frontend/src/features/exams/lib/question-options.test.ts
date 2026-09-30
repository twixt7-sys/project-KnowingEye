import { describe, expect, it } from "vitest";

import {
  hasOptionContent,
  optionLabel,
  optionsToDraft,
  optionsToPayload,
} from "@/features/exams/lib/question-options";

const IMG = "https://api.example.com/media/a.png";

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
