/**
 * Exam question entry form - the styled Excel workbook examiners download,
 * fill in, and upload back into the Exam Builder.
 *
 * The workbook reads like a formal institutional form: a letterhead with the
 * institution and department logos, a title band, an exam-details block, an
 * instructions panel, then a numbered entry table (one question per row).
 * A second "Guide" sheet documents every column with worked examples.
 *
 * On upload, `parseQuestionImportFile` locates the entry table's header row
 * (wherever it ended up), reads each non-blank row, and keeps its real sheet
 * row number so validation errors point at the row the examiner sees in
 * Excel. The backend owns validation (`validate_question_import`); this
 * module only extracts cells.
 *
 * ExcelJS is loaded on demand so it stays out of the main bundle.
 */
import type ExcelJSNamespace from "exceljs";
import type { Borders, Cell, CellValue, Fill, Font, Workbook, Worksheet } from "exceljs";

import { brand } from "@/core/config/brand";
import type { Exam } from "@/shared/types/api";

type ExcelJS = typeof ExcelJSNamespace;

export const CHOICE_LETTERS = ["A", "B", "C", "D", "E"] as const;

export const QUESTION_TYPE_LABELS = [
  "Multiple Choice",
  "True/False",
  "Short Answer",
  "Essay",
] as const;

/** Identifies the workbook as ours; the exam id rides along so imports can warn on a mismatch. */
const FORM_KEYWORD = "knowing-eye-question-form";
const FORM_VERSION = "QF-2";
const QUESTIONS_SHEET = "Questions";
const GUIDE_SHEET = "Guide";
const ENTRY_ROWS = 100;

type ColumnKey =
  | "number"
  | "question_text"
  | "question_type"
  | `choice_${(typeof CHOICE_LETTERS)[number]}`
  | "options"
  | "correct_answer"
  | "points"
  | "option_images";

interface FormColumn {
  key: ColumnKey;
  header: string;
  width: number;
}

const FORM_COLUMNS: FormColumn[] = [
  { key: "number", header: "No.", width: 6 },
  { key: "question_text", header: "Question *", width: 50 },
  { key: "question_type", header: "Type *", width: 17 },
  ...CHOICE_LETTERS.map(
    (letter): FormColumn => ({ key: `choice_${letter}`, header: `Choice ${letter}`, width: 18 }),
  ),
  { key: "correct_answer", header: "Correct Answer *", width: 22 },
  { key: "points", header: "Points", width: 8 },
  { key: "option_images", header: "Choice Images (optional)", width: 24 },
];
const LAST_COL = FORM_COLUMNS.length;

/**
 * Header spellings accepted on import, after `normalizeHeader`. Includes the
 * legacy CSV keys so older templates and scripted CSVs still import.
 */
const HEADER_ALIASES: Record<string, ColumnKey> = {
  no: "number",
  "#": "number",
  item: "number",
  question: "question_text",
  "question text": "question_text",
  type: "question_type",
  "question type": "question_type",
  options: "options",
  choices: "options",
  "correct answer": "correct_answer",
  answer: "correct_answer",
  "answer key": "correct_answer",
  points: "points",
  pts: "points",
  "choice images": "option_images",
  "option images": "option_images",
  ...Object.fromEntries(
    CHOICE_LETTERS.flatMap((letter) => [
      [`choice ${letter.toLowerCase()}`, `choice_${letter}` as ColumnKey],
      [`option ${letter.toLowerCase()}`, `choice_${letter}` as ColumnKey],
    ]),
  ),
};

/* ------------------------------------------------------------------------ */
/* Palette (brand green / gold, matching the app's logo mark)                */
/* ------------------------------------------------------------------------ */

const COLOR = {
  green: "FF166534",
  greenSoft: "FFECF6EF",
  zebra: "FFF6FAF7",
  gold: "FFEAB308",
  ink: "FF1F2937",
  muted: "FF6B7280",
  rule: "FFCBD5D1",
  inputFill: "FFFFFDF2",
  white: "FFFFFFFF",
};

const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = (argb = COLOR.rule): Partial<Borders> => ({
  top: { style: "thin", color: { argb } },
  left: { style: "thin", color: { argb } },
  bottom: { style: "thin", color: { argb } },
  right: { style: "thin", color: { argb } },
});
const font = (overrides: Partial<Font> = {}): Partial<Font> => ({
  name: "Calibri",
  size: 10,
  color: { argb: COLOR.ink },
  ...overrides,
});

/* ------------------------------------------------------------------------ */
/* Export                                                                    */
/* ------------------------------------------------------------------------ */

export interface QuestionFormExam {
  id: number;
  title: string;
  exam_code?: string | null;
  department?: Pick<NonNullable<Exam["department"]>, "name"> | null;
}

export interface QuestionFormLogos {
  institution?: string | null;
  department?: string | null;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const LOGO_PX = 64;

/** Place a logo in a column (0-based), flush left or right within it. */
function addLogo(
  workbook: Workbook,
  sheet: Worksheet,
  base64: string | null | undefined,
  col: number,
  align: "left" | "right",
) {
  if (!base64) return;
  const imageId = workbook.addImage({ base64, extension: "png" });
  // Column width is in characters; ~7px each plus padding at the default font.
  const colPx = (sheet.getColumn(col + 1).width ?? 9) * 7 + 5;
  const offset = align === "left" ? 0.1 : Math.max(0, 1 - (LOGO_PX + 6) / colPx);
  sheet.addImage(imageId, {
    tl: { col: col + offset, row: 0.15 },
    ext: { width: LOGO_PX, height: LOGO_PX },
    editAs: "absolute",
  });
}

/** Letterhead + title band shared by both sheets. Returns the next free row. */
function drawLetterhead(
  workbook: Workbook,
  sheet: Worksheet,
  logos: QuestionFormLogos,
  title: string,
  lastCol: number,
): number {
  const merge = (row: number) => sheet.mergeCells(row, 2, row, lastCol - 1);

  const lines: [string, Partial<Font>, number][] = [
    [
      brand.institutionName.toUpperCase(),
      font({ size: 15, bold: true, color: { argb: COLOR.green } }),
      22,
    ],
    [brand.institutionUnit, font({ size: 11, italic: true, color: { argb: COLOR.muted } }), 16],
    [`${brand.appName}  ·  ${brand.tagline}`, font({ size: 9, color: { argb: COLOR.muted } }), 15],
  ];
  lines.forEach(([text, f, height], index) => {
    const row = index + 1;
    merge(row);
    const cell = sheet.getCell(row, 2);
    cell.value = text;
    cell.font = f;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(row).height = height;
  });
  sheet.getRow(4).height = 8;

  addLogo(workbook, sheet, logos.institution, 0, "left");
  addLogo(workbook, sheet, logos.department, lastCol - 1, "right");

  sheet.mergeCells(5, 1, 5, lastCol);
  const band = sheet.getCell(5, 1);
  band.value = title;
  band.font = font({ size: 14, bold: true, color: { argb: COLOR.white } });
  band.fill = solid(COLOR.green);
  band.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(5).height = 28;

  sheet.mergeCells(6, 1, 6, lastCol);
  sheet.getCell(6, 1).fill = solid(COLOR.gold);
  sheet.getRow(6).height = 4;
  sheet.getRow(7).height = 8;
  return 8;
}

function styleTableHeader(cell: Cell) {
  cell.font = font({ bold: true, color: { argb: COLOR.white } });
  cell.fill = solid(COLOR.green);
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = thin(COLOR.green);
}

function sectionHeading(sheet: Worksheet, row: number, text: string, lastCol: number) {
  sheet.mergeCells(row, 1, row, lastCol);
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  cell.font = font({ size: 11, bold: true, color: { argb: COLOR.green } });
  cell.border = { bottom: { style: "medium", color: { argb: COLOR.green } } };
  sheet.getRow(row).height = 20;
}

function buildQuestionsSheet(
  workbook: Workbook,
  exam: QuestionFormExam,
  logos: QuestionFormLogos,
  generatedAt: Date,
) {
  const sheet = workbook.addWorksheet(QUESTIONS_SHEET, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLOR.green } },
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L&8${brand.appName} · Exam Question Entry Form (${FORM_VERSION})&C&8Page &P of &N&R&8${exam.exam_code ?? ""}`,
    },
  });
  sheet.columns = FORM_COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  let row = drawLetterhead(workbook, sheet, logos, "EXAM QUESTION ENTRY FORM", LAST_COL);

  // Exam details: label (right-aligned) + value field, two pairs per line.
  const details: [string, string, boolean][][] = [
    [
      ["Exam Title", exam.title, false],
      ["Exam Code", exam.exam_code || "-", false],
    ],
    [
      ["Department", exam.department?.name || "-", false],
      ["Form Generated", formatDate(generatedAt), false],
    ],
    [
      ["Prepared By", "", true],
      ["Date Prepared", "", true],
    ],
  ];
  for (const pairs of details) {
    const spans: [number, number, number][] = [
      [2, 3, 6],
      [7, 9, LAST_COL],
    ];
    pairs.forEach(([label, value, isInput], index) => {
      const [labelCol, valueStart, valueEnd] = spans[index];
      if (index === 1) sheet.mergeCells(row, labelCol, row, valueStart - 1);
      const labelCell = sheet.getCell(row, labelCol);
      labelCell.value = `${label.toUpperCase()}:`;
      labelCell.font = font({ size: 9, bold: true, color: { argb: COLOR.muted } });
      labelCell.alignment = { horizontal: "right", vertical: "middle" };

      sheet.mergeCells(row, valueStart, row, valueEnd);
      const valueCell = sheet.getCell(row, valueStart);
      valueCell.value = value;
      valueCell.font = font({ size: 11, bold: !isInput });
      valueCell.alignment = { vertical: "middle", indent: 1 };
      valueCell.border = { bottom: { style: "thin", color: { argb: COLOR.ink } } };
      if (isInput) valueCell.fill = solid(COLOR.inputFill);
    });
    sheet.getRow(row).height = 20;
    row += 1;
  }

  row += 1;
  sheet.mergeCells(row, 1, row, LAST_COL);
  const instructions = sheet.getCell(row, 1);
  instructions.value = {
    richText: [
      { text: "INSTRUCTIONS  ", font: font({ bold: true, color: { argb: COLOR.green } }) },
      {
        text:
          "Enter one question per row, starting at No. 1. Fields marked * are required. " +
          "Pick the Type from the dropdown. Multiple Choice: fill Choice A, B, C... in order " +
          "(at least two) and enter the LETTER of the correct choice (e.g. B). " +
          "True/False: enter True or False. Short Answer: enter the expected answer. " +
          "Essay: enter the grading guide or key points. Leave unused rows blank. " +
          "Do not rename or move the column headings. See the Guide sheet for examples.",
        font: font(),
      },
    ],
  };
  instructions.fill = solid(COLOR.greenSoft);
  instructions.alignment = { wrapText: true, vertical: "middle", indent: 1 };
  instructions.border = { left: { style: "thick", color: { argb: COLOR.green } } };
  sheet.getRow(row).height = 54;
  row += 2;

  const headerRow = row;
  FORM_COLUMNS.forEach((column, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = column.header;
    styleTableHeader(cell);
  });
  sheet.getRow(headerRow).height = 30;

  const typeList = `"${QUESTION_TYPE_LABELS.join(",")}"`;
  for (let n = 1; n <= ENTRY_ROWS; n += 1) {
    const r = headerRow + n;
    const entry = sheet.getRow(r);
    entry.height = 30;
    FORM_COLUMNS.forEach((column, index) => {
      const cell = entry.getCell(index + 1);
      cell.border = thin();
      cell.font = font();
      cell.alignment = { vertical: "top", wrapText: true };
      if (n % 2 === 0) cell.fill = solid(COLOR.zebra);
      if (column.key === "number") {
        cell.value = n;
        cell.font = font({ color: { argb: COLOR.muted } });
        cell.alignment = { horizontal: "center", vertical: "top" };
      } else if (column.key === "points") {
        cell.alignment = { horizontal: "center", vertical: "top" };
        cell.dataValidation = {
          type: "whole",
          operator: "greaterThanOrEqual",
          allowBlank: true,
          formulae: [0],
          showErrorMessage: true,
          errorTitle: "Points",
          error: "Points must be a whole number (0 or more). Leave blank for 1 point.",
        };
      } else {
        // Store as text so Excel never turns "3/4" into a date or drops leading zeros.
        cell.numFmt = "@";
      }
      if (column.key === "question_type") {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [typeList],
          showErrorMessage: true,
          errorTitle: "Question type",
          error: `Choose one of: ${QUESTION_TYPE_LABELS.join(", ")}.`,
          showInputMessage: true,
          promptTitle: "Question type",
          prompt: "Pick from the list.",
        };
      }
      if (column.key === "correct_answer") {
        // A permissive length rule - it exists to carry the input prompt.
        cell.dataValidation = {
          type: "textLength",
          operator: "lessThanOrEqual",
          formulae: [2000],
          allowBlank: true,
          showInputMessage: true,
          promptTitle: "Correct answer",
          prompt:
            "Multiple Choice: the letter (A-E). True/False: True or False. Otherwise: the answer key.",
        };
      }
    });
  }

  const lastRow = headerRow + ENTRY_ROWS;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(LAST_COL).letter}${lastRow}`;
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  return headerRow;
}

function buildGuideSheet(workbook: Workbook, logos: QuestionFormLogos) {
  const lastCol = 4;
  const sheet = workbook.addWorksheet(GUIDE_SHEET, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLOR.gold } },
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.columns = [{ width: 20 }, { width: 28 }, { width: 44 }, { width: 34 }];

  let row = drawLetterhead(workbook, sheet, logos, "FORM GUIDE", lastCol);

  const widthOf = (from: number, to: number) => {
    let chars = 0;
    for (let c = from; c <= to; c += 1) chars += sheet.getColumn(c).width ?? 9;
    return chars;
  };

  /** A styled table; a row shorter than the header stretches its last cell to the edge. */
  const table = (heading: string, header: string[], rows: string[][]) => {
    sectionHeading(sheet, row, heading, lastCol);
    row += 1;
    const writeRow = (values: string[], style: (cell: Cell, col: number) => void) => {
      let lines = 1;
      values.forEach((text, i) => {
        const col = i + 1;
        const end = i === values.length - 1 ? lastCol : col;
        if (end > col) sheet.mergeCells(row, col, row, end);
        const cell = sheet.getCell(row, col);
        cell.value = text;
        style(cell, col);
        lines = Math.max(lines, Math.ceil((text.length * 1.1) / widthOf(col, end)));
      });
      sheet.getRow(row).height = Math.max(18, lines * 13 + 5);
      row += 1;
    };
    writeRow(header, (cell) => styleTableHeader(cell));
    rows.forEach((values, rIndex) => {
      writeRow(values, (cell, col) => {
        cell.font = font({ bold: col === 1 });
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = thin();
        if (rIndex % 2 === 1) cell.fill = solid(COLOR.zebra);
      });
    });
    row += 1;
  };

  sectionHeading(sheet, row, "HOW TO USE THIS FORM", lastCol);
  row += 1;
  const steps = [
    "1.  Fill in the Questions sheet - one question per row. Rows left blank are skipped.",
    "2.  Save the file as .xlsx (Excel or Google Sheets > Download > Microsoft Excel).",
    "3.  In the Exam Builder, open Questions > Import from question form and upload the file.",
    "4.  The builder checks every row. Rows with problems are listed with their sheet row number - fix them here and upload again.",
    "5.  When every row passes, click Import. Questions are added after the exam's existing questions, in row order.",
  ];
  for (const step of steps) {
    sheet.mergeCells(row, 1, row, lastCol);
    const cell = sheet.getCell(row, 1);
    cell.value = step;
    cell.font = font();
    cell.alignment = { wrapText: true, vertical: "middle", indent: 1 };
    sheet.getRow(row).height = step.length * 1.1 > widthOf(1, lastCol) ? 30 : 18;
    row += 1;
  }
  row += 1;

  table(
    "COLUMNS",
    ["Column", "Required", "What to enter", "Notes"],
    [
      [
        "No.",
        "-",
        "Pre-numbered for reference.",
        "Not imported; errors refer to the Excel row number.",
      ],
      [
        "Question",
        "Yes",
        "The question exactly as examinees should see it.",
        "Line breaks (Alt+Enter) are kept.",
      ],
      ["Type", "Yes", "Multiple Choice, True/False, Short Answer, or Essay.", "Use the dropdown."],
      [
        "Choice A - E",
        "Multiple Choice",
        "Answer choices, filled in order from A.",
        "At least two. Leave empty for other types.",
      ],
      [
        "Correct Answer",
        "Yes",
        "MC: the letter (A-E). True/False: True or False. Short Answer: the expected answer. Essay: the grading guide.",
        "MC also accepts the exact text of a choice.",
      ],
      ["Points", "No", "Whole number, 0 or more.", "Blank means 1 point."],
      [
        "Choice Images",
        "No",
        "Image URLs for choices, separated by | in the same order as the choices.",
        "Upload images in the question editor first to get a URL. Leave a segment blank for a text-only choice.",
      ],
    ],
  );

  table(
    "EXAMPLES",
    ["Type", "Correct Answer", "Question / Choices", "Why it works"],
    [
      [
        "Multiple Choice",
        "B",
        "What is 2 + 2?   A: 3   B: 4   C: 5",
        "B is the letter of the correct choice.",
      ],
      ["True/False", "True", "Water boils at 100 °C at sea level.", "Choices stay empty."],
      [
        "Short Answer",
        "Jupiter",
        "Name the largest planet in our solar system.",
        "Answers are compared to this key.",
      ],
      [
        "Essay",
        "Mentions sunlight, water and CO2 producing glucose and oxygen.",
        "Explain how photosynthesis works.",
        "Essays are graded manually against this guide.",
      ],
    ],
  );

  table(
    "IMPORT RULES",
    ["Rule", "Details"],
    [
      ["All or nothing", "If any row has a problem, nothing is imported until it is fixed."],
      [
        "Keep the headings",
        "Don't rename, delete, or reorder the column headings on the Questions sheet.",
      ],
      [
        "More rows",
        "Need more than 100 questions? Insert rows inside the table, or upload a second form.",
      ],
    ],
  );
}

/** Build the styled question form workbook. Exposed separately for tests. */
export function buildQuestionFormWorkbook(
  ExcelJS: ExcelJS,
  exam: QuestionFormExam,
  logos: QuestionFormLogos = {},
  generatedAt = new Date(),
): Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = brand.appName;
  workbook.company = brand.institutionName;
  workbook.title = `Exam Question Entry Form - ${exam.title}`;
  workbook.subject = exam.exam_code ? `${exam.title} (${exam.exam_code})` : exam.title;
  workbook.keywords = `${FORM_KEYWORD};${FORM_VERSION};exam-${exam.id}`;
  workbook.created = generatedAt;

  buildQuestionsSheet(workbook, exam, logos, generatedAt);
  buildGuideSheet(workbook, logos);
  workbook.views = [
    { x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" },
  ];
  return workbook;
}

/** Rasterize a logo (SVG or bitmap) to a PNG data URL ExcelJS can embed. */
async function loadLogoPng(url: string, size = 192): Promise<string | null> {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const scale = Math.min(size / (img.naturalWidth || size), size / (img.naturalHeight || size));
    const w = (img.naturalWidth || size) * scale;
    const h = (img.naturalHeight || size) * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null; // The form is still usable without a logo.
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function downloadQuestionForm(exam: QuestionFormExam) {
  const [{ default: ExcelJS }, institution, department] = await Promise.all([
    import("exceljs"),
    loadLogoPng(brand.institutionLogo),
    loadLogoPng(brand.departmentLogo),
  ]);
  const workbook = buildQuestionFormWorkbook(ExcelJS, exam, { institution, department });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const name = slugify(exam.exam_code || exam.title) || "exam";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `question-form-${name}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ------------------------------------------------------------------------ */
/* Import                                                                    */
/* ------------------------------------------------------------------------ */

export interface QuestionFormRow {
  /** Row number in the uploaded sheet (or line in a CSV) - what errors refer to. */
  row: number;
  /** The form's "No." cell, when present. */
  number: string;
  question_text: string;
  question_type: string;
  /** Choices in column order (A, B, C...), blanks kept so gaps can be reported. */
  options: string[];
  option_images: string;
  correct_answer: string;
  points: string;
}

export interface ParsedQuestionForm {
  fileName: string;
  rows: QuestionFormRow[];
  /** Exam the form was downloaded for, when the file is one of our forms. */
  formExamId: number | null;
  formExamLabel: string | null;
}

/** A file-level problem (wrong file, missing headings) - not tied to a row. */
export class QuestionFormError extends Error {}

interface GridRow {
  rowNumber: number;
  cells: string[];
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[*:.]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}

export function cellToText(value: CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value)
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    if ("result" in value) return cellToText(value.result as CellValue);
    if ("text" in value) return cellToText(value.text as CellValue);
    if ("error" in value) return String(value.error);
  }
  return String(value).trim();
}

function rowsFromGrid(grid: GridRow[], source: "sheet" | "csv"): QuestionFormRow[] {
  const headerIndex = grid.findIndex((r) => {
    const keys = new Set(r.cells.map((c) => HEADER_ALIASES[normalizeHeader(c)]));
    return keys.has("question_text") && keys.has("question_type");
  });
  if (headerIndex === -1) {
    throw new QuestionFormError(
      source === "sheet"
        ? "Couldn't find the question table in this file - the column headings (Question, Type, Choice A...) are missing or were renamed. Download a fresh question form and copy your questions into it."
        : "This CSV has no header row naming the columns (question_text, question_type, options, correct_answer, points). Download the question form to get the exact format.",
    );
  }

  const columnOf = new Map<ColumnKey, number>();
  grid[headerIndex].cells.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)];
    if (key && !columnOf.has(key)) columnOf.set(key, index);
  });
  const get = (cells: string[], key: ColumnKey) => {
    const index = columnOf.get(key);
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };
  const choiceKeys = CHOICE_LETTERS.map((l) => `choice_${l}` as ColumnKey).filter((k) =>
    columnOf.has(k),
  );

  const rows: QuestionFormRow[] = [];
  for (const { rowNumber, cells } of grid.slice(headerIndex + 1)) {
    const options = choiceKeys.length
      ? choiceKeys.map((key) => get(cells, key))
      : get(cells, "options")
          .split("|")
          .map((s) => s.trim())
          .filter((s, i, all) => s || i < all.length - 1);
    const row: QuestionFormRow = {
      row: rowNumber,
      number: get(cells, "number"),
      question_text: get(cells, "question_text"),
      question_type: get(cells, "question_type"),
      options,
      option_images: get(cells, "option_images"),
      correct_answer: get(cells, "correct_answer"),
      points: get(cells, "points"),
    };
    const hasContent =
      row.question_text ||
      row.question_type ||
      row.correct_answer ||
      row.points ||
      row.option_images ||
      row.options.some(Boolean);
    if (hasContent) rows.push(row);
  }
  return rows;
}

/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function parseQuestionFormWorkbook(
  workbook: Workbook,
  fileName: string,
): Promise<ParsedQuestionForm> {
  const sheet =
    workbook.worksheets.find((ws) => ws.name.toLowerCase() === QUESTIONS_SHEET.toLowerCase()) ??
    workbook.worksheets[0];
  if (!sheet) throw new QuestionFormError("The workbook has no worksheets.");

  const grid: GridRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(row.cellCount, LAST_COL); c += 1) {
      cells.push(cellToText(row.getCell(c).value));
    }
    grid.push({ rowNumber, cells });
  });

  const keywords = workbook.keywords ?? "";
  const examMatch = keywords.includes(FORM_KEYWORD) ? /exam-(\d+)/.exec(keywords) : null;
  return {
    fileName,
    rows: rowsFromGrid(grid, "sheet"),
    formExamId: examMatch ? Number(examMatch[1]) : null,
    formExamLabel: examMatch ? workbook.subject || null : null,
  };
}

export async function parseQuestionImportFile(file: File): Promise<ParsedQuestionForm> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const grid = parseCsv(await file.text()).map((cells, i) => ({ rowNumber: i + 1, cells }));
    return {
      fileName: file.name,
      rows: rowsFromGrid(grid, "csv"),
      formExamId: null,
      formExamLabel: null,
    };
  }

  if (name.endsWith(".xls")) {
    throw new QuestionFormError(
      "Old .xls workbooks aren't supported. In Excel, use File > Save As > Excel Workbook (.xlsx) and upload that.",
    );
  }

  if (
    name.endsWith(".xlsx") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new QuestionFormError(
        "This file couldn't be opened as an Excel workbook. Make sure it's saved as .xlsx and isn't password-protected.",
      );
    }
    return parseQuestionFormWorkbook(workbook, file.name);
  }

  throw new QuestionFormError(
    "Unsupported file type. Upload the completed question form (.xlsx) or a .csv file.",
  );
}

/** Shape sent to `POST /exams/:id/questions/import/` as `questions[]`. */
export function toImportPayload(rows: QuestionFormRow[]) {
  return rows.map(({ number: _number, ...rest }) => rest);
}
