import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  QuestionFormError,
  buildQuestionFormWorkbook,
  parseCsv,
  parseQuestionFormWorkbook,
  parseQuestionImportFile,
} from "./question-import-form";
import { extractImportProblems, issuesByRow } from "./question-import-issues";

const EXAM = {
  id: 42,
  title: "Midterm Biology",
  exam_code: "IIT-2026-A",
  department: { name: "IIT" },
};

async function roundTrip(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);
  return parseQuestionFormWorkbook(reloaded, "form.xlsx");
}

function findHeaderRow(sheet: ExcelJS.Worksheet) {
  let header = -1;
  sheet.eachRow((row, n) => {
    if (header === -1 && row.getCell(2).value === "Question *") header = n;
  });
  return header;
}

describe("question form", () => {
  it("builds a styled form with letterhead, details, and a guide sheet", () => {
    const wb = buildQuestionFormWorkbook(ExcelJS, EXAM);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Questions", "Guide"]);
    const sheet = wb.getWorksheet("Questions")!;
    expect(sheet.getCell(5, 1).value).toBe("EXAM QUESTION ENTRY FORM");
    const header = findHeaderRow(sheet);
    expect(header).toBeGreaterThan(5);
    expect(sheet.getCell(header + 1, 1).value).toBe(1);
    expect(sheet.getCell(header + 1, 3).dataValidation?.type).toBe("list");
    expect(wb.keywords).toContain("exam-42");
  });

  it("reads filled rows back with their real sheet row numbers", async () => {
    const wb = buildQuestionFormWorkbook(ExcelJS, EXAM);
    const sheet = wb.getWorksheet("Questions")!;
    const header = findHeaderRow(sheet);
    // Row 1: multiple choice; row 2 left blank; row 3: true/false typed as an Excel boolean.
    sheet.getRow(header + 1).values = [
      1,
      "Capital of France?",
      "Multiple Choice",
      "London",
      "Paris",
      "",
      "",
      "",
      "B",
      2,
    ];
    sheet.getRow(header + 3).values = [
      3,
      "The sun is a star.",
      "True/False",
      "",
      "",
      "",
      "",
      "",
      true,
    ];

    const parsed = await roundTrip(wb);
    expect(parsed.formExamId).toBe(42);
    expect(parsed.rows).toHaveLength(2);
    const [mc, tf] = parsed.rows;
    expect(mc).toMatchObject({
      row: header + 1,
      number: "1",
      question_type: "Multiple Choice",
      correct_answer: "B",
      points: "2",
    });
    expect(mc.options).toEqual(["London", "Paris", "", "", ""]);
    expect(tf).toMatchObject({ row: header + 3, correct_answer: "True" });
  });

  it("rejects a workbook whose column headings were removed", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Questions").addRow(["just", "some", "cells"]);
    await expect(roundTrip(wb)).rejects.toBeInstanceOf(QuestionFormError);
  });

  it("still accepts the legacy CSV columns", async () => {
    const csv =
      "question_text,question_type,options,option_images,correct_answer,points\n" +
      '"What is 2 + 2, exactly?",multiple_choice,3|4|5,,4,1\n\n' +
      "Water boils at 100C.,true_false,,,true,1\n";
    const file = new File([csv], "old.csv", { type: "text/csv" });
    const parsed = await parseQuestionImportFile(file);
    expect(parsed.rows.map((r) => r.row)).toEqual([2, 4]);
    expect(parsed.rows[0].question_text).toBe("What is 2 + 2, exactly?");
    expect(parsed.rows[0].options).toEqual(["3", "4", "5"]);
  });

  it("parses quoted CSV fields with escaped quotes and newlines", () => {
    expect(parseCsv('a,"b ""c""","d\ne"\r\n1,2,3')).toEqual([
      ["a", 'b "c"', "d\ne"],
      ["1", "2", "3"],
    ]);
  });
});

describe("import issues", () => {
  it("unwraps the API error envelope into row issues", () => {
    const err = {
      payload: {
        success: false,
        error: {
          details: {
            errors: ["Row 16: Correct answer is D, but only choices A-B are filled in."],
            issues: [{ row: "16", field: "correct_answer", message: "Correct answer is D..." }],
          },
        },
      },
    };
    const problems = extractImportProblems(err);
    expect(problems.general).toEqual([]);
    expect(issuesByRow(problems.issues).get(16)?.[0].field).toBe("correct_answer");
  });
});
