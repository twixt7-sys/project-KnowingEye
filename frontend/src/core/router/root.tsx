import { Outlet, useLocation } from "react-router";
import { Header } from "../../shared/components/layout/header";
import { Footer } from "../../shared/components/layout/footer";
import { SchoolBackground } from "../../shared/components/layout/school-background";
import { WorkspaceLayout } from "../../shared/components/layout/workspace-layout";
import { getLayoutMode } from "../config/layout-mode";
import { useAuth } from "../providers/auth-provider";

export function Root() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, isExaminee } = useAuth();
  const mode = getLayoutMode(location.pathname, {
    isAuthenticated,
    isAdmin,
    isExaminee,
  });

  const content = <Outlet />;

  if (mode === "auth") {
    return (
      <div className="relative min-h-screen bg-background">
        <SchoolBackground variant="public" fixed />
        <div className="relative z-10">{content}</div>
      </div>
    );
  }

  if (mode === "examiner") {
    return <WorkspaceLayout role="examiner">{content}</WorkspaceLayout>;
  }

  if (mode === "examinee-focus") {
    return (
      <WorkspaceLayout role="examinee" variant="focus">
        {content}
      </WorkspaceLayout>
    );
  }

  if (mode === "examinee") {
    return <WorkspaceLayout role="examinee">{content}</WorkspaceLayout>;
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <SchoolBackground variant="public" fixed />
      <span className="relative z-10 h-16" aria-hidden />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
          {content}
        </main>
        <Footer />
      </div>
    </div>
  );
}
