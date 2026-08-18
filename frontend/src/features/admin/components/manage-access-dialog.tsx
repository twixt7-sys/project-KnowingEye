import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "@/shared/icons";
import { useEffect, useState } from "react";

import { type ProfileUser, formatApiError } from "@/core/config/api";
import { updateUserPermissions } from "@/features/admin/api/admin-api";
import { adminKeys } from "@/features/admin/queries/keys";
import { adminQueries } from "@/features/admin/queries/queries";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Switch } from "@/shared/components/ui/switch";

function humanize(key: string) {
  return key
    .split(".")
    .pop()!
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ManageAccessDialogProps {
  user: ProfileUser | null;
  onClose: () => void;
}

/**
 * Per-user grant/deny module access and action-permission overrides.
 * Admin-only (enforced server-side by GET/PUT /auth/users/{id}/permissions/).
 * A module toggle set to "off" is an explicit deny, overriding the role default.
 */
export function ManageAccessDialog({ user, onClose }: ManageAccessDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, "grant" | "deny" | null>>(
    {},
  );
  const [actionOverrides, setActionOverrides] = useState<Record<string, boolean>>({});

  const permissionsQuery = useQuery({
    ...adminQueries.userPermissions(user?.id ?? 0),
    enabled: !!user,
  });

  useEffect(() => {
    setModuleOverrides({});
    setActionOverrides({});
    setError(null);
  }, [user?.id]);

  if (!user) return null;

  const data = permissionsQuery.data;
  const moduleState = (module: string): "grant" | "deny" =>
    moduleOverrides[module] ?? data?.modules[module] ?? "deny";
  const actionState = (action: string): boolean =>
    actionOverrides[action] ?? data?.actions[action] ?? false;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateUserPermissions(user.id, {
        modules: moduleOverrides,
        actions: actionOverrides,
      });
      queryClient.invalidateQueries({ queryKey: adminKeys.userPermissions(user.id) });
      onClose();
    } catch (e) {
      setError(formatApiError(e, "Failed to update access"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage access — {user.username}</DialogTitle>
          <DialogDescription>
            Role: <span className="font-medium">{user.role}</span>. Overrides here take precedence
            over the role&apos;s defaults; a module denied here stays denied even if the role would
            normally see it.
          </DialogDescription>
        </DialogHeader>

        {permissionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                Module access
              </p>
              <div className="space-y-2">
                {data &&
                  Object.keys(data.modules)
                    .sort()
                    .map((module) => (
                      <div
                        key={module}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">{humanize(module)}</span>
                        <Switch
                          checked={moduleState(module) === "grant"}
                          onCheckedChange={(checked) =>
                            setModuleOverrides((prev) => ({
                              ...prev,
                              [module]: checked ? "grant" : "deny",
                            }))
                          }
                        />
                      </div>
                    ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                Action permissions
              </p>
              <div className="space-y-2">
                {data &&
                  Object.keys(data.actions)
                    .sort()
                    .map((action) => (
                      <div
                        key={action}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">{action}</span>
                        <Switch
                          checked={actionState(action)}
                          onCheckedChange={(checked) =>
                            setActionOverrides((prev) => ({ ...prev, [action]: checked }))
                          }
                        />
                      </div>
                    ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || permissionsQuery.isLoading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
