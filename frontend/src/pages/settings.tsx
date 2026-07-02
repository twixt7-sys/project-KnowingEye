import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import {
  apiClient,
  formatApiError,
  type Department,
} from "../core/config/api";
import { useConfirm } from "../shared/components/common/confirm-dialog";
import { ScrollableDataTable } from "../shared/components/common/scrollable-data-table";
import { PageHeader } from "../shared/components/layout/page-header";
import { PageShell } from "../shared/components/layout/page-shell";
import { SectionPanel } from "../shared/components/layout/section-panel";
import { Button } from "../shared/components/ui/button";

type DepartmentForm = {
  name: string;
  abbreviation: string;
  sort_order: number;
};

const EMPTY_FORM: DepartmentForm = {
  name: "",
  abbreviation: "",
  sort_order: 0,
};

export function SettingsAdmin() {
  const confirm = useConfirm();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listDepartments();
      setDepartments(data);
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to load departments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      sort_order: departments.length + 1,
    });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({
      name: dept.name,
      abbreviation: dept.abbreviation,
      sort_order: dept.sort_order ?? 0,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const updated = await apiClient.updateDepartment(editing.id, form);
        setDepartments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
      } else {
        const created = await apiClient.createDepartment(form);
        setDepartments((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      setFormError(formatApiError(err, "Could not save department"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (dept: Department) => {
    try {
      const updated = await apiClient.updateDepartment(dept.id, {
        is_active: !dept.is_active,
      });
      setDepartments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
    } catch (e: unknown) {
      setError(formatApiError(e, "Could not update department"));
    }
  };

  const remove = async (dept: Department) => {
    const confirmed = await confirm({
      title: "Delete department?",
      description: `"${dept.name}" will be removed. Exams already linked to it are kept, but new exams cannot use it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await apiClient.deleteDepartment(dept.id);
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
    } catch (e: unknown) {
      setError(formatApiError(e, "Could not delete department"));
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Examiner"
        title="Settings"
        description="Configure departments and abbreviations used when generating exam codes."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add department
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <SectionPanel
        title="Departments"
        description="Each department's abbreviation is used in auto-generated exam codes (e.g. IIT-2026-A)."
      >
        <ScrollableDataTable>
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Abbreviation</th>
                <th className="hidden sm:table-cell">Order</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No departments yet. Add one to start creating exams with auto-generated codes.
                  </td>
                </tr>
              )}
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td className="font-medium">{dept.name}</td>
                  <td className="font-mono text-sm text-primary">{dept.abbreviation}</td>
                  <td className="hidden text-sm text-muted-foreground sm:table-cell">
                    {dept.sort_order ?? 0}
                  </td>
                  <td>
                    {dept.is_active !== false ? (
                      <span className="status-pill bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        active
                      </span>
                    ) : (
                      <span className="status-pill bg-muted text-muted-foreground">
                        inactive
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(dept)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(dept)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        {dept.is_active !== false ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(dept)}
                        className="rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableDataTable>
      </SectionPanel>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="surface-panel w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {editing ? "Edit department" : "Add department"}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">Department name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Institute of Information Technology"
                  className="form-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Abbreviation</label>
                <input
                  required
                  value={form.abbreviation}
                  onChange={(e) =>
                    setForm({ ...form, abbreviation: e.target.value.toUpperCase() })
                  }
                  placeholder="IIT"
                  maxLength={16}
                  className="form-field font-mono uppercase"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used in exam codes like {form.abbreviation || "IIT"}-2026-A
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm">Sort order</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: Number(e.target.value) })
                  }
                  className="form-field"
                />
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add department"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
