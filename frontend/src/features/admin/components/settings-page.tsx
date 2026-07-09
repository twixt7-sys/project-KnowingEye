import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { formatApiError, type Department } from "@/core/config/api";
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/features/admin/api/admin-api";
import { adminQueries } from "@/features/admin/queries/queries";
import { adminKeys } from "@/features/admin/queries/keys";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { ScrollableDataTable } from "@/shared/components/common/scrollable-data-table";
import { PageShell } from "@/shared/components/layout/page-shell";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

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

export function SettingsPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const departmentsQuery = useQuery(adminQueries.departments());
  const departments = departmentsQuery.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.departments() });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateDepartment(editing.id, form);
      }
      return createDepartment(form);
    },
    onSuccess: async () => {
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await invalidate();
    },
    onError: (err) => setFormError(formatApiError(err, "Could not save department")),
  });

  const toggleMutation = useMutation({
    mutationFn: (dept: Department) =>
      updateDepartment(dept.id, { is_active: !dept.is_active }),
    onSuccess: invalidate,
    onError: (err) => setActionError(formatApiError(err, "Could not update department")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDepartment(id),
    onSuccess: invalidate,
    onError: (err) => setActionError(formatApiError(err, "Could not delete department")),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: departments.length + 1 });
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

  const remove = async (dept: Department) => {
    const confirmed = await confirm({
      title: "Delete department?",
      description: `"${dept.name}" will be removed. Exams already linked to it are kept, but new exams cannot use it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) deleteMutation.mutate(dept.id);
  };

  const displayError =
    actionError ??
    (departmentsQuery.error
      ? formatApiError(departmentsQuery.error, "Failed to load departments")
      : null);

  return (
    <PageShell>
      <PageHeaderV2
        eyebrow="Examiner"
        title="Settings"
        description="Configure departments and abbreviations used when generating exam codes."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => invalidate()}
              disabled={departmentsQuery.isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${departmentsQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add department
            </Button>
          </div>
        }
      />

      {displayError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {displayError}
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
              {departments.length === 0 && !departmentsQuery.isLoading && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Building2}
                      title="No departments yet"
                      description="Add one to start creating exams with auto-generated codes."
                    />
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
                      <span className="status-pill bg-muted text-muted-foreground">inactive</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(dept)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMutation.mutate(dept)}
                      >
                        {dept.is_active !== false ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                        onClick={() => remove(dept)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
          <div className="surface-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm">Department name</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Wellness and Care Center"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Abbreviation</label>
                <Input
                  required
                  value={form.abbreviation}
                  onChange={(e) =>
                    setForm({ ...form, abbreviation: e.target.value.toUpperCase() })
                  }
                  placeholder="IIT"
                  maxLength={16}
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Sort order</label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: Number(e.target.value) })
                  }
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
                <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
                  {saveMutation.isPending
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Add department"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
