import { Link } from "react-router";
import { ArrowRight, GraduationCap, UserCog } from "lucide-react";
import { Logo, InstitutionLogo } from "../shared/components/layout/logo";
import { brand } from "../core/config/brand";
import { Button } from "../shared/components/ui/button";

export function Home() {
  const portals = [
    {
      title: "Examiner",
      description: "Create exams, monitor sessions, and review reports.",
      to: "/examiner",
      icon: UserCog,
    },
    {
      title: "Examinee",
      description: "Take assigned exams and view your results.",
      to: "/examinee",
      icon: GraduationCap,
    },
  ];

  return (
    <section className="landing-home mx-auto w-full max-w-4xl text-center">
      <div className="hero-institution-wrap">
        <div className="hero-institution-emblem">
          <InstitutionLogo className="hero-institution-logo" />
        </div>

        <div className="surface-panel hero-institution-panel">
          <div className="hero-institution-body">
            <div className="hero-app-mark" aria-hidden>
              <Logo className="hero-app-mark-icon" />
            </div>

            <p className="hero-institution-eyebrow">{brand.institutionName}</p>
            <p className="hero-institution-unit">{brand.institutionUnit}</p>

            <div className="hero-title-block">
              <h1 className="hero-title">{brand.appName}</h1>
              <p className="hero-tagline">{brand.tagline}</p>
            </div>

            <p className="hero-description">
              Secure, monitored online examinations for {brand.institutionName}, built for
              fair assessment and academic integrity.
            </p>
          </div>
        </div>
      </div>

      <div className="landing-portals">
        {portals.map((portal) => (
          <Link
            key={portal.title}
            to={portal.to}
            className="landing-portal-card surface-panel-interactive group block text-left"
          >
            <portal.icon className="mb-4 h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">{portal.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{portal.description}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
              Open portal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="landing-home-actions">
        <Button asChild variant="outline">
          <Link to="/features">Explore features</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/about">About the project</Link>
        </Button>
      </div>
    </section>
  );
}
