import { createBrowserRouter, Navigate, useParams } from "react-router";
import { Root } from "./root";
import { Home } from "../../pages/home";
import { Examiner } from "../../pages/examiner";
import { Examinee } from "../../pages/examinee";
import { Features } from "../../pages/features";
import { About } from "../../pages/about";
import { Login } from "../../pages/login";
import { NotFound } from "../../pages/not-found";
import { ExamTakingWithBackend } from "../../pages/exam-taking-backend";
import { ExamSubmitted } from "../../pages/exam-submitted";
import { ExamResults } from "../../pages/exam-results";
import { ExamSummary } from "../../pages/exam-summary";
import { Monitoring } from "../../pages/monitoring";
import { SessionMonitor } from "../../pages/session-monitor";
import { Reports } from "../../pages/reports";
import { Profile } from "../../pages/profile";
import { UsersAdmin } from "../../pages/users";
import { ProtectedRoute } from "../../shared/components/common/protected-route";

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

      // Admin-only routes
      {
        path: "monitoring",
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <Monitoring />
          </ProtectedRoute>
        ),
      },
      {
        path: "monitoring/:sessionId",
        element: (
          <ProtectedRoute>
            <SessionMonitor />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <Reports />
          </ProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <UsersAdmin />
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
        path: "examinee/exam/:examId",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
            <ExamTakingWithBackend />
          </ProtectedRoute>
        ),
      },
      {
        path: "examinee/exam/:examId/submitted",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
            <ExamSubmitted />
          </ProtectedRoute>
        ),
      },
      {
        path: "examinee/exam/:examId/results",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
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
