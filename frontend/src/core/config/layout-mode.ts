type LayoutAuth = {
  isAuthenticated: boolean;
  /** Any non-student role (admin/guidance_staff/program_head/faculty/proctor). */
  isStaff: boolean;
  isStudent: boolean;
};

export type LayoutMode =
  | "auth"
  | "public"
  | "examiner"
  | "examinee"
  | "examinee-focus"
  | "preview";

const EXAMINER_PREFIXES = ["/monitoring", "/reports", "/users", "/settings", "/examiner/exams"];

export function getLayoutMode(pathname: string, auth: LayoutAuth): LayoutMode {
  if (pathname === "/login") return "auth";

  // The examiner's student-view preview renders its own full-page shell, so it
  // gets none of the workspace chrome (sidebar, header).
  if (
    auth.isAuthenticated &&
    auth.isStaff &&
    /^\/examiner\/exams\/[^/]+\/preview\/?$/.test(pathname)
  ) {
    return "preview";
  }

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
