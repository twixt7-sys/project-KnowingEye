import {
  Activity,
  Brain,
  Camera,
  Database,
  Eye,
  FileCheck,
  LineChart,
  ShieldCheck,
  Video,
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
      "Create and configure custom examinations",
      "Schedule and deploy exams to specific groups",
      "Manage examinee registrations and permissions",
      "Set time limits and auto-submission rules",
      "Question bank with multiple choice, essay, and more",
    ],
  },
  {
    category: "AI Monitoring",
    icon: Brain,
    items: [
      "Real-time facial detection using MediaPipe",
      "Head pose estimation and tracking",
      "Eye gaze direction analysis",
      "Posture recognition and classification",
      "Identity verification via face embeddings",
    ],
  },
  {
    category: "Behavior Analysis",
    icon: Activity,
    items: [
      "Automated behavior scoring engine",
      "Anomaly detection algorithms",
      "Event flagging for suspicious activities",
      "Pattern recognition for cheating behaviors",
      "Continuous monitoring throughout exam",
    ],
  },
  {
    category: "Security & Verification",
    icon: ShieldCheck,
    items: [
      "Face recognition identity verification",
      "Multi-factor authentication",
      "Encrypted video streams (HTTPS)",
      "Role-based access control",
      "Secure data storage with consent",
    ],
  },
  {
    category: "Reporting & Analytics",
    icon: LineChart,
    items: [
      "Comprehensive behavioral reports",
      "Session playback and review",
      "Suspicion score dashboards",
      "Event timeline visualization",
      "Export data in multiple formats",
    ],
  },
  {
    category: "Real-time Features",
    icon: Camera,
    items: [
      "Live webcam monitoring",
      "WebSocket communication",
      "Instant anomaly alerts",
      "Admin live session view",
      "Real-time behavioral metrics",
    ],
  },
];

const techStack = [
  {
    name: "Computer Vision",
    description: "OpenCV for video processing and facial analysis",
    icon: Eye,
  },
  {
    name: "Deep Learning",
    description: "TensorFlow & PyTorch for AI model training",
    icon: Brain,
  },
  {
    name: "Video Processing",
    description: "Real-time stream capture and analysis",
    icon: Video,
  },
  {
    name: "Data Storage",
    description: "PostgreSQL for secure data management",
    icon: Database,
  },
];

const detectionModels = [
  "MediaPipe for face and pose detection",
  "CNN for feature extraction",
  "FaceNet for face recognition",
  "ArcFace for identity verification",
];

const analysisFeatures = [
  "Face detection & tracking",
  "Head pose estimation",
  "Eye gaze tracking",
  "Posture recognition",
];

const workflowSteps = [
  "User logs in and starts exam session",
  "System verifies identity via face recognition",
  "Webcam streams are captured in real time",
  "AI models analyze facial and postural behavior",
  "Behavior scoring engine evaluates actions",
  "Suspicious events are flagged and logged",
  "Admin monitors sessions via dashboard",
  "Reports are generated after exam completion",
];

const metrics = [
  { value: "95%+", label: "Detection accuracy" },
  { value: "<100ms", label: "Response latency" },
  { value: "100%", label: "Automated monitoring" },
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
          title="Six systems, one platform"
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
          title="AI Technology Stack"
          description="Powered by state-of-the-art deep learning and computer vision models."
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
        <SectionHeading kicker="Measured" title="Performance Metrics" />
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
