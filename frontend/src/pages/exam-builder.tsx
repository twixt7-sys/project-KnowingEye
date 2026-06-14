import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import {
  apiClient,
  type Exam,
  type PublishReadiness,
  type Question,
} from "../core/config/api";

type Tab = "settings" | "questions" | "publish";

type ExamForm = {
  title: string;
  description: string;
  instructions: string;
  exam_code: string;
  duration_minutes: number;
  passing_score: number;
  max_attempts: number;
  available_from: string;
  available_until: string;
};

type QuestionDraft = {
  question_text: string;
  question_type: Question["question_type"];
  options: string[];
  correct_answer: string;
  points: number;
};

const EMPTY_QUESTION: QuestionDraft = {
  question_text: "",
  question_type: "multiple_choice",
  options: ["", "", "", ""],
  correct_answer: "",
  points: 1,
};

const CSV_TEMPLATE = `question_text,question_type,options,correct_answer,points
What is 2 + 2?,multiple_choice,3|4|5,4,1
The earth is round.,true_false,,true,1
Define photosynthesis in one sentence.,short_answer,,process by which plants make food,2`;

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

function examToForm(exam: Exam): ExamForm {
  return {
    title: exam.title,
    description: exam.description ?? "",
    instructions: exam.instructions ?? "",
    exam_code: exam.exam_code ?? "",
    duration_minutes: exam.duration_minutes,
    passing_score: exam.passing_score,
    max_attempts: exam.max_attempts ?? 1,
    available_from: toDatetimeLocal(exam.available_from),
    available_until: toDatetimeLocal(exam.available_until),
  };
}

export function ExamBuilder() {
  const { examId } = useParams();
  const id = Number(examId);

  const [tab, setTab] = useState<Tab>("settings");
  const [exam, setExam] = useState<Exam | null>(null);
  const [form, setForm] = useState<ExamForm | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [readiness, setReadiness] = useState<PublishReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(EMPTY_QUESTION);
  const [importCsv, setImportCsv] = useState(CSV_TEMPLATE);
  const [importBusy, setImportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || Number.isNaN(id)) return;
    setLoading(true);
    setError(null);
    try {
      const [examData, questionList, readinessData] = await Promise.all([
        apiClient.getExam(id),
        apiClient.listQuestions(id),
        apiClient.getExamReadiness(id),
      ]);
      setExam(examData);
      setForm(examToForm(examData));
      setQuestions(questionList.sort((a, b) => a.order - b.order));
      setReadiness(readinessData);
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to load exam");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isDraft = exam?.status === "draft";
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points || 0), 0),
    [questions]
  );

  const saveSettings = async () => {
    if (!form || !exam) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiClient.updateExam(exam.id, {
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        exam_code: form.exam_code || null,
        duration_minutes: form.duration_minutes,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
        available_from: toIsoOrNull(form.available_from),
        available_until: toIsoOrNull(form.available_until),
      });
      setExam(updated);
      setForm(examToForm(updated));
      setMessage("Exam settings saved.");
      await load();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const openNewQuestion = () => {
    setEditingQuestion(null);
    setQuestionDraft({ ...EMPTY_QUESTION, options: ["", "", "", ""] });
    setShowQuestionForm(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionDraft({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options?.length ? [...q.options] : ["", ""],
      correct_answer: q.correct_answer ?? "",
      points: q.points,
    });
    setShowQuestionForm(true);
  };

  const saveQuestion = async () => {
    if (!exam) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        question_text: questionDraft.question_text,
        question_type: questionDraft.question_type,
        options:
          questionDraft.question_type === "multiple_choice"
            ? questionDraft.options.filter((o) => o.trim())
            : [],
        correct_answer: questionDraft.correct_answer,
        points: questionDraft.points,
      };
      if (editingQuestion) {
        await apiClient.updateQuestion(exam.id, editingQuestion.id, payload);
      } else {
        await apiClient.createQuestion(exam.id, payload);
      }
      setShowQuestionForm(false);
      await load();
      setMessage(editingQuestion ? "Question updated." : "Question added.");
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Could not save question");
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (q: Question) => {
    if (!exam || !confirm(`Delete question ${q.order}?`)) return;
    try {
      await apiClient.deleteQuestion(exam.id, q.id);
      await load();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Delete failed");
    }
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    if (!exam) return;
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const ids = [...questions];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      const reordered = await apiClient.reorderQuestions(
        exam.id,
        ids.map((q) => q.id)
      );
      setQuestions(reordered.sort((a, b) => a.order - b.order));
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Reorder failed");
    }
  };

  const runImport = async () => {
    if (!exam) return;
    setImportBusy(true);
    setError(null);
    try {
      const res = await apiClient.importQuestions(exam.id, importCsv);
      setMessage(`Imported ${res.imported} question(s).`);
      await load();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Import failed");
    } finally {
      setImportBusy(false);
    }
  };

  const publish = async () => {
    if (!exam) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.publishExam(exam.id);
      setMessage("Exam published — examinees can take it during the scheduled window.");
      await load();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Publish failed");
      const r = await apiClient.getExamReadiness(exam.id);
      setReadiness(r);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading exam builder…
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <Link
            to="/examiner"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">{exam.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {exam.exam_code ? `Code: ${exam.exam_code} · ` : ""}
              {questions.length} questions · {totalPoints} pts · {exam.status}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 text-sm">
            {message}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              ["settings", "Exam settings"],
              ["questions", "Questions"],
              ["publish", "Review & publish"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm border ${
                tab === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "settings" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Entrance exam details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
              <Field label="Exam code (optional)">
                <input
                  value={form.exam_code}
                  onChange={(e) => setForm({ ...form, exam_code: e.target.value })}
                  placeholder="ENT-2026-A"
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="field-input"
                disabled={!isDraft}
              />
            </Field>
            <Field label="Instructions shown to examinees before start">
              <textarea
                rows={4}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Bring valid ID, ensure webcam works, no phones allowed…"
                className="field-input"
                disabled={!isDraft}
              />
            </Field>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: Number(e.target.value) })
                  }
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
              <Field label="Passing score (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.passing_score}
                  onChange={(e) =>
                    setForm({ ...form, passing_score: Number(e.target.value) })
                  }
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
              <Field label="Max attempts per examinee">
                <input
                  type="number"
                  min={1}
                  value={form.max_attempts}
                  onChange={(e) =>
                    setForm({ ...form, max_attempts: Number(e.target.value) })
                  }
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Opens at (optional)">
                <input
                  type="datetime-local"
                  value={form.available_from}
                  onChange={(e) => setForm({ ...form, available_from: e.target.value })}
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
              <Field label="Closes at (optional)">
                <input
                  type="datetime-local"
                  value={form.available_until}
                  onChange={(e) => setForm({ ...form, available_until: e.target.value })}
                  className="field-input"
                  disabled={!isDraft}
                />
              </Field>
            </div>
            {isDraft ? (
              <button
                onClick={saveSettings}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save settings"}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Published exams cannot be edited here. Archive and duplicate to create a new cycle.
              </p>
            )}
          </div>
        )}

        {tab === "questions" && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={openNewQuestion}
                disabled={!isDraft}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add question
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {questions.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  No questions yet. Add manually or import from CSV below.
                </div>
              )}
              {questions.map((q, index) => (
                <div key={q.id} className="p-4 flex gap-4 items-start">
                  <div className="text-sm font-mono text-muted-foreground w-8">Q{q.order}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{q.question_text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.question_type.replace("_", " ")} · {q.points} pt(s)
                      {q.question_type === "multiple_choice" && q.options?.length
                        ? ` · ${q.options.length} options`
                        : ""}
                    </p>
                  </div>
                  {isDraft && (
                    <div className="flex items-center gap-1">
                      <IconBtn onClick={() => moveQuestion(index, -1)} label="Move up">
                        <ArrowUp className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn onClick={() => moveQuestion(index, 1)} label="Move down">
                        <ArrowDown className="w-4 h-4" />
                      </IconBtn>
                      <button
                        onClick={() => openEditQuestion(q)}
                        className="text-xs px-2 py-1 border border-border rounded hover:bg-accent"
                      >
                        Edit
                      </button>
                      <IconBtn onClick={() => removeQuestion(q)} label="Delete">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </IconBtn>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {isDraft && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Bulk import (CSV)
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Columns: question_text, question_type, options (use | between choices), correct_answer, points.
                  For true/false or short answer leave options empty.
                </p>
                <textarea
                  rows={6}
                  value={importCsv}
                  onChange={(e) => setImportCsv(e.target.value)}
                  className="field-input font-mono text-xs"
                />
                <button
                  onClick={runImport}
                  disabled={importBusy}
                  className="mt-3 px-4 py-2 rounded-lg border border-border hover:bg-accent"
                >
                  {importBusy ? "Importing…" : "Import questions"}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "publish" && readiness && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Publish checklist
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <Stat label="Questions" value={String(readiness.question_count)} />
              <Stat label="Total points" value={String(readiness.total_points)} />
              <Stat label="Pass mark" value={`${exam.passing_score}%`} />
            </div>

            {readiness.issues.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <p className="font-medium text-red-600 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Must fix before publishing
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {readiness.issues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="font-medium text-amber-700 mb-2">Recommendations</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {readiness.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.ready && isDraft && (
              <button
                onClick={publish}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? "Publishing…" : "Publish entrance exam"}
              </button>
            )}

            {!isDraft && (
              <p className="text-sm text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> This exam is already published.
              </p>
            )}
          </div>
        )}
      </div>

      {showQuestionForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
            <h3 className="text-xl font-semibold mb-4">
              {editingQuestion ? "Edit question" : "Add question"}
            </h3>
            <div className="space-y-4">
              <Field label="Question text">
                <textarea
                  rows={3}
                  value={questionDraft.question_text}
                  onChange={(e) =>
                    setQuestionDraft({ ...questionDraft, question_text: e.target.value })
                  }
                  className="field-input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
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
                </Field>
                <Field label="Points">
                  <input
                    type="number"
                    min={1}
                    value={questionDraft.points}
                    onChange={(e) =>
                      setQuestionDraft({ ...questionDraft, points: Number(e.target.value) })
                    }
                    className="field-input"
                  />
                </Field>
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
                  <Field label="Correct option (must match text exactly)">
                    <input
                      value={questionDraft.correct_answer}
                      onChange={(e) =>
                        setQuestionDraft({ ...questionDraft, correct_answer: e.target.value })
                      }
                      className="field-input"
                    />
                  </Field>
                </div>
              )}

              {questionDraft.question_type === "true_false" && (
                <Field label="Correct answer">
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
                </Field>
              )}

              {(questionDraft.question_type === "short_answer" ||
                questionDraft.question_type === "essay") && (
                <Field label="Model answer / rubric key">
                  <textarea
                    rows={2}
                    value={questionDraft.correct_answer}
                    onChange={(e) =>
                      setQuestionDraft({ ...questionDraft, correct_answer: e.target.value })
                    }
                    className="field-input"
                  />
                </Field>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowQuestionForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border"
                >
                  Cancel
                </button>
                <button
                  onClick={saveQuestion}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
                >
                  {saving ? "Saving…" : "Save question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field-input {
          width: 100%;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="p-1.5 rounded border border-border hover:bg-accent"
    >
      {children}
    </button>
  );
}
