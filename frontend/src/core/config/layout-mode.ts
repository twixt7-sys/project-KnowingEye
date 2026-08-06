type LayoutAuth = {
  isAuthenticated: boolean;
  /** Any non-student role (admin/faculty/student_assistant). */
  isStaff: boolean;
  isStudent: boolean;
};

export type LayoutMode = "auth" | "public" | "examiner" | "examinee" | "examinee-focus";

const EXAMINER_PREFIXES = ["/monitoring", "/reports", "/users", "/examiner/exams"];

export function getLayoutMode(pathname: string, auth: LayoutAuth): LayoutMode {
  if (pathname === "/login") return "auth";

  if (/^\/examinee\/exam\/[^/]+\/?$/.test(pathname)) {
    return "examinee-focus";
  }

  if (auth.isAuthenticated && auth.isStudent && pathname.startsWith("/examinee/")) {
    return "examinee";
  }

  if (auth.isAuthenticated && auth.isStaff) {
    if (
      pathname === "/examiner" ||
      EXAMINER_PREFIXES.some((p) => pathname.startsWith(p)) ||
      pathname.startsWith("/exams/")
    ) {
      return "examiner";
    }
    if (pathname === "/profile") return "examiner";
  }

  if (auth.isAuthenticated && auth.isStudent) {
    if (pathname === "/examinee" || pathname.startsWith("/exams/") || pathname === "/profile") {
      return "examinee";
    }
  }

  return "public";
}
