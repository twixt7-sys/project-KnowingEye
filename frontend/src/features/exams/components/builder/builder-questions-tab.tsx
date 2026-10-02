import { useState } from "react";

import { Plus, Trash2 } from "@/shared/icons";

import type { ExamSection, Question, QuestionAttachment } from "@/core/config/api";
import { BuilderField } from "@/features/exams/components/builder/builder-primitives";
import { QuestionFormDialog } from "@/features/exams/components/builder/question-form-dialog";
import { QuestionImportPanel } from "@/features/exams/components/builder/question-import-panel";
import { SortableQuestionList } from "@/features/exams/components/builder/sortable-question-list";
import type { ImportCheckStatus } from "@/features/exams/hooks/use-exam-builder";
import type { ParsedQuestionForm } from "@/features/exams/lib/question-import-form";
import type { ImportProblems } from "@/features/exams/lib/question-import-issues";
import type { QuestionDraft } from "@/features/exams/schemas/builder-schemas";

interface BuilderQuestionsTabProps {
  examId: number;
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
  questionError: string | null;
  importForm: ParsedQuestionForm | null;
  importStatus: ImportCheckStatus;
  importProblems: ImportProblems;
  importBusy: boolean;
  formDownloadBusy: boolean;
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
  onUploadOptionImage: (file: File) => Promise<string>;
  onCreateSection: (title: string) => Promise<ExamSection | null>;
  onDownloadImportForm: () => void;
  onImportFile: (file: File) => void;
  onRecheckImport: () => void;
  onClearImport: () => void;
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
  examId,
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
  questionError,
  importForm,
  importStatus,
  importProblems,
  importBusy,
  formDownloadBusy,
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
  onCreateSection,
  onDownloadImportForm,
  onImportFile,
  onRecheckImport,
  onClearImport,
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
        <QuestionImportPanel
          examId={examId}
          form={importForm}
          status={importStatus}
          problems={importProblems}
          importBusy={importBusy}
          downloadBusy={formDownloadBusy}
          onDownloadForm={onDownloadImportForm}
          onFile={onImportFile}
          onRecheck={onRecheckImport}
          onClear={onClearImport}
          onImport={onRunImport}
        />
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
        error={questionError}
        saving={saving}
        onClose={onCloseQuestionForm}
        onSave={onSaveQuestion}
        onAttachmentPick={onAttachmentPick}
        onRemoveAttachment={onRemoveAttachment}
        onUploadOptionImage={onUploadOptionImage}
        onCreateSection={onCreateSection}
      />
    </div>
  );
}
