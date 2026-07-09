import {
  Camera,
  Brain,
  Eye,
  ShieldCheck,
  LineChart,
  FileCheck,
  Activity,
  Video,
  Database,
} from "lucide-react";

import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";

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

export function FeaturesPage() {
  return (
    <div className="w-full max-w-6xl py-4">
      <PageHeaderV2
        title="Platform Features"
        description="A comprehensive examination platform powered by advanced AI and computer vision technology to ensure academic integrity."
        className="text-center [&_.page-description]:mx-auto [&_.page-description]:max-w-3xl"
      />

      <section className="mb-20">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((feature) => (
            <div
              key={feature.category}
              className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-4 text-xl font-semibold">{feature.category}</h3>
              <ul className="space-y-2">
                {feature.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20 rounded-2xl bg-gradient-to-b from-accent/20 to-transparent py-16">
        <PageHeaderV2
          title="AI Technology Stack"
          description="Powered by state-of-the-art deep learning and computer vision models"
          className="text-center [&_.page-description]:mx-auto [&_.page-description]:max-w-2xl"
        />

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {techStack.map((tech) => (
            <div
              key={tech.name}
              className="rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary/50"
            >
              <tech.icon className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 font-semibold">{tech.name}</h3>
              <p className="text-sm text-muted-foreground">{tech.description}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card p-8">
          <h3 className="mb-6 text-2xl font-semibold">AI Capabilities</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-semibold text-primary">Detection Models</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>MediaPipe for face and pose detection</li>
                <li>CNN for feature extraction</li>
                <li>FaceNet for face recognition</li>
                <li>ArcFace for identity verification</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-semibold text-secondary">Analysis Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Face detection & tracking</li>
                <li>Head pose estimation</li>
                <li>Eye gaze tracking</li>
                <li>Posture recognition</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-20">
        <PageHeaderV2
          title="Complete Workflow"
          description="End-to-end process from exam creation to behavioral reporting"
          className="text-center [&_.page-description]:mx-auto [&_.page-description]:max-w-2xl"
        />

        <div className="mx-auto max-w-3xl space-y-4">
          {workflowSteps.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white">
                {index + 1}
              </div>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-gradient-to-b from-transparent via-accent/20 to-transparent py-16">
        <PageHeaderV2 title="Performance Metrics" className="text-center" />
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
          {[
            { value: "95%+", label: "Detection Accuracy" },
            { value: "<100ms", label: "Response Latency" },
            { value: "100%", label: "Automated Monitoring" },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-border bg-card p-8 text-center"
            >
              <div className="mb-2 font-serif text-4xl font-semibold text-primary">
                {metric.value}
              </div>
              <p className="text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
