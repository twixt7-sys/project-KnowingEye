import * as XLSX from "xlsx";

/** Must match backend `CSV_TEMPLATE_HEADERS` in exams/services.py */
export const QUESTION_IMPORT_HEADERS = [
  "question_text",
  "question_type",
  "options",
  "correct_answer",
  "points",
] as const;

export const QUESTION_IMPORT_EXAMPLE_ROWS: string[][] = [
  [
    "What is 2 + 2?",
    "multiple_choice",
    "3|4|5",
    "4",
    "1",
  ],
  [
    "Water boils at 100 degrees Celsius at sea level.",
    "true_false",
    "",
    "true",
    "1",
  ],
  [
    "Name the largest planet in our solar system.",
    "short_answer",
    "",
    "Jupiter",
    "2",
  ],
  [
    "Explain, in your own words, how photosynthesis works.",
    "essay",
    "",
    "Mentions sunlight, water, and carbon dioxide producing glucose and oxygen",
    "5",
  ],
];

export const CSV_TEMPLATE = [
  QUESTION_IMPORT_HEADERS.join(","),
  ...QUESTION_IMPORT_EXAMPLE_ROWS.map((row) =>
    row
      .map((cell) => (cell.includes(",") ? `"${cell.replace(/"/g, '""')}"` : cell))
      .join(",")
  ),
].join("\n");

const QUESTIONS_SHEET_NAME = "Questions";
const EMPTY_ENTRY_ROWS = 10;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadImportTemplateCsv() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, "exam-questions-template.csv");
}

export function downloadImportTemplateXlsx() {
  const emptyRow = QUESTION_IMPORT_HEADERS.map(() => "");
  const questionsData = [
    [...QUESTION_IMPORT_HEADERS],
    ...QUESTION_IMPORT_EXAMPLE_ROWS,
    ...Array.from({ length: EMPTY_ENTRY_ROWS }, () => [...emptyRow]),
  ];

  const questionsSheet = XLSX.utils.aoa_to_sheet(questionsData);
  questionsSheet["!cols"] = [
    { wch: 52 },
    { wch: 18 },
    { wch: 26 },
    { wch: 34 },
    { wch: 8 },
  ];
  questionsSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["Exam questions import template"],
    [""],
    ["How to use"],
    ["1. Fill in one question per row on the Questions sheet."],
    ["2. Save this file, then upload it back in Exam Builder (no need to export as CSV)."],
    ["3. Review the preview and click Import questions."],
    [""],
    ["Columns"],
    ["question_text", "The question prompt (required)."],
    ["question_type", "multiple_choice, true_false, short_answer, or essay (required)."],
    ["options", "Multiple choice only: choices separated by | (pipe). Leave empty otherwise."],
    ["correct_answer", "Must match an option exactly for multiple choice; true or false for true_false."],
    ["points", "Whole number (defaults to 1 if left blank)."],
    [""],
    ["Tips"],
    ["Leave options empty for true_false, short_answer, and essay questions."],
    ["Imported questions are appended after any existing ones, in row order."],
    ["Delete the example rows if you do not want them imported."],
  ]);
  instructionsSheet["!cols"] = [{ wch: 18 }, { wch: 72 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, questionsSheet, QUESTIONS_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, "exam-questions-template.xlsx");
}

function findQuestionsSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === QUESTIONS_SHEET_NAME.toLowerCase()) ??
    workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The workbook has no worksheets.");
  }
  return workbook.Sheets[sheetName];
}

export async function readImportFileAsCsv(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    return (await file.text()).replace(/^\uFEFF/, "");
  }

  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  ) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = findQuestionsSheet(workbook);
    return XLSX.utils.sheet_to_csv(sheet);
  }

  throw new Error("Unsupported file type. Upload a .xlsx worksheet or .csv file.");
}
