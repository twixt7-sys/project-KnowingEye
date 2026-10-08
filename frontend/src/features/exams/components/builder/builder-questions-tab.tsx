import { memo, useMemo, useState } from "react";

import { Plus, Trash2 } from "@/shared/icons";

import type { Exam, ExamSection, Question, QuestionAttachment } from "@/core/config/api";
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
  status: Exam["status"];
  editable: boolean;
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

const SectionManager = memo(function SectionManager({
  sections,
  editable,
  onAddSection,
  onRenameSection,
  onRemoveSection,
}: {
  sections: ExamSection[];
  editable: boolean;
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
          disabled={!editable}
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
                disabled={!editable}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== s.title) onRenameSection(s.id, value);
                }}
                className="field-input flex-1 py-1"
              />
              {editable && (
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
});

/** Explains why questions are (or aren't) editable whenever it isn't the plain draft case. */
function QuestionLockNotice({ status, editable }: { status: Exam["status"]; editable: boolean }) {
  let text: string | null = null;
  if (status === "active" && editable) {
    text =
      "This exam is published - question changes reach examinees right away. " +
      "Questions lock once the first examinee starts the exam.";
  } else if (status === "active") {
    text =
      "Questions are locked because examinees have already started this exam. " +
      "Archive and duplicate it to make changes.";
  } else if (status === "archived") {
    text = "This exam is archived, so its questions can't be changed.";
  } else if (!editable) {
    text = "An examinee is taking this exam right now. Questions unlock when active sessions finish.";
  }
  if (!text) return null;

  return (
    <div className="px-4 py-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function BuilderQuestionsTab({
  examId,
  questions,
  sections,
  status,
  editable,
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
  const sectionTitleById = useMemo(
    () => new Map(sections.map((s) => [s.id, s.title])),
    [sections]
  );

  return (
    <div className="space-y-6">
      <QuestionLockNotice status={status} editable={editable} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenNew}
          disabled={!editable}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add question
        </button>
      </div>

      <SectionManager
        sections={sections}
        editable={editable}
        onAddSection={onAddSection}
        onRenameSection={onRenameSection}
        onRemoveSection={onRemoveSection}
      />

      <SortableQuestionList
        questions={questions}
        sectionTitleById={sectionTitleById}
        editable={editable}
        onEdit={onEdit}
        onDelete={onDelete}
        onReorder={onReorder}
      />

      {editable && (
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
