import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Users as UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { type ProfileUser, type Role, formatApiError } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import { activateUser, deactivateUser, setUserRole } from "@/features/admin/api/admin-api";
import { ManageAccessDialog } from "@/features/admin/components/manage-access-dialog";
import { adminKeys } from "@/features/admin/queries/keys";
import { adminQueries } from "@/features/admin/queries/queries";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { DataTablePagination } from "@/shared/components/common/data-table-pagination";
import { IconAction } from "@/shared/components/common/icon-action";
import { ScrollableDataTable } from "@/shared/components/common/scrollable-data-table";
import { PageShell } from "@/shared/components/layout/page-shell";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";
import { StatGrid } from "@/shared/components/patterns/stat-grid";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { usePagination } from "@/shared/hooks/use-pagination";

const ROLES: Role[] = ["ADMIN", "FACULTY", "STUDENT_ASSISTANT", "STUDENT"];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  FACULTY: "Faculty",
  STUDENT_ASSISTANT: "Student Assistant",
  STUDENT: "Student",
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-primary/10 text-primary border-primary/25",
  FACULTY: "bg-secondary/10 text-secondary border-secondary/25",
  STUDENT_ASSISTANT: "bg-accent/10 text-accent-foreground border-accent/25",
  STUDENT: "bg-muted text-muted-foreground border-border",
};

export function UsersPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [acting, setActing] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [manageAccessUser, setManageAccessUser] = useState<ProfileUser | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const filters = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page,
    page_size: pageSize,
  };

  const usersQuery = useQuery(adminQueries.users(filters));
  const statsQuery = useQuery(adminQueries.userStats());

  const users = usersQuery.data?.results ?? [];
  const totalCount = usersQuery.data?.count ?? 0;
  const stats = statsQuery.data ?? {
    total: 0,
    admins: 0,
    faculty: 0,
    student_assistants: 0,
    students: 0,
    inactive: 0,
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.users(filters) });
    queryClient.invalidateQueries({ queryKey: adminKeys.userStats() });
  };

  const handleAction = async (id: number, fn: () => Promise<unknown>) => {
    setActing(id);
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setActionError(formatApiError(e, "Action failed"));
    } finally {
      setActing(null);
    }
  };

  const displayError =
    actionError ??
    (usersQuery.error ? formatApiError(usersQuery.error, "Failed to load users") : null);

  return (
    <PageShell>
      <PageHeaderV2
        eyebrow="Examiner"
        title="Users"
        description="Manage accounts, roles, and delegated access."
        actions={
          <Button variant="outline" onClick={refresh} disabled={usersQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
        metrics={
          <StatGrid
            items={[
              { label: "Total users", value: String(stats.total), icon: UsersIcon },
              {
                label: "Admins",
                value: String(stats.admins),
                icon: ShieldCheck,
                tone: "success",
              },
              { label: "Faculty", value: String(stats.faculty), icon: UsersIcon },
              {
                label: "Student assistants",
                value: String(stats.student_assistants),
                icon: UsersIcon,
              },
              { label: "Students", value: String(stats.students), icon: UsersIcon },
              {
                label: "Inactive",
                value: String(stats.inactive),
                icon: ShieldOff,
                tone: "danger",
              },
            ]}
          />
        }
      />

      {displayError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {displayError}
        </div>
      )}

      <SectionPanel
        title="Directory"
        description="Search, filter, and manage workspace accounts."
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search username or email…"
                className="py-2 pl-9"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as "" | Role);
                setPage(1);
              }}
              className="form-field text-sm"
            >
              <option value="">All roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <ScrollableDataTable>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Last seen</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !usersQuery.isLoading && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={UsersIcon}
                      title="No users match"
                      description="Try adjusting your search or role filter."
                    />
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 font-serif text-sm font-semibold text-primary ring-1 ring-border">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (u.first_name?.[0] ?? u.username[0] ?? "?").toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">
                          {u.first_name || u.username}{" "}
                          {u.last_name && (
                            <span className="text-muted-foreground">{u.last_name}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      disabled={acting === u.id}
                      onChange={async (e) => {
                        const nextRole = e.target.value as Role;
                        if (nextRole === u.role) return;
                        const confirmed = await confirm({
                          title: "Change user role?",
                          description: `${u.username} will become ${ROLE_LABEL[nextRole]}.`,
                          confirmLabel: "Change role",
                        });
                        if (!confirmed) return;
                        handleAction(u.id, () => setUserRole(u.id, nextRole));
                      }}
                      className={`status-pill border ${ROLE_BADGE[u.role]} cursor-pointer bg-transparent`}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-status-safe">
                        <ShieldCheck className="h-3.5 w-3.5" /> active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-status-alert">
                        <ShieldOff className="h-3.5 w-3.5" /> inactive
                      </span>
                    )}
                  </td>
                  <td className="hidden font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "never"}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-0.5">
                      {isAdmin && u.role !== "ADMIN" && (
                        <IconAction
                          label="Manage access"
                          icon={KeyRound}
                          tone="primary"
                          disabled={acting === u.id}
                          onClick={() => setManageAccessUser(u)}
                        />
                      )}
                      {u.is_active ? (
                        <IconAction
                          label="Deactivate user"
                          icon={ShieldOff}
                          tone="danger"
                          disabled={acting === u.id}
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: "Deactivate user?",
                              description: `${u.username} will be unable to sign in until reactivated.`,
                              confirmLabel: "Deactivate",
                              destructive: true,
                            });
                            if (!confirmed) return;
                            handleAction(u.id, () => deactivateUser(u.id));
                          }}
                        />
                      ) : (
                        <IconAction
                          label="Activate user"
                          icon={ShieldCheck}
                          tone="primary"
                          disabled={acting === u.id}
                          onClick={() => handleAction(u.id, () => activateUser(u.id))}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableDataTable>

        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={usersQuery.isLoading}
        />
      </SectionPanel>

      <ManageAccessDialog user={manageAccessUser} onClose={() => setManageAccessUser(null)} />
    </PageShell>
  );
}
