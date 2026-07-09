export const dashboardKeys = {
  all: ["dashboard"] as const,
  examiner: () => [...dashboardKeys.all, "examiner"] as const,
  student: () => [...dashboardKeys.all, "student"] as const,
  departments: (activeOnly = true) =>
    [...dashboardKeys.all, "departments", { activeOnly }] as const,
};
