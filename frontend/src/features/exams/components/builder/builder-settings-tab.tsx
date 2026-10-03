import { useQuery } from "@tanstack/react-query";

import { Save } from "@/shared/icons";

import type { Exam } from "@/core/config/api";
import {
  BuilderField,
  CheckboxSetting,
  DepartmentChecklist,
} from "@/features/exams/components/builder/builder-primitives";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { toDatetimeLocal, type ExamForm } from "@/features/exams/schemas/builder-schemas";

interface BuilderSettingsTabProps {
  exam: Exam;
  form: ExamForm;
  setForm: React.Dispatch<React.SetStateAction<ExamForm | null>>;
  isDraft: boolean;
  saving: boolean;
  onSave: () => void;
}

const SCHEDULE_STATE_LABEL: Record<string, string> = {
  upcoming: "Upcoming - not open yet",
  active: "Active - open now",
  closed: "Closed - archived",
  expired: "Expired - window passed",
};

export function BuilderSettingsTab({
  exam,
  form,
  setForm,
  isDraft,
  saving,
  onSave,
}: BuilderSettingsTabProps) {
  const update = (patch: Partial<ExamForm>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const categoriesQuery = useQuery(dashboardQueries.categories(true));
  const departmentsQuery = useQuery(dashboardQueries.departments(true));
  const categories = categoriesQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Entrance exam details</h2>
        {exam.schedule_state && (
          <span className="status-pill bg-muted text-muted-foreground">
            {SCHEDULE_STATE_LABEL[exam.schedule_state] ?? exam.schedule_state}
          </span>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <BuilderField label="Title">
          <input
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            className="field-input"
            disabled={!isDraft}
          />
        </BuilderField>
        <BuilderField label="Home department">
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
          <p className="mt-1 text-xs text-muted-foreground">
            Locked after creation - used to generate the exam code.
          </p>
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
        <BuilderField label="Category">
          <select
            value={form.category_id ?? ""}
            onChange={(e) => update({ category_id: e.target.value ? Number(e.target.value) : null })}
            className="field-input"
            disabled={!isDraft}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </BuilderField>
      </div>
      <BuilderField label="Also visible to (shared/general-ed departments)">
        <DepartmentChecklist
          departments={departments}
          value={form.department_ids}
          onChange={(department_ids) => update({ department_ids })}
          lockedId={exam.department?.id ?? null}
          disabled={!isDraft}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          The home department above is always included. Add more for shared or general-education
          exams discoverable from other departments too.
        </p>
      </BuilderField>
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
          checked={form.disable_copy_paste}
          onCheckedChange={(checked) => update({ disable_copy_paste: checked === true })}
          disabled={!isDraft}
          title="Disable copy and paste"
          description="Block copy, cut, and paste while examinees take the exam, including inside answer fields, so answers must be typed."
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
        <BuilderField label="Opens at">
          <input
            type="datetime-local"
            value={form.available_from}
            onChange={(e) => update({ available_from: e.target.value })}
            min={toDatetimeLocal(new Date().toISOString())}
            className="field-input"
            disabled={!isDraft}
            required
          />
        </BuilderField>
        <BuilderField label="Closes at">
          <input
            type="datetime-local"
            value={form.available_until}
            onChange={(e) => update({ available_until: e.target.value })}
            min={form.available_from || undefined}
            className="field-input"
            disabled={!isDraft}
            required
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
