import { useEffect, useState } from "react";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  RefreshCw,
  Users as UsersIcon,
  AlertCircle,
} from "lucide-react";

import { apiClient, type ProfileUser, type Role, type UserStats } from "../core/config/api";
import { DataTablePagination } from "../shared/components/common/data-table-pagination";
import { ScrollableDataTable } from "../shared/components/common/scrollable-data-table";
import { PageHeader } from "../shared/components/layout/page-header";
import { PageShell } from "../shared/components/layout/page-shell";
import { SectionPanel } from "../shared/components/layout/section-panel";
import { StatCard } from "../shared/components/layout/stat-card";
import { Button } from "../shared/components/ui/button";
import { useDebounce } from "../shared/hooks/use-debounce";
import { usePagination } from "../shared/hooks/use-pagination";

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  EXAMINEE: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
};

const EMPTY_STATS: UserStats = { total: 0, admins: 0, examinees: 0, inactive: 0 };

export function UsersAdmin() {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [acting, setActing] = useState<number | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, userStats] = await Promise.all([
        apiClient.listUsers({
          ...(roleFilter ? { role: roleFilter } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          page,
          page_size: pageSize,
        }),
        apiClient.getUserStats(),
      ]);
      setUsers(res.results);
      setTotalCount(res.count);
      setStats(userStats);
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, debouncedSearch, page, pageSize]);

  const handleAction = async (id: number, fn: () => Promise<ProfileUser>) => {
    setActing(id);
    try {
      const updated = await fn();
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      const userStats = await apiClient.getUserStats();
      setStats(userStats);
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Examiner"
        title="Users"
        description="Manage examinee and administrator accounts."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="page-metrics grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={String(stats.total)} icon={UsersIcon} />
        <StatCard
          label="Admins"
          value={String(stats.admins)}
          icon={ShieldCheck}
          tone="success"
        />
        <StatCard
          label="Examinees"
          value={String(stats.examinees)}
          icon={UserCog}
        />
        <StatCard
          label="Inactive"
          value={String(stats.inactive)}
          icon={ShieldOff}
          tone="danger"
        />
      </div>

      <SectionPanel
        title="Directory"
        description="Search, filter, and manage workspace accounts."
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search username or email…"
                className="form-field w-full py-2 pl-9 pr-3 text-sm"
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
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    <UsersIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No users match those filters.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
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
                      <button
                        disabled={acting === u.id}
                        onClick={() =>
                          handleAction(u.id, () =>
                            apiClient.setUserRole(
                              u.id,
                              u.role === "ADMIN" ? "EXAMINEE" : "ADMIN"
                            )
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        title="Toggle role"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        {u.role === "ADMIN" ? "Make examinee" : "Make admin"}
                      </button>
                      {u.is_active ? (
                        <button
                          disabled={acting === u.id}
                          onClick={() =>
                            handleAction(u.id, () => apiClient.deactivateUser(u.id))
                          }
                          className="rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          disabled={acting === u.id}
                          onClick={() =>
                            handleAction(u.id, () => apiClient.activateUser(u.id))
                          }
                          className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          Activate
                        </button>
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
          loading={loading}
        />
      </SectionPanel>
    </PageShell>
  );
}
