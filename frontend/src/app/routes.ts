import { createBrowserRouter } from "react-router";
import { Root } from "./root";
import { Home } from "./pages/home";
import { Features } from "./pages/features";
import { Dashboard } from "./pages/dashboard";
import { About } from "./pages/about";
import { Login } from "./pages/login";
import { NotFound } from "./pages/not-found";
import { StudentDashboard } from "./pages/student-dashboard";
import { ExamTaking } from "./pages/exam-taking";
import { ExamSubmitted } from "./pages/exam-submitted";
import { ExamResults } from "./pages/exam-results";
import { ExamSummary } from "./pages/exam-summary";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "features", Component: Features },
      { path: "dashboard", Component: Dashboard },
      { path: "about", Component: About },
      { path: "login", Component: Login },
      { path: "student/dashboard", Component: StudentDashboard },
      { path: "student/exam/:examId", Component: ExamTaking },
      { path: "student/exam/:examId/submitted", Component: ExamSubmitted },
      { path: "student/exam/:examId/results", Component: ExamResults },
      { path: "exams/:examId", Component: ExamSummary },
      { path: "*", Component: NotFound },
    ],
  },
]);