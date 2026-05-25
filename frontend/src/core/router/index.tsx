import { createBrowserRouter } from "react-router";
import { Root } from "./root";
import { Home } from "../../pages/home";
import { Features } from "../../pages/features";
import { Dashboard } from "../../pages/dashboard";
import { About } from "../../pages/about";
import { Login } from "../../pages/login";
import { NotFound } from "../../pages/not-found";
import { StudentDashboard } from "../../pages/student-dashboard";
import { ExamTakingWithBackend } from "../../pages/exam-taking-backend";
import { ExamSubmitted } from "../../pages/exam-submitted";
import { ExamResults } from "../../pages/exam-results";
import { ExamSummary } from "../../pages/exam-summary";
import { ProtectedRoute } from "../../shared/components/common/protected-route";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "features", Component: Features },
      { path: "about", Component: About },
      { path: "login", Component: Login },

      // Protected admin routes
      {
        path: "dashboard",
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <Dashboard />
          </ProtectedRoute>
        ),
      },

      // Protected student routes
      {
        path: "student/dashboard",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
            <StudentDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "student/exam/:examId",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
            <ExamTakingWithBackend />
          </ProtectedRoute>
        ),
      },
      {
        path: "student/exam/:examId/submitted",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
            <ExamSubmitted />
          </ProtectedRoute>
        ),
      },
      {
        path: "student/exam/:examId/results",
        element: (
          <ProtectedRoute requiredRole="EXAMINEE">
            <ExamResults />
          </ProtectedRoute>
        ),
      },

      // Public exam summary (can be viewed by both roles when authenticated)
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