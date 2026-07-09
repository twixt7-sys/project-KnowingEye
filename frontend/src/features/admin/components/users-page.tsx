import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";

import { formatApiError, type Role } from "@/core/config/api";
import {
  activateUser,
  deactivateUser,
  setUserRole,
} from "@/features/admin/api/admin-api";
import { adminQueries } from "@/features/admin/queries/queries";
import { adminKeys } from "@/features/admin/queries/keys";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { DataTablePagination } from "@/shared/components/common/data-table-pagination";
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

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  EXAMINEE: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
};

export function UsersPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [acting, setActing] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
  const stats = statsQuery.data ?? { total: 0, admins: 0, examinees: 0, inactive: 0 };

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
        description="Manage examinee and administrator accounts."
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
              { label: "Examinees", value: String(stats.examinees), icon: UserCog },
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
              <option value="ADMIN">Admins</option>
              <option value="EXAMINEE">Examinees</option>
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
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-white">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (u.first_name?.[0] ?? u.username[0] ?? "?").toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-medium leading-tight">
                          {u.first_name || u.username}{" "}
                          {u.last_name && (
                            <span className="text-muted-foreground">{u.last_name}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill border ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                  </td>
                  <td>
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" /> active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                        <ShieldOff className="h-3.5 w-3.5" /> inactive
                      </span>
                    )}
                  </td>
                  <td className="hidden text-sm text-muted-foreground md:table-cell">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : "never"}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={acting === u.id}
                        onClick={async () => {
                          const nextRole = u.role === "ADMIN" ? "EXAMINEE" : "ADMIN";
                          const confirmed = await confirm({
                            title: "Change user role?",
                            description: `${u.username} will become ${
                              nextRole === "ADMIN" ? "an admin" : "an examinee"
                            }.`,
                            confirmLabel: "Change role",
                          });
                          if (!confirmed) return;
                          handleAction(u.id, () => setUserRole(u.id, nextRole));
                        }}
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        {u.role === "ADMIN" ? "Make examinee" : "Make admin"}
                      </Button>
                      {u.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={acting === u.id}
                          className="text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
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
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={acting === u.id}
                          className="text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                          onClick={() => handleAction(u.id, () => activateUser(u.id))}
                        >
                          Activate
                        </Button>
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
    </PageShell>
  );
}
