import { Outlet, useLocation, useNavigation } from "react-router";
import { ErrorBoundary } from "../../shared/components/common/error-boundary";
import { PublicLayout } from "../../shared/components/layout/public-layout";
import { SchoolBackground } from "../../shared/components/layout/school-background";
import { WorkspaceLayout } from "../../shared/components/layout/workspace-layout";
import { getLayoutMode } from "../config/layout-mode";
import { useAuth } from "../providers/auth-provider";

/** Thin top bar while a lazily-loaded route chunk (or loader) is in flight. */
function NavigationProgress() {
  const { state } = useNavigation();
  if (state === "idle") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/20"
    >
      <div className="h-full w-1/3 animate-pulse bg-primary" />
    </div>
  );
}

export function Root() {
  const location = useLocation();
  const { isAuthenticated, isStaff, isStudent } = useAuth();
  const mode = getLayoutMode(location.pathname, {
    isAuthenticated,
    isStaff,
    isStudent,
  });

  const content = (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );

  if (mode === "auth") {
    return (
      <ErrorBoundary>
        <div className="relative min-h-screen bg-background">
          <SchoolBackground variant="public" fixed />
          <div className="relative z-10">{content}</div>
        </div>
      </ErrorBoundary>
    );
  }

  if (mode === "examiner") {
    return (
      <ErrorBoundary>
        <WorkspaceLayout role="examiner">{content}</WorkspaceLayout>
      </ErrorBoundary>
    );
  }

  if (mode === "examinee-focus") {
    return (
      <ErrorBoundary>
        <WorkspaceLayout role="examinee" variant="focus">
          {content}
        </WorkspaceLayout>
      </ErrorBoundary>
    );
  }

  if (mode === "examinee") {
    return (
      <ErrorBoundary>
        <WorkspaceLayout role="examinee">{content}</WorkspaceLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <PublicLayout>{content}</PublicLayout>
    </ErrorBoundary>
  );
}
