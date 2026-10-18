export const dashboardKeys = {
  all: ["dashboard"] as const,
  examiner: () => [...dashboardKeys.all, "examiner"] as const,
  examinerExams: () => [...dashboardKeys.all, "examiner-exams"] as const,
  student: () => [...dashboardKeys.all, "student"] as const,
  studentExams: () => [...dashboardKeys.student(), "exams"] as const,
  studentSessions: (params: Record<string, unknown>) =>
    [...dashboardKeys.student(), "sessions", params] as const,
  departments: (activeOnly = true) =>
    [...dashboardKeys.all, "departments", { activeOnly }] as const,
  categories: (activeOnly = true) =>
    [...dashboardKeys.all, "categories", { activeOnly }] as const,
};
