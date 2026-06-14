import { Link, Navigate } from "react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardList,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../core/providers/auth-provider";
import { Dashboard } from "./dashboard";

const highlights = [
  {
    icon: ClipboardList,
    title: "Exam management",
    text: "Create, publish, and archive examinations from one place.",
  },
  {
    icon: Eye,
    title: "Live monitoring",
    text: "Watch active sessions and review behavioral alerts in real time.",
  },
  {
    icon: BarChart3,
    title: "Reports & analytics",
    text: "Analyze session data and export integrity reports for review.",
  },
];

function ExaminerLanding() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent" />

      <div className="relative w-full max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm mb-6">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Examiner portal
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Examiner Workspace</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Set up exams, monitor live sessions, and review behavioral reports to
          support fair and secure assessments.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            to="/login"
            state={{ from: { pathname: "/examiner" } }}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in as examiner
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
          >
            Back to home
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-left">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-xl border border-border bg-card"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-3">
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Examiner() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (isAuthenticated && isAdmin) {
    return <Dashboard />;
  }

  if (isAuthenticated && !isAdmin) {
    return <Navigate to="/examinee" replace />;
  }

  return <ExaminerLanding />;
}
