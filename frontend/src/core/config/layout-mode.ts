type LayoutAuth = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isExaminee: boolean;
};

export type LayoutMode =
  | "auth"
  | "public"
  | "examiner"
  | "examinee"
  | "examinee-focus";

const EXAMINER_PREFIXES = [
  "/monitoring",
  "/reports",
  "/users",
  "/examiner/exams",
];

export function getLayoutMode(
  pathname: string,
  auth: LayoutAuth
): LayoutMode {
  if (pathname === "/login") return "auth";

  if (/^\/examinee\/exam\/[^/]+\/?$/.test(pathname)) {
    return "examinee-focus";
  }

  if (auth.isAuthenticated && auth.isExaminee && pathname.startsWith("/examinee/")) {
    return "examinee";
  }

  if (auth.isAuthenticated && auth.isAdmin) {
    if (
      pathname === "/examiner" ||
      EXAMINER_PREFIXES.some((p) => pathname.startsWith(p)) ||
      (pathname.startsWith("/exams/") && auth.isAdmin)
    ) {
      return "examiner";
    }
    if (pathname === "/profile") return "examiner";
  }

  if (auth.isAuthenticated && auth.isExaminee) {
    if (
      pathname === "/examinee" ||
      pathname.startsWith("/exams/") ||
      pathname === "/profile"
    ) {
      return "examinee";
    }
  }

  return "public";
}
