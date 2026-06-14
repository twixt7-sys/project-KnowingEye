import { Link, Navigate } from "react-router";
import {
  Activity,
  ArrowRight,
  Camera,
  CheckCircle,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../core/providers/auth-provider";
import { StudentDashboard } from "./student-dashboard";

const highlights = [
  {
    icon: FileText,
    title: "Available exams",
    text: "View scheduled exams and start your attempt when you are ready.",
  },
  {
    icon: Camera,
    title: "Monitored sessions",
    text: "Your webcam stays active so behavior can be reviewed fairly.",
  },
  {
    icon: CheckCircle,
    title: "Results & history",
    text: "Review completed attempts and scores after submission.",
  },
];

function ExamineeLanding() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-primary/5 to-transparent" />

      <div className="relative w-full max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm mb-6">
          <ShieldCheck className="w-4 h-4 text-secondary" />
          Examinee portal
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">Examinee Workspace</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Access your exams, follow session instructions, and submit answers in a
          monitored online environment.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            to="/login"
            state={{ from: { pathname: "/examinee" } }}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in as examinee
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
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center mb-3">
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

export function Examinee() {
  const { isAuthenticated, isExaminee, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (isAuthenticated && isExaminee) {
    return <StudentDashboard />;
  }

  if (isAuthenticated && !isExaminee) {
    return <Navigate to="/examiner" replace />;
  }

  return <ExamineeLanding />;
}
