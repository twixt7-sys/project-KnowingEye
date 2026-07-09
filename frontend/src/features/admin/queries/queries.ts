import {
  fetchDepartments,
  fetchUsers,
  fetchUserStats,
} from "@/features/admin/api/admin-api";
import { adminKeys } from "@/features/admin/queries/keys";

export const adminQueries = {
  departments: () => ({
    queryKey: adminKeys.departments(),
    queryFn: fetchDepartments,
  }),
  users: (filters: Record<string, unknown>) => ({
    queryKey: adminKeys.users(filters),
    queryFn: () =>
      fetchUsers(filters as Parameters<typeof fetchUsers>[0]),
  }),
  userStats: () => ({
    queryKey: adminKeys.userStats(),
    queryFn: fetchUserStats,
  }),
};
