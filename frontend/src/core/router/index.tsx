import { Navigate, createBrowserRouter, useParams } from "react-router";
import { About } from "../../pages/about";
import { ExamBuilder } from "../../pages/exam-builder";
import { ExamGrader } from "../../pages/exam-grader";
import { ExamResults } from "../../pages/exam-results";
import { ExamSetup } from "../../pages/exam-setup";
import { ExamSubmitted } from "../../pages/exam-submitted";
import { ExamSummary } from "../../pages/exam-summary";
import { ExamTakingWithBackend } from "../../pages/exam-taking-backend";
import { Examinee } from "../../pages/examinee";
import { Examiner } from "../../pages/examiner";
import { Features } from "../../pages/features";
import { Home } from "../../pages/home";
import { Login } from "../../pages/login";
import { Monitoring } from "../../pages/monitoring";
import { NotFound } from "../../pages/not-found";
import { Profile } from "../../pages/profile";
import { Reports } from "../../pages/reports";
import { SessionMonitor } from "../../pages/session-monitor";
import { SettingsAdmin } from "../../pages/settings";
import { UsersAdmin } from "../../pages/users";
import { ProtectedRoute } from "../../shared/components/common/protected-route";
import { Root } from "./root";

function LegacyExamineeExamRedirect({ suffix = "" }: { suffix?: string }) {
  const { examId } = useParams();
  return <Navigate to={`/examinee/exam/${examId}${suffix}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "examiner", Component: Examiner },
      { path: "examinee", Component: Examinee },
      { path: "features", Component: Features },
      { path: "about", Component: About },
      { path: "login", Component: Login },

      // Legacy redirects
      { path: "dashboard", element: <Navigate to="/examiner" replace /> },
      { path: "student/dashboard", element: <Navigate to="/examinee" replace /> },

      // Staff routes - module-gated so guidance_staff/program_head/faculty/
      // proctor see what their role grants by default, not just admin.
      {
        path: "monitoring",
        element: (
          <ProtectedRoute requiredModule="monitoring">
            <Monitoring />
          </ProtectedRoute>
        ),
      },
      {
        path: "monitoring/:sessionId",
        element: (
          <ProtectedRoute requiredModule="monitoring">
            <SessionMonitor />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute requiredModule="reports">
            <Reports />
          </ProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <ProtectedRoute requiredModule="user-mgmt">
            <UsersAdmin />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute requiredModule="settings">
            <SettingsAdmin />
          </ProtectedRoute>
        ),
      },

      // Profile (any authenticated user)
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },

      // Examinee exam flow
      {
        path: "examinee/exam/:examId/setup",
        element: (
          <ProtectedRoute requiredRole="STUDENT">
            <ExamSetup />
          </ProtectedRoute>
        ),
      },
      {
        path: "examinee/exam/:examId",
        element: (
          <ProtectedRoute requiredRole="STUDENT">
            <ExamTakingWithBackend />
          </ProtectedRoute>
        ),
      },
      {
        path: "examinee/exam/:examId/submitted",
        element: (
          <ProtectedRoute requiredRole="STUDENT">
            <ExamSubmitted />
          </ProtectedRoute>
        ),
      },
      {
        path: "examinee/exam/:examId/results",
        element: (
          <ProtectedRoute requiredRole="STUDENT">
            <ExamResults />
          </ProtectedRoute>
        ),
      },

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

      {
        path: "examiner/exams/:examId/edit",
        element: (
          <ProtectedRoute requiredModule="exams">
            <ExamBuilder />
          </ProtectedRoute>
        ),
      },
      {
        path: "examiner/exams/:examId/grading",
        element: (
          <ProtectedRoute requiredModule="exams">
            <ExamGrader />
          </ProtectedRoute>
        ),
      },

      // Shared
      {
        path: "exams/:examId",
        element: (
          <ProtectedRoute>
            <ExamSummary />
          </ProtectedRoute>
        ),
      },

      { path: "*", Component: NotFound },
    ],
  },
]);
