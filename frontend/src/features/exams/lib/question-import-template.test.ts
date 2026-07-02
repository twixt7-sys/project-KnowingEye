import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  CSV_TEMPLATE,
  QUESTION_IMPORT_HEADERS,
  readImportFileAsCsv,
} from "./question-import-template";

describe("question-import-template", () => {
  it("exports a CSV template with the expected header row", () => {
    const firstLine = CSV_TEMPLATE.split("\n")[0];
    expect(firstLine).toBe(QUESTION_IMPORT_HEADERS.join(","));
  });

  it("converts an xlsx worksheet back to importable CSV", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [...QUESTION_IMPORT_HEADERS],
      ["Sample question?", "short_answer", "", "Sample answer", "2"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Questions");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new File([buffer], "questions.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const csv = await readImportFileAsCsv(file);
    expect(csv).toContain("question_text,question_type,options,correct_answer,points");
    expect(csv).toContain("Sample question?");
    expect(csv).toContain("Sample answer");
  });
});
