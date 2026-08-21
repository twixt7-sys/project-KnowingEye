import { useState } from "react";

import { FileText, ImagePlus, Loader2, Trash2, Upload, X } from "@/shared/icons";

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
  onUploadOptionImage: (questionId: number, file: File) => Promise<string>;
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
  onUploadOptionImage,
}: QuestionFormDialogProps) {
  const [optionImageBusy, setOptionImageBusy] = useState<number | null>(null);
  const [optionImageError, setOptionImageError] = useState<string | null>(null);

  if (!open) return null;

  const updateOption = (index: number, patch: Partial<QuestionDraft["options"][number]>) => {
    const options = [...questionDraft.options];
    options[index] = { ...options[index], ...patch };
    setQuestionDraft({ ...questionDraft, options });
  };

  const pickOptionImage = async (index: number, file: File) => {
    if (!editingQuestion) {
      setOptionImageError("Save this question first, then edit it to add option images.");
      return;
    }
    setOptionImageError(null);
    setOptionImageBusy(index);
    try {
      const url = await onUploadOptionImage(editingQuestion.id, file);
      updateOption(index, { image: url });
    } catch {
      setOptionImageError("Could not upload that image. Try a JPEG, PNG, GIF, or WebP under 10 MB.");
    } finally {
      setOptionImageBusy(null);
    }
  };

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
              <p className="text-xs text-muted-foreground">
                Add an image to an option for abstract/psychological items that need image-based
                answer choices rather than plain text.
              </p>
              {optionImageError && <p className="text-xs text-status-alert">{optionImageError}</p>}
              {questionDraft.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    value={opt.text}
                    onChange={(e) => updateOption(i, { text: e.target.value })}
                    placeholder={`Option ${i + 1}`}
                    className="field-input flex-1"
                  />
                  {opt.image ? (
                    <div className="relative shrink-0">
                      <img
                        src={opt.image}
                        alt={`Option ${i + 1} illustration`}
                        className="h-10 w-10 rounded-md border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => updateOption(i, { image: null })}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        aria-label="Remove option image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-border hover:bg-accent/50">
                      {optionImageBusy === i ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={optionImageBusy !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void pickOptionImage(i, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
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
