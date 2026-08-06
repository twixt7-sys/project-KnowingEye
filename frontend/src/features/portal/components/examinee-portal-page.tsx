import { Activity, ArrowRight, Camera, CheckCircle, FileText } from "lucide-react";
import { Link, Navigate } from "react-router";

import { brand } from "@/core/config/brand";
import { useAuth } from "@/core/providers/auth-provider";
import { StudentDashboardPage } from "@/features/dashboard/components/student-dashboard-page";
import { DepartmentLogo, InstitutionLogo } from "@/shared/components/layout/logo";
import { Button } from "@/shared/components/ui/button";

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
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl flex-col justify-center px-4 py-16">
      <div className="surface-panel overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_1fr]">
          {/* Copy + actions */}
          <div className="flex flex-col justify-between p-8 sm:p-10">
            <div>
              <p className="kicker">Examinee portal</p>
              <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                Take your exam in a clear, guided flow
              </h1>
              <p className="mt-3 max-w-md text-muted-foreground">
                Access assigned exams, follow simple instructions, and submit answers in a monitored
                environment.
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
            </div>

            <div className="mt-10 flex items-center gap-3 border-t border-border/60 pt-6">
              <div className="logo-duo">
                <InstitutionLogo className="h-9 w-9" />
                <DepartmentLogo className="h-9 w-9" />
              </div>
              <p className="text-xs leading-snug text-muted-foreground">
                {brand.institutionName}
                <span className="block font-mono text-[0.625rem] uppercase tracking-[0.12em]">
                  {brand.departmentName}
                </span>
              </p>
            </div>
          </div>

          {/* Staggered highlight rail */}
          <div className="relative border-t border-border/60 bg-muted/25 p-8 sm:p-10 lg:border-l lg:border-t-0">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(color-mix(in srgb, var(--secondary) 14%, transparent) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
              aria-hidden
            />
            <div className="relative space-y-4">
              {highlights.map((item, i) => (
                <div
                  key={item.title}
                  className="surface-panel flex items-start gap-3.5 p-4"
                  style={{ marginLeft: `${i * 1.25}rem` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/12 text-secondary">
                    <item.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block font-medium leading-tight">{item.title}</span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                      {item.text}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExamineePortalPage() {
  const { isAuthenticated, isStudent, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (isAuthenticated && isStudent) {
    return <StudentDashboardPage />;
  }

  if (isAuthenticated && !isStudent) {
    return <Navigate to="/examiner" replace />;
  }

  return <ExamineeLanding />;
}
