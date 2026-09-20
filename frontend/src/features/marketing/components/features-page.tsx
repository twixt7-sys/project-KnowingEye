import {
  Activity,
  Brain,
  Camera,
  ClipboardCheck,
  Database,
  FileCheck,
  LineChart,
  ShieldCheck,
  UserCog,
} from "@/shared/icons";

import {
  IndexCard,
  SectionHeading,
  StampChip,
  TickList,
} from "./marketing-primitives";

const coreFeatures = [
  {
    category: "Exam Management",
    icon: FileCheck,
    items: [
      "Full exam lifecycle: draft, publish, archive",
      "Categories, multi-department assignment, auto exam codes",
      "Sections and question pools with shuffle",
      "Bulk question import from XLSX/CSV, with templates",
      "Duplication, drag-and-drop reordering, image questions",
    ],
  },
  {
    category: "Roles & Approval Workflow",
    icon: UserCog,
    items: [
      "Six roles: Admin, Guidance Staff, Program Head, Faculty, Proctor, Student",
      "Faculty-authored exams routed to Program Head for approval",
      "Per-user permission grants layered on top of roles",
      "Full audit trail of every permission change",
      "CSV roster and assignment import",
    ],
  },
  {
    category: "Exam Taking & Grading",
    icon: ClipboardCheck,
    items: [
      "Autosave, server-side heartbeat, and auto-submit on timeout",
      "One-active-exam guard with pre-exam integrity checks",
      "Practice exam mode",
      "Auto-grading for objective items; Speed Grader for essays",
      "Tab/focus-switch logging and results-release notifications",
    ],
  },
  {
    category: "AI Monitoring",
    icon: Brain,
    items: [
      "Real-time frame analysis: face, head pose, and eye-gaze tracking",
      "Identity verification against an enrolled reference face",
      "Automatic fallback to a deterministic stub if ML deps are absent",
      "Configurable detection thresholds via a pipeline config file",
      "Frame retention disabled by default for privacy",
    ],
  },
  {
    category: "Behavior Analysis",
    icon: Activity,
    items: [
      "Four-tier escalation: Normal, Warning, Suspicious, Critical",
      "Weighted, time-windowed scoring across event types",
      "Critical-on-sight events (e.g. identity mismatch) escalate instantly",
      "Automatic intervention recommendations",
      "Behavior log and alert history with resolve / resolve-all actions",
    ],
  },
  {
    category: "Security & Access",
    icon: ShieldCheck,
    items: [
      "JWT authentication with access, refresh, and verify flows",
      "OTP email verification during registration",
      "Role-based access control layered with per-user permissions",
      "Production hardening: HSTS, secure cookies, SSL proxy",
      "Secure data storage with consent",
    ],
  },
  {
    category: "Reporting & Analytics",
    icon: LineChart,
    items: [
      "Dashboard KPI summaries and day-by-day timeseries",
      "Per-department and per-exam item analytics",
      "Pass-rate, severity, and behavior-event breakdowns",
      "Session detail and event-timeline views",
      "CSV and PDF export",
    ],
  },
  {
    category: "Real-time Infrastructure",
    icon: Camera,
    items: [
      "Per-session WebSocket monitoring channel",
      "Dedicated admin live-alerts broadcast channel",
      "JWT-authenticated WebSocket connections",
      "Redis-ready channel layer for multi-worker deployments",
      "Served over ASGI via Django Channels and Daphne",
    ],
  },
];

const techStack = [
  {
    name: "Backend",
    description: "Django, DRF, SimpleJWT, and Channels for HTTP + WebSocket",
    icon: FileCheck,
  },
  {
    name: "Frontend",
    description: "React, Vite, TypeScript, Tailwind, and TanStack Query",
    icon: LineChart,
  },
  {
    name: "AI / Computer Vision",
    description: "MediaPipe-based detection pipeline with stub fallback",
    icon: Brain,
  },
  {
    name: "Data Storage",
    description: "SQLite in development, PostgreSQL in production",
    icon: Database,
  },
];

const detectionModels = [
  "MediaPipe for face and pose detection",
  "Face-embedding matching for identity verification",
  "FaceNet/ArcFace-grade embeddings on the roadmap",
  "Deterministic stub fallback when ML deps are unavailable",
];

const analysisFeatures = [
  "Face detection & tracking",
  "Head pose estimation",
  "Eye gaze tracking",
  "Posture recognition",
];

const workflowSteps = [
  "Faculty authors an exam; a Program Head reviews and approves it",
  "Student logs in and starts an exam session",
  "Identity is verified against the enrolled reference face",
  "Webcam frames are analyzed in real time by the AI pipeline",
  "Behavior scoring escalates events from Normal toward Critical",
  "Critical events and identity mismatches trigger instant admin alerts",
  "Objective items auto-grade; essays go to Speed Grader for review",
  "Reports, analytics, and CSV/PDF exports are generated after completion",
];

const metrics = [
  { value: "140+", label: "Automated backend tests" },
  { value: "6", label: "Roles & permission tiers" },
  { value: "4", label: "Behavior escalation tiers" },
];

export function FeaturesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl py-4">
      {/* Hero */}
      <header className="mx-auto mb-16 max-w-3xl text-center">
        <StampChip>Platform capabilities</StampChip>
        <h1 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          Platform Features
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          A comprehensive examination platform powered by advanced AI and computer vision
          technology to ensure academic integrity.
        </p>
      </header>

      {/* Capability index — numbered custom cards */}
      <section className="mb-24">
        <SectionHeading
          kicker="Capability index"
          title="Eight systems, one platform"
          description="Every capability is catalogued below — from authoring an exam to the report that lands on the examiner's desk."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((feature, i) => (
            <IndexCard
              key={feature.category}
              index={String(i + 1).padStart(2, "0")}
              icon={feature.icon}
              title={feature.category}
            >
              <TickList items={feature.items} />
            </IndexCard>
          ))}
        </div>
      </section>

      {/* Instrument rack — one panel, divided cells */}
      <section className="mb-24">
        <SectionHeading
          kicker="Under the hood"
          title="Technology Stack"
          description="The frameworks and services running underneath every feature above."
        />
        <div className="surface-panel grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {techStack.map((tech, i) => (
            <div key={tech.name} className="relative p-6 sm:p-7">
              <span className="portal-index absolute right-5 top-5" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <tech.icon className="h-7 w-7 text-primary" weight="light" />
              <h3 className="mt-4 font-serif text-lg font-semibold tracking-tight">
                {tech.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {tech.description}
              </p>
            </div>
          ))}
        </div>

        {/* Spec sheet */}
        <div className="tick-frame surface-panel mx-auto mt-10 max-w-4xl p-7 sm:p-9">
          <span className="tick-frame-corners" aria-hidden />
          <h3 className="text-center font-serif text-2xl font-semibold tracking-tight">
            AI Capabilities
          </h3>
          <div className="mt-7 grid gap-x-12 gap-y-8 md:grid-cols-2">
            <div>
              <p className="kicker mb-4">Detection models</p>
              <ol className="space-y-2.5">
                {detectionModels.map((item, i) => (
                  <li key={item} className="flex items-baseline gap-3 text-sm">
                    <span className="font-mono text-[0.6875rem] text-gold">
                      D{i + 1}
                    </span>
                    <span className="flex-1 border-b border-dotted border-border/80 pb-1 text-muted-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="kicker mb-4">Analysis features</p>
              <ol className="space-y-2.5">
                {analysisFeatures.map((item, i) => (
                  <li key={item} className="flex items-baseline gap-3 text-sm">
                    <span className="font-mono text-[0.6875rem] text-gold">
                      A{i + 1}
                    </span>
                    <span className="flex-1 border-b border-dotted border-border/80 pb-1 text-muted-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow — timeline spine */}
      <section className="mb-24">
        <SectionHeading
          kicker="How it runs"
          title="Complete Workflow"
          description="End-to-end process from exam creation to behavioral reporting."
        />
        <ol className="relative mx-auto max-w-2xl space-y-0 border-l border-border pl-0">
          {workflowSteps.map((step, index) => (
            <li key={step} className="relative flex items-start gap-5 pb-7 pl-8 last:pb-0">
              <span
                className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rotate-45 border border-gold/70 bg-background"
                aria-hidden
              />
              <span className="w-8 shrink-0 pt-0.5 font-mono text-xs font-medium tabular-nums text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-[0.9375rem] leading-relaxed text-foreground/85">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Metrics band */}
      <section className="mb-8">
        <SectionHeading kicker="By the numbers" title="Platform at a Glance" />
        <div className="surface-panel mx-auto grid max-w-4xl grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {metrics.map((metric) => (
            <div key={metric.label} className="p-8 text-center">
              <p className="font-mono text-4xl font-medium tabular-nums tracking-tight text-primary">
                {metric.value}
              </p>
              <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
