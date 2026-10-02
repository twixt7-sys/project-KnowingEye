import { memo, useEffect, useState } from "react";

import { FileText, ImagePlus, Loader2, Plus, Trash2, Upload, X } from "@/shared/icons";

import type { ExamSection, Question, QuestionAttachment } from "@/core/config/api";
import {
  AttachmentIcon,
  BuilderField,
} from "@/features/exams/components/builder/builder-primitives";
import {
  DOCUMENT_ACCEPT,
  PICTURE_ACCEPT,
  isPictureFile,
  validateAttachment,
} from "@/features/exams/lib/attachment-rules";
import { optionLabel } from "@/features/exams/lib/question-options";
import type { QuestionDraft } from "@/features/exams/schemas/builder-schemas";

const NEW_SECTION_VALUE = "__new_section__";

function SectionSelect({
  value,
  sections,
  onChange,
  onCreateSection,
}: {
  value: number | null;
  sections: ExamSection[];
  onChange: (sectionId: number | null) => void;
  onCreateSection: (title: string) => Promise<ExamSection | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    const section = await onCreateSection(title);
    setCreating(false);
    if (section) {
      onChange(section.id);
      setTitle("");
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <BuilderField label="Section (for in-exam navigation)">
        <select
          value={adding ? NEW_SECTION_VALUE : (value ?? "")}
          onChange={(e) => {
            if (e.target.value === NEW_SECTION_VALUE) {
              setAdding(true);
              return;
            }
            setAdding(false);
            onChange(e.target.value ? Number(e.target.value) : null);
          }}
          className="field-input"
        >
          <option value="">No section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
          <option value={NEW_SECTION_VALUE}>+ Add section…</option>
        </select>
      </BuilderField>
      {adding && (
        <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex-1">
            <BuilderField label="New section title">
              <input
                autoFocus
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void create();
                  }
                }}
                placeholder="e.g. Part A - Vocabulary"
                className="field-input"
              />
            </BuilderField>
          </div>
          <button
            type="button"
            disabled={!title.trim() || creating}
            onClick={() => void create()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => {
              setAdding(false);
              setTitle("");
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function PictureTile({
  src,
  alt,
  label,
  onRemove,
}: {
  src: string | null;
  alt: string;
  label?: string;
  onRemove: () => void;
}) {
  return (
    <li className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
      {src ? (
        <img src={src} alt={alt} className="h-28 w-full object-cover" />
      ) : (
        <div className="h-28 w-full" />
      )}
      {label && (
        <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
        aria-label="Remove picture"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}

function PendingPicture({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <PictureTile src={src} alt={file.name} label="Pending save" onRemove={onRemove} />;
}

interface QuestionFormDialogProps {
  open: boolean;
  editingQuestion: Question | null;
  questionDraft: QuestionDraft;
  setQuestionDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  sections: ExamSection[];
  questionAttachments: QuestionAttachment[];
  pendingFiles: File[];
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>;
  attachmentBusy: boolean;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onAttachmentPick: (files: FileList | null) => void;
  onRemoveAttachment: (attachment: QuestionAttachment) => void;
  onUploadOptionImage: (file: File) => Promise<string>;
  onCreateSection: (title: string) => Promise<ExamSection | null>;
}

export const QuestionFormDialog = memo(function QuestionFormDialog({
  open,
  editingQuestion,
  questionDraft,
  setQuestionDraft,
  sections,
  questionAttachments,
  pendingFiles,
  setPendingFiles,
  attachmentBusy,
  error,
  saving,
  onClose,
  onSave,
  onAttachmentPick,
  onRemoveAttachment,
  onUploadOptionImage,
  onCreateSection,
}: QuestionFormDialogProps) {
  const [optionImageBusy, setOptionImageBusy] = useState<number | null>(null);
  const [optionImageError, setOptionImageError] = useState<string | null>(null);

  if (!open) return null;

  const savedPictures = questionAttachments.filter((a) => a.kind === "image");
  const savedDocuments = questionAttachments.filter((a) => a.kind !== "image");
  const pendingEntries = pendingFiles.map((file, index) => ({ file, index }));
  const pendingPictures = pendingEntries.filter(({ file }) => isPictureFile(file));
  const pendingDocuments = pendingEntries.filter(({ file }) => !isPictureFile(file));

  // Functional updates: an image upload resolves after the user may have kept
  // typing, so it must merge into the latest draft rather than a stale copy.
  const updateOption = (index: number, patch: Partial<QuestionDraft["options"][number]>) => {
    setQuestionDraft((prev) => {
      const options = [...prev.options];
      const before = optionLabel(options[index], index);
      options[index] = { ...options[index], ...patch };
      const after = optionLabel(options[index], index);
      // The correct answer is stored by label, so keep it attached to this
      // choice when its text or picture changes.
      const correct_answer =
        before && prev.correct_answer === before ? after : prev.correct_answer;
      return { ...prev, options, correct_answer };
    });
  };

  const pickOptionImage = async (index: number, file: File) => {
    const problem = validateAttachment(file) ?? (isPictureFile(file) ? null : `"${file.name}" isn't a picture.`);
    if (problem) {
      setOptionImageError(problem);
      return;
    }
    setOptionImageError(null);
    setOptionImageBusy(index);
    try {
      const url = await onUploadOptionImage(file);
      updateOption(index, { image: url });
    } catch {
      setOptionImageError("Could not upload that image. Try a JPEG, PNG, GIF, or WebP under 10 MB.");
    } finally {
      setOptionImageBusy(null);
    }
  };

  const correctIndex = questionDraft.options.findIndex(
    (opt, i) => optionLabel(opt, i) !== "" && optionLabel(opt, i) === questionDraft.correct_answer
  );

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

          <SectionSelect
            value={questionDraft.section ?? null}
            sections={sections}
            onChange={(section) => setQuestionDraft((prev) => ({ ...prev, section }))}
            onCreateSection={onCreateSection}
          />

          {questionDraft.question_type === "multiple_choice" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Options</p>
              <p className="text-xs text-muted-foreground">
                A choice can be text, a picture, or both. Leave the text empty if the picture says
                it all.
              </p>
              {optionImageError && <p className="text-xs text-status-alert">{optionImageError}</p>}
              {questionDraft.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    value={opt.text}
                    onChange={(e) => updateOption(i, { text: e.target.value })}
                    placeholder={opt.image ? `Option ${i + 1} (picture only)` : `Option ${i + 1}`}
                    className="field-input flex-1"
                  />
                  {opt.image ? (
                    <div className="relative shrink-0">
                      <img
                        src={opt.image}
                        alt={`Option ${i + 1} illustration`}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-14 rounded-md border border-border object-cover"
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
                    <label
                      title="Add a picture to this choice"
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-border hover:bg-accent/50"
                    >
                      {optionImageBusy === i ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        accept={PICTURE_ACCEPT}
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
              <BuilderField label="Correct option">
                <select
                  value={correctIndex >= 0 ? String(correctIndex) : ""}
                  onChange={(e) =>
                    setQuestionDraft((prev) => ({
                      ...prev,
                      correct_answer:
                        e.target.value === ""
                          ? ""
                          : optionLabel(prev.options[Number(e.target.value)], Number(e.target.value)),
                    }))
                  }
                  className="field-input"
                >
                  <option value="">Select…</option>
                  {questionDraft.options.map((opt, i) => {
                    const label = optionLabel(opt, i);
                    if (!label) return null;
                    return (
                      <option key={i} value={i}>
                        {opt.text.trim() ? label : `${label} (picture)`}
                      </option>
                    );
                  })}
                </select>
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Question picture</p>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, GIF or WebP, up to 10 MB each. Shown to examinees above the question
                  text.
                </p>
              </div>
              <label
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent/50 ${
                  attachmentBusy ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {attachmentBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {attachmentBusy ? "Uploading…" : "Add picture"}
                <input
                  type="file"
                  accept={PICTURE_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={attachmentBusy}
                  onChange={(e) => {
                    void onAttachmentPick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {(savedPictures.length > 0 || pendingPictures.length > 0) && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {savedPictures.map((a) => (
                  <PictureTile
                    key={a.id}
                    src={a.url}
                    alt={a.caption || "Question picture"}
                    onRemove={() => void onRemoveAttachment(a)}
                  />
                ))}
                {pendingPictures.map(({ file, index }) => (
                  <PendingPicture
                    key={`pending-picture-${index}`}
                    file={file}
                    onRemove={() => setPendingFiles((prev) => prev.filter((_, j) => j !== index))}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Other attachments (PDF, audio)</p>
            <p className="text-xs text-muted-foreground">Max 10 MB each. PDF, MP3 or WAV.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 hover:bg-accent/50">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {attachmentBusy ? "Uploading…" : "Click to add files"}
              </span>
              <input
                type="file"
                accept={DOCUMENT_ACCEPT}
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
              {savedDocuments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded border px-3 py-2">
                  <AttachmentIcon kind={a.kind} />
                  <span className="flex-1 truncate">{a.caption || a.url.split("/").pop()}</span>
                  <button
                    type="button"
                    onClick={() => void onRemoveAttachment(a)}
                    className="text-status-alert hover:opacity-80"
                    aria-label="Remove attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {pendingDocuments.map(({ file, index }) => (
                <li
                  key={`pending-file-${index}`}
                  className="flex items-center gap-2 rounded border px-3 py-2"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">pending save</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== index))}
                    className="text-status-alert"
                    aria-label="Remove pending file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-status-alert/40 bg-status-alert/10 px-3 py-2 text-sm text-status-alert"
            >
              {error}
            </p>
          )}

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
});
