import { Link, Navigate } from "react-router";
import { Activity, ArrowRight, Camera, CheckCircle, FileText } from "lucide-react";
import { useAuth } from "../core/providers/auth-provider";
import { StudentDashboard } from "./student-dashboard";
import { Button } from "../shared/components/ui/button";

const highlights = [
  {
    icon: FileText,
    title: "Available exams",
    text: "See what is scheduled and start when ready.",
  },
  {
    icon: Camera,
    title: "Monitored sessions",
    text: "Your webcam helps keep the process fair.",
  },
  {
    icon: CheckCircle,
    title: "Results",
    text: "Review scores and session history after submission.",
  },
];

function ExamineeLanding() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col justify-center px-4 py-16">
      <div className="surface-panel p-8 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-wider text-secondary">Examinee portal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Take your exam in a clear, guided flow
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Access assigned exams, follow simple instructions, and submit answers in a monitored environment.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/login" state={{ from: { pathname: "/examinee" } }}>
              Sign in as examinee
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/">Back to home</Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="rounded-lg border border-border/70 bg-background/50 p-4">
              <item.icon className="mb-3 h-5 w-5 text-secondary" />
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
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
