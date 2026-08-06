import { Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "../../shared/components/common/error-boundary";
import { PublicLayout } from "../../shared/components/layout/public-layout";
import { SchoolBackground } from "../../shared/components/layout/school-background";
import { WorkspaceLayout } from "../../shared/components/layout/workspace-layout";
import { getLayoutMode } from "../config/layout-mode";
import { useAuth } from "../providers/auth-provider";

export function Root() {
  const location = useLocation();
  const { isAuthenticated, isStaff, isStudent } = useAuth();
  const mode = getLayoutMode(location.pathname, {
    isAuthenticated,
    isStaff,
    isStudent,
  });

  const content = <Outlet />;

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
