export const adminKeys = {
  all: ["admin"] as const,
  users: (filters?: Record<string, unknown>) => [...adminKeys.all, "users", filters] as const,
  userStats: () => [...adminKeys.all, "user-stats"] as const,
  departments: () => [...adminKeys.all, "departments"] as const,
};
