import { useState } from "react";

import { AlertTriangle, Download, Plus, Trash2, Upload } from "@/shared/icons";

import type { ExamSection, Question, QuestionAttachment } from "@/core/config/api";
import { BuilderField } from "@/features/exams/components/builder/builder-primitives";
import { QuestionFormDialog } from "@/features/exams/components/builder/question-form-dialog";
import { SortableQuestionList } from "@/features/exams/components/builder/sortable-question-list";
import {
  downloadImportTemplateCsv,
  downloadImportTemplateXlsx,
} from "@/features/exams/lib/question-import-template";
import type { QuestionDraft } from "@/features/exams/schemas/builder-schemas";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";

interface BuilderQuestionsTabProps {
  questions: Question[];
  sections: ExamSection[];
  isDraft: boolean;
  saving: boolean;
  showQuestionForm: boolean;
  editingQuestion: Question | null;
  questionDraft: QuestionDraft;
  setQuestionDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  questionAttachments: QuestionAttachment[];
  pendingFiles: File[];
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>;
  attachmentBusy: boolean;
  importCsv: string;
  setImportCsv: (value: string) => void;
  importErrors: string[];
  importBusy: boolean;
  onOpenNew: () => void;
  onAddSection: (title: string, instructions?: string) => void;
  onRenameSection: (sectionId: number, title: string) => void;
  onRemoveSection: (sectionId: number, title: string) => void;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
  onReorder: (questionIds: number[]) => void;
  onCloseQuestionForm: () => void;
  onSaveQuestion: () => void;
  onAttachmentPick: (files: FileList | null) => void;
  onRemoveAttachment: (attachment: QuestionAttachment) => void;
  onUploadOptionImage: (questionId: number, file: File) => Promise<string>;
  onImportFile: (file: File) => void;
  onRunImport: () => void;
}

function SectionManager({
  sections,
  isDraft,
  onAddSection,
  onRenameSection,
  onRemoveSection,
}: {
  sections: ExamSection[];
  isDraft: boolean;
  onAddSection: (title: string, instructions?: string) => void;
  onRenameSection: (sectionId: number, title: string) => void;
  onRemoveSection: (sectionId: number, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Sections</h3>
        <button
          type="button"
          disabled={!isDraft}
          onClick={() => setOpen((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-50"
        >
          {open ? "Close" : "Manage sections"}
        </button>
      </div>

      {sections.length > 0 && (
        <ul className="space-y-1.5">
          {sections.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <input
                defaultValue={s.title}
                disabled={!isDraft}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== s.title) onRenameSection(s.id, value);
                }}
                className="field-input flex-1 py-1"
              />
              {isDraft && (
                <button
                  type="button"
                  onClick={() => onRemoveSection(s.id, s.title)}
                  className="text-status-alert hover:opacity-80"
                  aria-label={`Remove section ${s.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sections.length === 0 && !open && (
        <p className="text-xs text-muted-foreground">
          No sections yet - questions present as a flat list to examinees.
        </p>
      )}

      {open && (
        <div className="flex items-end gap-2 pt-2 border-t border-border">
          <BuilderField label="New section title">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Part A - Vocabulary"
              className="field-input"
            />
          </BuilderField>
          <button
            type="button"
            disabled={!newTitle.trim()}
            onClick={() => {
              onAddSection(newTitle);
              setNewTitle("");
            }}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

export function BuilderQuestionsTab({
  questions,
  sections,
  isDraft,
  saving,
  showQuestionForm,
  editingQuestion,
  questionDraft,
  setQuestionDraft,
  questionAttachments,
  pendingFiles,
  setPendingFiles,
  attachmentBusy,
  importCsv,
  setImportCsv,
  importErrors,
  importBusy,
  onOpenNew,
  onAddSection,
  onRenameSection,
  onRemoveSection,
  onEdit,
  onDelete,
  onReorder,
  onCloseQuestionForm,
  onSaveQuestion,
  onAttachmentPick,
  onRemoveAttachment,
  onUploadOptionImage,
  onImportFile,
  onRunImport,
}: BuilderQuestionsTabProps) {
  const sectionTitleById = new Map(sections.map((s) => [s.id, s.title]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenNew}
          disabled={!isDraft}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add question
        </button>
      </div>

      <SectionManager
        sections={sections}
        isDraft={isDraft}
        onAddSection={onAddSection}
        onRenameSection={onRenameSection}
        onRemoveSection={onRemoveSection}
      />

      <SortableQuestionList
        questions={questions}
        sectionTitleById={sectionTitleById}
        isDraft={isDraft}
        onEdit={onEdit}
        onDelete={onDelete}
        onReorder={onReorder}
      />

      {isDraft && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4" /> Bulk import from spreadsheet
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Download the worksheet template, fill in one question per row in Excel or Google
              Sheets, then upload the file back here (or paste CSV rows below).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadImportTemplateXlsx}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm"
            >
              <Download className="w-4 h-4" /> Download worksheet (.xlsx)
            </button>
            <button
              type="button"
              onClick={downloadImportTemplateCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm"
            >
              <Download className="w-4 h-4" /> Download CSV template
            </button>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm cursor-pointer">
              <Upload className="w-4 h-4" /> Upload worksheet or CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <ResizablePanelGroup direction="horizontal" className="min-h-[280px] rounded-lg border">
            <ResizablePanel defaultSize={60} minSize={35}>
              <div className="h-full p-4">
                <label className="block text-sm h-full">
                  <span className="mb-1 block text-muted-foreground">
                    Import preview (edit or paste CSV rows here)
                  </span>
                  <textarea
                    rows={10}
                    value={importCsv}
                    spellCheck={false}
                    onChange={(e) => setImportCsv(e.target.value)}
                    className="field-input font-mono text-xs h-[calc(100%-1.5rem)] min-h-[200px] resize-none"
                  />
                </label>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={25}>
              <div className="h-full p-4 overflow-y-auto">
                <div className="grid gap-3 text-xs">
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <p className="font-medium text-foreground">Columns</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      <li>
                        <code>question_text</code> — the question (required)
                      </li>
                      <li>
                        <code>question_type</code> — multiple_choice, true_false, short_answer, or
                        essay
                      </li>
                      <li>
                        <code>options</code> — choices separated by <code>|</code> (multiple choice
                        only)
                      </li>
                      <li>
                        <code>option_images</code> — optional, one image URL per option separated by{" "}
                        <code>|</code> (upload the image first via the question editor to get a URL,
                        leave a segment blank for a text-only option)
                      </li>
                      <li>
                        <code>correct_answer</code> — must match an option's text exactly; use true /
                        false for true_false
                      </li>
                      <li>
                        <code>points</code> — whole number (defaults to 1)
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-1.5">
                    <p className="font-medium text-foreground">Tips</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      <li>
                        Leave <code>options</code> empty for non–multiple-choice questions.
                      </li>
                      <li>
                        Upload the filled <code>.xlsx</code> worksheet directly — no need to export
                        as CSV.
                      </li>
                      <li>Questions are added after existing ones, in row order.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-status-alert/30 bg-status-alert/5 p-4">
              <p className="font-medium text-status-alert mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Fix {importErrors.length} issue{importErrors.length === 1 ? "" : "s"} and import
                again
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1 text-status-alert max-h-48 overflow-y-auto">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={onRunImport}
            disabled={importBusy}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {importBusy ? "Importing…" : "Import questions"}
          </button>
        </div>
      )}

      <QuestionFormDialog
        open={showQuestionForm}
        editingQuestion={editingQuestion}
        questionDraft={questionDraft}
        setQuestionDraft={setQuestionDraft}
        sections={sections}
        questionAttachments={questionAttachments}
        pendingFiles={pendingFiles}
        setPendingFiles={setPendingFiles}
        attachmentBusy={attachmentBusy}
        saving={saving}
        onClose={onCloseQuestionForm}
        onSave={onSaveQuestion}
        onAttachmentPick={onAttachmentPick}
        onRemoveAttachment={onRemoveAttachment}
        onUploadOptionImage={onUploadOptionImage}
      />
    </div>
  );
}
