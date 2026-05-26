import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  RefreshCw,
  Users as UsersIcon,
  AlertCircle,
} from "lucide-react";

import { apiClient, type ProfileUser, type Role } from "../core/config/api";

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  EXAMINEE: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
};

export function UsersAdmin() {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [acting, setActing] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listUsers({
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(search ? { search } : {}),
      });
      setUsers(res);
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const totals = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === "ADMIN").length,
      examinees: users.filter((u) => u.role === "EXAMINEE").length,
      inactive: users.filter((u) => !u.is_active).length,
    }),
    [users]
  );

  const handleAction = async (
    id: number,
    fn: () => Promise<ProfileUser>
  ) => {
    setActing(id);
    try {
      const updated = await fn();
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1">Users</h1>
            <p className="text-muted-foreground">
              Manage examinee and administrator accounts.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm border border-border hover:bg-accent transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Total users" value={totals.total} tone="violet" />
          <Stat label="Admins" value={totals.admins} tone="indigo" />
          <Stat label="Examinees" value={totals.examinees} tone="sky" />
          <Stat label="Inactive" value={totals.inactive} tone="rose" />
        </div>

        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Search username or email…"
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "" | Role)}
                className="text-sm rounded-md px-3 py-1.5 border border-border bg-background"
              >
                <option value="">All roles</option>
                <option value="ADMIN">Admins</option>
                <option value="EXAMINEE">Examinees</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="m-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last seen</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No users match those filters.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
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
                    <td className="px-5 py-3">
                      <span
                        className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                          ROLE_BADGE[u.role]
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                          <ShieldCheck className="w-3.5 h-3.5" /> active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs">
                          <ShieldOff className="w-3.5 h-3.5" /> inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {u.last_seen_at
                        ? new Date(u.last_seen_at).toLocaleString()
                        : "never"}
                    </td>
                    <td className="px-5 py-3">
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
                          className="text-xs px-2 py-1 rounded-md border border-border hover:bg-accent inline-flex items-center gap-1"
                          title="Toggle role"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          {u.role === "ADMIN" ? "Make examinee" : "Make admin"}
                        </button>
                        {u.is_active ? (
                          <button
                            disabled={acting === u.id}
                            onClick={() =>
                              handleAction(u.id, () => apiClient.deactivateUser(u.id))
                            }
                            className="text-xs px-2 py-1 rounded-md text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            disabled={acting === u.id}
                            onClick={() =>
                              handleAction(u.id, () => apiClient.activateUser(u.id))
                            }
                            className="text-xs px-2 py-1 rounded-md text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
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
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "violet" | "indigo" | "sky" | "rose";
}) {
  const tones: Record<typeof tone, string> = {
    violet: "from-violet-500 to-fuchsia-600",
    indigo: "from-indigo-500 to-blue-600",
    sky: "from-sky-500 to-cyan-600",
    rose: "from-rose-500 to-orange-600",
  };
  return (
    <div className="p-5 rounded-xl border border-border bg-card flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tones[tone]} flex items-center justify-center`}
      >
        <UsersIcon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
