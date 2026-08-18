import { Lightbulb, MapPin, Target } from "@/shared/icons";

import { brand } from "@/core/config/brand";
import { DepartmentLogo, InstitutionLogo } from "@/shared/components/layout/logo";
import {
  SectionHeading,
  StampChip,
  TickList,
} from "./marketing-primitives";

const team = [
  { name: "Saturnino C. Ancog III", role: "Lead Developer" },
  { name: "Khrisha Marie O. Cavan", role: "AI Specialist" },
  { name: "Kervy N. Cadiente", role: "Full-Stack Developer" },
  { name: "Twixt Jasley J. Tamera", role: "UI/UX Designer" },
];

const objectives = [
  "Develop exam creation and management system",
  "Implement session-guided online examinations",
  "Capture and store video streams and session logs",
  "Analyze facial presence, gaze, and posture in real time",
  "Detect suspicious behaviors using AI models",
  "Generate behavioral reports and anomaly flags",
  "Provide an administrative analytics dashboard",
  "Evaluate system usability, functionality, and effectiveness",
];

const includedScope = [
  "Web-based examination platform",
  "Real-time webcam monitoring",
  "Facial detection and posture analysis",
  "Behavior scoring and anomaly detection",
  "Admin dashboard with reports",
  "Session logging and storage",
];

const outOfScope = [
  "Mobile application support",
  "External system integrations",
  "Biometric hardware devices",
  "Nationwide deployment",
];

export function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl py-4">
      {/* Hero */}
      <header className="mx-auto mb-16 max-w-3xl text-center">
        <StampChip>Capstone Project 2026</StampChip>
        <h1 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          About Knowing Eye
        </h1>
        <p className="mx-auto mt-4 max-w-2xl font-serif text-lg italic leading-relaxed text-muted-foreground">
          A Web-Based Examination Platform with Behavior Monitoring Using Facial and
          Postural Analysis
        </p>
      </header>

      {/* Problem / Solution dossier */}
      <section className="mb-24">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="tick-frame surface-panel relative overflow-hidden p-7 sm:p-8">
            <span className="tick-frame-corners" aria-hidden />
            <Lightbulb
              className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-foreground opacity-[0.06]"
              weight="duotone"
              aria-hidden
            />
            <p className="kicker">The problem</p>
            <p className="mt-4 font-serif text-xl font-medium leading-relaxed tracking-tight">
              Online examination systems lack reliable real-time monitoring, leading to
              increased risk of cheating and heavy reliance on manual supervision.
            </p>
          </div>
          <div className="tick-frame surface-panel relative overflow-hidden p-7 sm:p-8">
            <span className="tick-frame-corners" aria-hidden />
            <Target
              className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-foreground opacity-[0.06]"
              weight="duotone"
              aria-hidden
            />
            <p className="kicker">Our solution</p>
            <p className="mt-4 font-serif text-xl font-medium leading-relaxed tracking-tight">
              A full-stack examination platform with AI-powered behavioral monitoring —
              computer vision and deep learning working to protect exam integrity,
              automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Objectives ledger */}
      <section className="mb-24">
        <SectionHeading
          kicker="Project objectives"
          title="What this project set out to do"
          description="To design and develop a centralized web-based examination platform with integrated real-time behavioral monitoring."
        />
        <div className="surface-panel mx-auto max-w-4xl overflow-hidden">
          <ol className="grid md:grid-cols-2">
            {objectives.map((objective, index) => (
              <li
                key={objective}
                className="flex items-baseline gap-4 border-b border-border/60 px-6 py-4 last:border-b-0 md:odd:border-r md:[&:nth-last-child(2)]:border-b-0"
              >
                <span className="font-mono text-xs font-medium tabular-nums text-gold">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-relaxed text-foreground/85">{objective}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Scope */}
      <section className="mb-24">
        <SectionHeading
          kicker="Boundaries"
          title="System Scope"
          description="What the platform covers today — and what it deliberately leaves out."
        />
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="surface-panel p-6 sm:p-7">
            <p className="flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-status-safe">
              <span className="h-1.5 w-1.5 rounded-full bg-status-safe" aria-hidden />
              Included features
            </p>
            <TickList items={includedScope} tone="safe" className="mt-4" />
          </div>
          <div className="surface-panel bg-muted/30 p-6 sm:p-7">
            <p className="flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
              Out of scope
            </p>
            <TickList items={outOfScope} tone="muted" className="mt-4" />
          </div>
        </div>
      </section>

      {/* Team registry */}
      <section className="mb-24">
        <SectionHeading
          kicker="The registry"
          title="Development Team"
          description={`${brand.departmentName} · ${brand.institutionName}`}
        />
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member, i) => (
            <div
              key={member.name}
              className="surface-panel-interactive relative p-6 pt-7 text-center"
            >
              <span className="portal-index absolute left-4 top-3" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-primary/10 font-serif text-2xl font-semibold text-primary shadow-[0_0_0_4px_var(--card),0_0_0_5px_var(--border)]">
                {member.name.charAt(0)}
              </div>
              <h3 className="mt-4 font-serif text-[0.9975rem] font-semibold leading-snug tracking-tight">
                {member.name}
              </h3>
              <p className="mt-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                {member.role}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Institution band */}
      <section className="mb-8">
        <div className="greeting-band mx-auto max-w-3xl px-7 py-8 text-center sm:px-10">
          <div className="relative">
            <div className="flex items-center justify-center gap-3">
              <InstitutionLogo className="h-14 w-14 rounded-full border border-border bg-card p-1.5" />
              <span className="h-8 w-px bg-border" aria-hidden />
              <DepartmentLogo className="h-14 w-14 rounded-full border border-border bg-card p-1.5" />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-semibold tracking-tight">
              {brand.institutionName}
            </h2>
            <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary">
              {brand.departmentName}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Compostela, Davao de Oro, Philippines
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
