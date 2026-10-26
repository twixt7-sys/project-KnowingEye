import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Role, formatApiError } from "@/core/config/api";
import { updateRolePermissions } from "@/features/admin/api/admin-api";
import {
  type RoleAccessDraft,
  countChanges,
  diffRoleAccess,
  toggleRoleAccess,
} from "@/features/admin/lib/role-permissions";
import { adminKeys } from "@/features/admin/queries/keys";
import { adminQueries } from "@/features/admin/queries/queries";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Loader2, RotateCcw, Save } from "@/shared/icons";

/**
 * Role Permissions: module access and action permissions per role (admin only,
 * enforced server-side by /auth/roles/...). Every user of a role inherits these
 * live, so a save applies on their next request; Manage Access on a single user
 * still overrides on top.
 */
export function RolePermissionsPanel() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const matrixQuery = useQuery(adminQueries.rolePermissions());
  const matrix = matrixQuery.data;
  const [selected, setSelected] = useState<Role | null>(null);
  const [draft, setDraft] = useState<RoleAccessDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = selected ?? matrix?.roles[0]?.role ?? null;
  const saved = matrix?.roles.find((r) => r.role === role) ?? null;

  // A fresh role (or freshly saved data) resets the unsaved edits.
  useEffect(() => {
    setDraft(saved ? { modules: saved.modules, actions: saved.actions } : null);
    setError(null);
  }, [saved]);

  const current = draft ?? saved;
  const changes = saved && draft ? countChanges(diffRoleAccess(saved, draft)) : 0;
  const moduleLabel = (key: string) => matrix?.modules.find((m) => m.key === key)?.label ?? key;

  const flip = (kind: "module" | "action", key: string, enabled: boolean) => {
    if (!matrix || !current) return;
    setDraft(toggleRoleAccess(current, matrix, kind, key, enabled));
  };

  const persist = async (body: Parameters<typeof updateRolePermissions>[1]) => {
    if (!role || !saved) return;
    setSaving(true);
    setError(null);
    try {
      await updateRolePermissions(role, body);
      await queryClient.invalidateQueries({ queryKey: adminKeys.rolePermissions() });
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "user-permissions"] });
      toast.success(`${saved.label} permissions saved.`, {
        description: "Signed-in users of this role pick them up within a minute.",
      });
    } catch (e) {
      setError(formatApiError(e, "Failed to save role permissions"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!saved) return;
    const confirmed = await confirm({
      title: `Reset ${saved.label} to defaults?`,
      description:
        "Restores the predefined module access and action permissions for this role. Per-user overrides set from Manage Access are kept.",
      confirmLabel: "Reset",
    });
    if (confirmed) await persist({ reset: true });
  };

  return (
    <SectionPanel
      title="Role permissions"
      description="What each role can open and do. Changes apply to every user with the role; Manage Access on a user overrides it for that user only."
      toolbar={
        matrix && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Roles">
            {matrix.roles.map((r) => (
              <button
                key={r.role}
                type="button"
                role="tab"
                aria-selected={r.role === role}
                disabled={saving}
                onClick={() => setSelected(r.role)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  r.role === role
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )
      }
    >
      {matrixQuery.isLoading || !matrix || !saved || !current ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          {matrixQuery.error ? (
            <p className="text-sm text-destructive">
              {formatApiError(matrixQuery.error, "Failed to load role permissions")}
            </p>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                Module access
              </p>
              <div className="space-y-2">
                {matrix.modules.map((m) => (
                  <PermissionRow
                    key={m.key}
                    id={`role-module-${m.key}`}
                    label={m.label}
                    checked={current.modules[m.key] ?? false}
                    isDefault={(current.modules[m.key] ?? false) === saved.defaults.modules[m.key]}
                    disabled={saving}
                    onChange={(v) => flip("module", m.key, v)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                Action permissions
              </p>
              <div className="space-y-2">
                {matrix.actions.map((a) => (
                  <PermissionRow
                    key={a.key}
                    id={`role-action-${a.key}`}
                    label={a.label}
                    hint={`${a.key} · needs ${a.modules.map(moduleLabel).join(", ")}`}
                    checked={current.actions[a.key] ?? false}
                    isDefault={(current.actions[a.key] ?? false) === saved.defaults.actions[a.key]}
                    disabled={saving}
                    onChange={(v) => flip("action", a.key, v)}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {changes > 0 && (
              <span className="mr-auto text-sm text-muted-foreground">
                {changes} unsaved change{changes === 1 ? "" : "s"}
              </span>
            )}
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </Button>
            <Button
              variant="outline"
              onClick={() => setDraft({ modules: saved.modules, actions: saved.actions })}
              disabled={saving || changes === 0}
            >
              Discard
            </Button>
            <Button
              onClick={() => draft && persist(diffRoleAccess(saved, draft))}
              disabled={saving || changes === 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save {saved.label}
            </Button>
          </div>
        </div>
      )}
    </SectionPanel>
  );
}

function PermissionRow({
  id,
  label,
  hint,
  checked,
  isDefault,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  isDefault: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="text-sm">{label}</span>
        {!isDefault && (
          <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-status-watch">
            custom
          </span>
        )}
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
