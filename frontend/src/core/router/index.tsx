import type { ComponentType } from "react";
import { Navigate, Outlet, createBrowserRouter, useParams } from "react-router";
import type { RouteObject } from "react-router";
import { NotFound } from "../../pages/not-found";
import { ProtectedRoute } from "../../shared/components/common/protected-route";
import { Root } from "./root";
import type { ProtectedRouteProps } from "./route-types";

// Every page is its own chunk: the browser only downloads the code for the
// route being visited. `page` adapts a named page export to React Router's
// `lazy` contract.
function page<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): () => Promise<{ Component: ComponentType }> {
  return async () => ({ Component: (await load())[name] });
}

const About = page(() => import("../../pages/about"), "About");
const ExamBuilder = page(() => import("../../pages/exam-builder"), "ExamBuilder");
const ExamGrader = page(() => import("../../pages/exam-grader"), "ExamGrader");
const ExamResults = page(() => import("../../pages/exam-results"), "ExamResults");
const ExamSetup = page(() => import("../../pages/exam-setup"), "ExamSetup");
const ExamSubmitted = page(() => import("../../pages/exam-submitted"), "ExamSubmitted");
const ExamSummary = page(() => import("../../pages/exam-summary"), "ExamSummary");
const ExamTakingWithBackend = page(
  () => import("../../pages/exam-taking-backend"),
  "ExamTakingWithBackend",
);
const Examinee = page(() => import("../../pages/examinee"), "Examinee");
const Examiner = page(() => import("../../pages/examiner"), "Examiner");
const Features = page(() => import("../../pages/features"), "Features");
const Home = page(() => import("../../pages/home"), "Home");
const Login = page(() => import("../../pages/login"), "Login");
const Monitoring = page(() => import("../../pages/monitoring"), "Monitoring");
const Profile = page(() => import("../../pages/profile"), "Profile");
const Reports = page(() => import("../../pages/reports"), "Reports");
const SessionMonitor = page(() => import("../../pages/session-monitor"), "SessionMonitor");
const SettingsAdmin = page(() => import("../../pages/settings"), "SettingsAdmin");
const UsersAdmin = page(() => import("../../pages/users"), "UsersAdmin");

// Auth/role checks wrap the route as a layout so they run without waiting on
// the page chunk; the chunk itself still loads lazily via the index child.
function protectedRoute(
  path: string,
  guard: Omit<ProtectedRouteProps, "children">,
  lazy: () => Promise<{ Component: ComponentType }>,
): RouteObject {
  return {
    path,
    element: (
      <ProtectedRoute {...guard}>
        <Outlet />
      </ProtectedRoute>
    ),
    children: [{ index: true, lazy }],
  };
}

function LegacyExamineeExamRedirect({ suffix = "" }: { suffix?: string }) {
  const { examId } = useParams();
  return <Navigate to={`/examinee/exam/${examId}${suffix}`} replace />;
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    HydrateFallback: RouteFallback,
    children: [
      { index: true, lazy: Home },
      { path: "examiner", lazy: Examiner },
      { path: "examinee", lazy: Examinee },
      { path: "features", lazy: Features },
      { path: "about", lazy: About },
      { path: "login", lazy: Login },

      // Legacy redirects
      { path: "dashboard", element: <Navigate to="/examiner" replace /> },
      { path: "student/dashboard", element: <Navigate to="/examinee" replace /> },

      // Staff routes - module-gated so guidance_staff/program_head/faculty/
      // proctor see what their role grants by default, not just admin.
      protectedRoute("monitoring", { requiredModule: "monitoring" }, Monitoring),
      protectedRoute("monitoring/:sessionId", { requiredModule: "monitoring" }, SessionMonitor),
      protectedRoute("reports", { requiredModule: "reports" }, Reports),
      protectedRoute("users", { requiredModule: "user-mgmt" }, UsersAdmin),
      protectedRoute("settings", { requiredModule: "settings" }, SettingsAdmin),

      // Profile (any authenticated user)
      protectedRoute("profile", {}, Profile),

      // Examinee exam flow
      protectedRoute("examinee/exam/:examId/setup", { requiredRole: "STUDENT" }, ExamSetup),
      protectedRoute("examinee/exam/:examId", { requiredRole: "STUDENT" }, ExamTakingWithBackend),
      protectedRoute("examinee/exam/:examId/submitted", { requiredRole: "STUDENT" }, ExamSubmitted),
      protectedRoute("examinee/exam/:examId/results", { requiredRole: "STUDENT" }, ExamResults),

      // Legacy examinee exam redirects
      {
        path: "student/exam/:examId",
        element: <LegacyExamineeExamRedirect />,
      },
      {
        path: "student/exam/:examId/submitted",
        element: <LegacyExamineeExamRedirect suffix="/submitted" />,
      },
      {
        path: "student/exam/:examId/results",
        element: <LegacyExamineeExamRedirect suffix="/results" />,
      },

      protectedRoute("examiner/exams/:examId/edit", { requiredModule: "exams" }, ExamBuilder),
      protectedRoute("examiner/exams/:examId/grading", { requiredModule: "exams" }, ExamGrader),

      // Shared
      protectedRoute("exams/:examId", {}, ExamSummary),

      { path: "*", Component: NotFound },
    ],
  },
]);
