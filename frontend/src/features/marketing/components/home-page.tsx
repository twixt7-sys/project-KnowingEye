import { ArrowRight, GraduationCap, UserCog } from "@/shared/icons";
import { Link } from "react-router";

import { brand } from "@/core/config/brand";
import { DepartmentLogo, InstitutionLogo, Logo } from "@/shared/components/layout/logo";
import { Button } from "@/shared/components/ui/button";

const portals = [
  {
    index: "01",
    title: "Examiner",
    description: "Create exams, monitor sessions, and review reports.",
    to: "/examiner",
    icon: UserCog,
  },
  {
    index: "02",
    title: "Examinee",
    description: "Take assigned exams and view your results.",
    to: "/examinee",
    icon: GraduationCap,
  },
];

export function HomePage() {
  return (
    <section className="landing-home mx-auto w-full max-w-4xl text-center">
      <div className="hero-institution-wrap">
        <div className="hero-institution-emblem">
          <InstitutionLogo className="hero-institution-logo" />
          <DepartmentLogo className="hero-institution-logo hero-institution-logo--dept" />
        </div>

        <div className="surface-panel hero-institution-panel tick-frame">
          <span className="tick-frame-corners" aria-hidden />
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
              Secure, monitored online examinations for {brand.institutionName}, built for fair
              assessment and academic integrity.
            </p>
          </div>
        </div>
      </div>

      <p className="kicker mb-5 justify-center">Choose your portal</p>

      <div className="landing-portals">
        {portals.map((portal) => (
          <Link
            key={portal.title}
            to={portal.to}
            className="landing-portal-card surface-panel-interactive group relative block overflow-hidden text-left"
          >
            <span className="portal-index absolute right-5 top-5" aria-hidden>
              {portal.index}
            </span>
            <portal.icon
              className="mb-4 h-6 w-6 text-primary transition-transform duration-200 group-hover:-translate-y-0.5"
              weight="regular"
            />
            <h2 className="font-serif text-xl font-semibold tracking-tight">{portal.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {portal.description}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.1em] text-primary">
              Open portal
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
            <span
              className="absolute inset-x-0 bottom-0 h-[2.5px] origin-left scale-x-0 bg-primary transition-transform duration-300 ease-out group-hover:scale-x-100"
              aria-hidden
            />
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
