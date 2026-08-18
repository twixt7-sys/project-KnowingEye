import { FileText, Trash2, Upload } from "@/shared/icons";

import type { Question, QuestionAttachment } from "@/core/config/api";
import {
  AttachmentIcon,
  BuilderField,
} from "@/features/exams/components/builder/builder-primitives";
import type { QuestionDraft } from "@/features/exams/schemas/builder-schemas";

interface QuestionFormDialogProps {
  open: boolean;
  editingQuestion: Question | null;
  questionDraft: QuestionDraft;
  setQuestionDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  questionAttachments: QuestionAttachment[];
  pendingFiles: File[];
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>;
  attachmentBusy: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onAttachmentPick: (files: FileList | null) => void;
  onRemoveAttachment: (attachment: QuestionAttachment) => void;
}

export function QuestionFormDialog({
  open,
  editingQuestion,
  questionDraft,
  setQuestionDraft,
  questionAttachments,
  pendingFiles,
  setPendingFiles,
  attachmentBusy,
  saving,
  onClose,
  onSave,
  onAttachmentPick,
  onRemoveAttachment,
}: QuestionFormDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        <h3 className="text-xl font-semibold mb-4">
          {editingQuestion ? "Edit question" : "Add question"}
        </h3>
        <div className="space-y-4">
          <BuilderField label="Question text">
            <textarea
              rows={3}
              value={questionDraft.question_text}
              onChange={(e) =>
                setQuestionDraft({ ...questionDraft, question_text: e.target.value })
              }
              className="field-input"
            />
          </BuilderField>
          <div className="grid grid-cols-2 gap-4">
            <BuilderField label="Type">
              <select
                value={questionDraft.question_type}
                onChange={(e) =>
                  setQuestionDraft({
                    ...questionDraft,
                    question_type: e.target.value as Question["question_type"],
                    correct_answer: "",
                  })
                }
                className="field-input"
              >
                <option value="multiple_choice">Multiple choice</option>
                <option value="true_false">True / false</option>
                <option value="short_answer">Short answer</option>
                <option value="essay">Essay</option>
              </select>
            </BuilderField>
            <BuilderField label="Points">
              <input
                type="number"
                min={1}
                value={questionDraft.points}
                onChange={(e) =>
                  setQuestionDraft({ ...questionDraft, points: Number(e.target.value) })
                }
                className="field-input"
              />
            </BuilderField>
          </div>

          {questionDraft.question_type === "multiple_choice" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Options</p>
              {questionDraft.options.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => {
                    const options = [...questionDraft.options];
                    options[i] = e.target.value;
                    setQuestionDraft({ ...questionDraft, options });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="field-input"
                />
              ))}
              <BuilderField label="Correct option (must match text exactly)">
                <input
                  value={questionDraft.correct_answer}
                  onChange={(e) =>
                    setQuestionDraft({ ...questionDraft, correct_answer: e.target.value })
                  }
                  className="field-input"
                />
              </BuilderField>
            </div>
          )}

          {questionDraft.question_type === "true_false" && (
            <BuilderField label="Correct answer">
              <select
                value={questionDraft.correct_answer}
                onChange={(e) =>
                  setQuestionDraft({ ...questionDraft, correct_answer: e.target.value })
                }
                className="field-input"
              >
                <option value="">Select…</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </BuilderField>
          )}

          {(questionDraft.question_type === "short_answer" ||
            questionDraft.question_type === "essay") && (
            <BuilderField label="Model answer / rubric key">
              <textarea
                rows={2}
                value={questionDraft.correct_answer}
                onChange={(e) =>
                  setQuestionDraft({ ...questionDraft, correct_answer: e.target.value })
                }
                className="field-input"
              />
            </BuilderField>
          )}

          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Attachments (image, PDF, audio)</p>
            <p className="text-xs text-muted-foreground">
              Max 10 MB each. Shown to examinees above the question text.
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 hover:bg-accent/50">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {attachmentBusy ? "Uploading…" : "Click to add files"}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf,audio/mpeg,audio/wav,audio/*"
                multiple
                className="hidden"
                disabled={attachmentBusy}
                onChange={(e) => {
                  void onAttachmentPick(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <ul className="space-y-2 text-sm">
              {questionAttachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded border px-3 py-2">
                  <AttachmentIcon kind={a.kind} />
                  <span className="flex-1 truncate">{a.caption || a.url.split("/").pop()}</span>
                  {editingQuestion && (
                    <button
                      type="button"
                      onClick={() => void onRemoveAttachment(a)}
                      className="text-status-alert hover:opacity-80"
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
              {pendingFiles.map((f, i) => (
                <li key={`pending-${i}`} className="flex items-center gap-2 rounded border px-3 py-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">pending save</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-status-alert"
                    aria-label="Remove pending file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              {saving ? "Saving…" : "Save question"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
