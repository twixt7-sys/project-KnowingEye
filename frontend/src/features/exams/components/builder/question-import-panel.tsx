import { memo, useMemo, useState } from "react";

import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
  XIcon,
} from "@/shared/icons";

import type { ImportCheckStatus } from "@/features/exams/hooks/use-exam-builder";
import {
  CHOICE_LETTERS,
  type ParsedQuestionForm,
  type QuestionFormRow,
} from "@/features/exams/lib/question-import-form";
import {
  type ImportIssue,
  type ImportProblems,
  issuesByRow,
} from "@/features/exams/lib/question-import-issues";

const FIELD_LABELS: Record<string, string> = {
  question_text: "Question",
  question_type: "Type",
  options: "Choices",
  option_images: "Choice images",
  correct_answer: "Correct answer",
  points: "Points",
  row: "Row",
};

const ACCEPT =
  ".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface QuestionImportPanelProps {
  examId: number;
  form: ParsedQuestionForm | null;
  status: ImportCheckStatus;
  problems: ImportProblems;
  importBusy: boolean;
  downloadBusy: boolean;
  onDownloadForm: () => void;
  onFile: (file: File) => void;
  onRecheck: () => void;
  onClear: () => void;
  onImport: () => void;
}

function FilePicker({
  onFile,
  className,
  children,
  droppable = false,
}: {
  onFile: (file: File) => void;
  className: string | ((dragging: boolean) => string);
  children: React.ReactNode;
  droppable?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const dropHandlers = droppable
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        },
      }
    : {};
  return (
    <label
      className={`cursor-pointer ${typeof className === "function" ? className(dragging) : className}`}
      {...dropHandlers}
    >
      {children}
      <input
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {n}
        </span>
        <span className="font-medium text-sm">{title}</span>
      </div>
      {children}
    </li>
  );
}

/** Is this choice the one the row's answer points at (by letter or exact text)? */
function isAnswerChoice(row: QuestionFormRow, index: number) {
  const answer = row.correct_answer.trim();
  const choice = row.options[index];
  if (!answer || !choice) return false;
  return (
    answer.toUpperCase() === CHOICE_LETTERS[index] || answer.toLowerCase() === choice.toLowerCase()
  );
}

function PreviewRow({ row, issues }: { row: QuestionFormRow; issues: ImportIssue[] | undefined }) {
  const bad = new Set(issues?.map((i) => i.field));
  const flag = (field: string) =>
    bad.has(field)
      ? "text-status-alert font-medium underline decoration-wavy decoration-status-alert/60 underline-offset-4"
      : "";
  const hasIssues = Boolean(issues?.length);
  const filledChoices = row.options.map((text, i) => ({ text, i })).filter((c) => c.text);

  return (
    <>
      <tr className={`align-top ${hasIssues ? "bg-status-alert/5" : ""}`}>
        <td
          className={`whitespace-nowrap py-2 pl-3 pr-2 font-mono text-xs ${hasIssues ? "border-l-2 border-status-alert text-status-alert" : "border-l-2 border-transparent text-muted-foreground"}`}
        >
          {row.row}
        </td>
        <td className="px-2 py-2 text-xs text-muted-foreground">{row.number || "-"}</td>
        <td className={`px-2 py-2 min-w-[14rem] max-w-[22rem] ${flag("question_text")}`}>
          <span className="line-clamp-2 whitespace-pre-line">
            {row.question_text || <em className="text-status-alert">missing</em>}
          </span>
        </td>
        <td className={`whitespace-nowrap px-2 py-2 ${flag("question_type")}`}>
          {row.question_type || <em className="text-status-alert">missing</em>}
        </td>
        <td className={`px-2 py-2 min-w-[10rem] ${flag("options")} ${flag("option_images")}`}>
          {filledChoices.length ? (
            <ul className="flex flex-wrap gap-1">
              {filledChoices.map(({ text, i }) => (
                <li
                  key={i}
                  className={`rounded border px-1.5 py-0.5 text-xs ${
                    isAnswerChoice(row, i)
                      ? "border-status-safe/40 bg-status-safe/10 text-status-safe"
                      : "border-border"
                  }`}
                >
                  <span className="font-semibold">{CHOICE_LETTERS[i] ?? i + 1}.</span> {text}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        <td className={`px-2 py-2 max-w-[12rem] ${flag("correct_answer")}`}>
          <span className="line-clamp-2">
            {row.correct_answer || <em className="text-status-alert">missing</em>}
          </span>
        </td>
        <td className={`px-2 py-2 text-center ${flag("points")}`}>{row.points || "1"}</td>
      </tr>
      {hasIssues && (
        <tr className="bg-status-alert/5">
          <td className="border-l-2 border-status-alert" />
          <td colSpan={6} className="px-2 pb-3 pt-0">
            <ul className="space-y-1 text-xs text-status-alert">
              {issues?.map((issue) => (
                <li key={`${issue.field}:${issue.message}`} className="flex gap-1.5">
                  <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-semibold">
                      {FIELD_LABELS[issue.field] ?? issue.field}:
                    </span>{" "}
                    {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBanner({
  status,
  rowCount,
  problemRows,
  problemCount,
}: {
  status: ImportCheckStatus;
  rowCount: number;
  problemRows: number;
  problemCount: number;
}) {
  if (status === "checking") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking every row…
      </p>
    );
  }
  if (status === "valid") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-status-safe">
        <CheckCircle className="h-4 w-4" />
        All {rowCount} question{rowCount === 1 ? "" : "s"} passed - ready to import.
      </p>
    );
  }
  if (status === "invalid") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-status-alert">
        <AlertTriangle className="h-4 w-4" />
        {problemRows > 0
          ? `${problemCount} problem${problemCount === 1 ? "" : "s"} in ${problemRows} row${problemRows === 1 ? "" : "s"} - fix them in the form and upload it again. Nothing has been imported.`
          : "This file can't be imported yet - see below."}
      </p>
    );
  }
  return null;
}

export const QuestionImportPanel = memo(function QuestionImportPanel({
  examId,
  form,
  status,
  problems,
  importBusy,
  downloadBusy,
  onDownloadForm,
  onFile,
  onRecheck,
  onClear,
  onImport,
}: QuestionImportPanelProps) {
  const [onlyProblems, setOnlyProblems] = useState(false);

  const byRow = useMemo(() => issuesByRow(problems.issues), [problems.issues]);
  const rows = form?.rows ?? [];
  const visibleRows = onlyProblems ? rows.filter((r) => byRow.has(r.row)) : rows;
  const examMismatch = form?.formExamId != null && form.formExamId !== examId;

  return (
    <section className="bg-card border border-border rounded-xl">
      <div className="p-6 pb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" /> Import from question form
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Write questions offline in the official entry form, then bring them in all at once. Every
          row is checked before anything is saved.
        </p>
      </div>

      <ol className="grid gap-3 px-6 pb-6 sm:grid-cols-3">
        <Step n={1} title="Download the form">
          <p className="text-xs text-muted-foreground flex-1">
            An Excel form with this exam's details filled in, plus a Guide sheet with examples.
          </p>
          <button
            type="button"
            onClick={onDownloadForm}
            disabled={downloadBusy}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-accent text-sm disabled:opacity-50"
          >
            {downloadBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Question form (.xlsx)
          </button>
        </Step>
        <Step n={2} title="Fill it in">
          <p className="text-xs text-muted-foreground">
            One question per row in Excel or Google Sheets. For multiple choice, fill Choice A, B,
            C… and enter the letter of the correct choice.
          </p>
        </Step>
        <Step n={3} title="Upload it here">
          <FilePicker
            onFile={onFile}
            droppable
            className={(dragging) =>
              `flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
              }`
            }
          >
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-sm">Choose or drop file</span>
            <span className="text-muted-foreground">.xlsx (or .csv)</span>
          </FilePicker>
        </Step>
      </ol>

      {form && (
        <div className="border-t border-border p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <p className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="font-medium truncate">{form.fileName}</span>
                {rows.length > 0 && (
                  <span className="text-muted-foreground shrink-0">
                    · {rows.length} question{rows.length === 1 ? "" : "s"}
                  </span>
                )}
              </p>
              <StatusBanner
                status={status}
                rowCount={rows.length}
                problemRows={byRow.size}
                problemCount={problems.issues.length}
              />
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <XIcon className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {examMismatch && (
            <div className="flex gap-2 rounded-lg border border-status-watch/40 bg-status-watch/10 px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-status-watch" />
              <p>
                This form was downloaded for a different exam
                {form.formExamLabel ? ` (${form.formExamLabel})` : ""}. Make sure you're importing
                into the right exam.
              </p>
            </div>
          )}

          {problems.general.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-status-alert/30 bg-status-alert/5 px-4 py-3 text-sm text-status-alert">
              {problems.general.map((line) => (
                <li key={line} className="flex gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> {line}
                </li>
              ))}
            </ul>
          )}

          {rows.length > 0 && (
            <>
              {byRow.size > 0 && (
                <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                  {[
                    { value: false, label: `All rows (${rows.length})` },
                    { value: true, label: `With problems (${byRow.size})` },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setOnlyProblems(opt.value)}
                      className={`rounded-md px-3 py-1 ${onlyProblems === opt.value ? "bg-accent font-medium" : "text-muted-foreground"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th
                        className="py-2 pl-3 pr-2 font-medium"
                        title="Row number in the spreadsheet"
                      >
                        Row
                      </th>
                      <th className="px-2 py-2 font-medium">No.</th>
                      <th className="px-2 py-2 font-medium">Question</th>
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 font-medium">Choices</th>
                      <th className="px-2 py-2 font-medium">Answer</th>
                      <th className="px-2 py-2 font-medium text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleRows.map((row) => (
                      <PreviewRow key={row.row} row={row} issues={byRow.get(row.row)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                "Row" is the row number shown in Excel - use it to find the line to fix.
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onImport}
              disabled={status !== "valid" || importBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              {importBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              {importBusy
                ? "Importing…"
                : `Import ${rows.length} question${rows.length === 1 ? "" : "s"}`}
            </button>
            <FilePicker
              onFile={onFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm"
            >
              <Upload className="w-4 h-4" />
              {status === "invalid" ? "Upload corrected file" : "Upload a different file"}
            </FilePicker>
            {status === "invalid" && rows.length > 0 && (
              <button
                type="button"
                onClick={onRecheck}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-4 h-4" /> Check again
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
});
