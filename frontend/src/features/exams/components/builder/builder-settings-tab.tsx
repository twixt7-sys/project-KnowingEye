import { Save } from "@/shared/icons";

import type { Exam } from "@/core/config/api";
import { BuilderField } from "@/features/exams/components/builder/builder-primitives";
import type { ExamForm } from "@/features/exams/schemas/builder-schemas";
import { Checkbox } from "@/shared/components/ui/checkbox";

interface BuilderSettingsTabProps {
  exam: Exam;
  form: ExamForm;
  setForm: React.Dispatch<React.SetStateAction<ExamForm | null>>;
  isDraft: boolean;
  saving: boolean;
  onSave: () => void;
}

export function BuilderSettingsTab({
  exam,
  form,
  setForm,
  isDraft,
  saving,
  onSave,
}: BuilderSettingsTabProps) {
  const update = (patch: Partial<ExamForm>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Entrance exam details</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <BuilderField label="Title">
          <input
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
        <BuilderField label="Department">
          <input
            value={
              exam.department
                ? `${exam.department.name} (${exam.department.abbreviation})`
                : "Not assigned"
            }
            className="field-input bg-muted/40"
            disabled
            readOnly
          />
        </BuilderField>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <BuilderField label="Exam code">
          <input
            value={exam.exam_code ?? "Pending assignment"}
            className="field-input bg-muted/40 font-mono"
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Assigned automatically when the exam was created.
          </p>
        </BuilderField>
      </div>
      <BuilderField label="Description">
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          className="field-input"
          disabled={!isDraft}
        />
      </BuilderField>
      <BuilderField label="Instructions shown to examinees before start">
        <textarea
          rows={4}
          value={form.instructions}
          onChange={(e) => update({ instructions: e.target.value })}
          placeholder={
            form.monitoring_enabled
              ? "Bring valid ID, ensure webcam works, no phones allowed…"
              : "Read each question carefully, manage your time, no external resources…"
          }
          className="field-input"
          disabled={!isDraft}
        />
      </BuilderField>
      <div className="space-y-3">
        <CheckboxSetting
          checked={form.monitoring_enabled}
          onCheckedChange={(checked) => update({ monitoring_enabled: checked === true })}
          disabled={!isDraft}
          title="Camera monitoring"
          description="When enabled, examinees complete proctoring setup and their webcam stays active during the exam. Disable for practice quizzes or environments where monitoring is not required."
        />
        <CheckboxSetting
          checked={form.shuffle_questions}
          onCheckedChange={(checked) => update({ shuffle_questions: checked === true })}
          disabled={!isDraft}
          title="Shuffle questions"
          description="Present questions in a random order for each examinee. The order stays fixed for the duration of their attempt."
        />
        <CheckboxSetting
          checked={form.shuffle_options}
          onCheckedChange={(checked) => update({ shuffle_options: checked === true })}
          disabled={!isDraft}
          title="Shuffle answer options"
          description="Randomize multiple-choice option order per attempt."
        />
        <CheckboxSetting
          checked={form.requires_assignment}
          onCheckedChange={(checked) => update({ requires_assignment: checked === true })}
          disabled={!isDraft}
          title="Assigned candidates only"
          description="Only rostered examinees can see and start this exam."
        />
        <CheckboxSetting
          checked={form.is_practice}
          onCheckedChange={(checked) => update({ is_practice: checked === true })}
          disabled={!isDraft}
          title="Practice exam"
          description="Unlimited attempts; use for dry runs before the real admission exam."
        />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <BuilderField label="Duration (minutes)">
          <input
            type="number"
            min={1}
            value={form.duration_minutes}
            onChange={(e) => update({ duration_minutes: Number(e.target.value) })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
        <BuilderField label="Passing score (%)">
          <input
            type="number"
            min={0}
            max={100}
            value={form.passing_score}
            onChange={(e) => update({ passing_score: Number(e.target.value) })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
        <BuilderField label="Max attempts per examinee">
          <input
            type="number"
            min={1}
            value={form.max_attempts}
            onChange={(e) => update({ max_attempts: Number(e.target.value) })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <BuilderField label="Opens at (optional)">
          <input
            type="datetime-local"
            value={form.available_from}
            onChange={(e) => update({ available_from: e.target.value })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
        <BuilderField label="Closes at (optional)">
          <input
            type="datetime-local"
            value={form.available_until}
            onChange={(e) => update({ available_until: e.target.value })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <BuilderField label="Presentation mode">
          <select
            value={form.presentation_mode ?? "one_per_page"}
            onChange={(e) =>
              update({ presentation_mode: e.target.value as ExamForm["presentation_mode"] })
            }
            className="field-input"
            disabled={!isDraft}
          >
            <option value="one_per_page">One question per page</option>
            <option value="section_per_page">One section per page</option>
            <option value="scroll_all">All questions (scroll)</option>
          </select>
        </BuilderField>
        <BuilderField label="Results release at (optional)">
          <input
            type="datetime-local"
            value={form.results_release_at}
            onChange={(e) => update({ results_release_at: e.target.value })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
      </div>
      {isDraft ? (
        <button
          type="button"
          onClick={onSave}
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
  );
}

function CheckboxSetting({
  checked,
  onCheckedChange,
  disabled,
  title,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground mt-1">{description}</span>
        </span>
      </label>
    </div>
  );
}
