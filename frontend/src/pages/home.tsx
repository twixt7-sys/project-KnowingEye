import { Link } from "react-router";
import { Camera, Brain, ShieldCheck, ArrowRight, GraduationCap, UserCog } from "lucide-react";
import { Logo } from "../shared/components/layout/logo";
import { brand } from "../core/config/brand";

export function Home() {
  const highlights = [
    {
      icon: Camera,
      title: "Real-time monitoring",
      text: "Webcam capture with facial and postural analysis during exams.",
    },
    {
      icon: Brain,
      title: "AI behavior detection",
      text: "Models flag suspicious activity and anomalies as they happen.",
    },
    {
      icon: ShieldCheck,
      title: "Identity verification",
      text: "Face recognition confirms the right person is taking the exam.",
    },
  ];

  const portals = [
    {
      title: "Examiner",
      description:
        "Create exams, monitor live sessions, and review behavioral reports.",
      to: "/examiner",
      icon: UserCog,
      cta: "Open examiner portal",
    },
    {
      title: "Examinee",
      description:
        "Access assigned exams, complete monitored sessions, and view results.",
      to: "/examinee",
      icon: GraduationCap,
      cta: "Open examinee portal",
    },
  ];

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent" />

      <div className="relative w-full max-w-4xl text-center">
        <div className="flex justify-center mb-6">
          <Logo className="w-16 h-16 text-primary" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          AI-powered exam monitoring
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {brand.appName}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-2">
          {brand.tagline}
        </p>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10">
          Behavior monitoring using facial and postural analysis to keep online
          examinations fair, secure, and reliable.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 text-left mb-12">
          {portals.map((portal) => (
            <Link
              key={portal.title}
              to={portal.to}
              className="group p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
                <portal.icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{portal.title}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {portal.description}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                {portal.cta}
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>

        <Link
          to="/about"
          className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
        >
          Learn more about the platform
        </Link>

        <div className="grid gap-4 sm:grid-cols-3 text-left mt-12">
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
