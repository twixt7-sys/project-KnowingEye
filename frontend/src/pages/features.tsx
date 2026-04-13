import {
  Camera,
  Brain,
  Eye,
  ShieldCheck,
  LineChart,
  FileCheck,
  Users,
  Clock,
  AlertTriangle,
  Video,
  Activity,
  Database,
} from "lucide-react";

export function Features() {
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
        "Real-time facial detection using YOLO",
        "Head pose estimation and tracking",
        "Eye gaze direction analysis",
        "Posture recognition and classification",
        "Object detection (phones, notes, etc.)",
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

  return (
    <div className="min-h-screen py-12">
      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Platform Features
          </h1>
          <p className="text-lg text-muted-foreground">
            A comprehensive examination platform powered by advanced AI and
            computer vision technology to ensure academic integrity
          </p>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {coreFeatures.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-4">
                {feature.category}
              </h3>
              <ul className="space-y-2">
                {feature.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* AI Models Section */}
      <section className="py-16 bg-gradient-to-b from-accent/20 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">AI Technology Stack</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powered by state-of-the-art deep learning and computer vision
              models
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {techStack.map((tech, index) => (
              <div
                key={index}
                className="p-6 rounded-xl bg-card border border-border text-center hover:border-primary/50 transition-colors"
              >
                <tech.icon className="w-10 h-10 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">{tech.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {tech.description}
                </p>
              </div>
            ))}
          </div>

          <div className="max-w-4xl mx-auto bg-card rounded-xl border border-border p-8">
            <h3 className="text-2xl font-semibold mb-6">AI Capabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 text-primary">
                  Detection Models
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    YOLO for object detection
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    CNN for feature extraction
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    FaceNet for face recognition
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    ArcFace for identity verification
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-secondary">
                  Analysis Features
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-secondary" />
                    Face detection & tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-secondary" />
                    Head pose estimation
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-secondary" />
                    Eye gaze tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-secondary" />
                    Posture recognition
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Complete Workflow</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            End-to-end process from exam creation to behavioral reporting
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {[
            "User logs in and starts exam session",
            "System verifies identity via face recognition",
            "Webcam streams are captured in real time",
            "AI models analyze facial and postural behavior",
            "Behavior scoring engine evaluates actions",
            "Suspicious events are flagged and logged",
            "Admin monitors sessions via dashboard",
            "Reports are generated after exam completion",
          ].map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                {index + 1}
              </div>
              <p className="text-foreground">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="py-16 bg-gradient-to-b from-transparent via-accent/20 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Performance Metrics</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-8 rounded-xl bg-card border border-border">
              <div className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                95%+
              </div>
              <p className="text-muted-foreground">Detection Accuracy</p>
            </div>
            <div className="text-center p-8 rounded-xl bg-card border border-border">
              <div className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                &lt;100ms
              </div>
              <p className="text-muted-foreground">Response Latency</p>
            </div>
            <div className="text-center p-8 rounded-xl bg-card border border-border">
              <div className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                100%
              </div>
              <p className="text-muted-foreground">Automated Monitoring</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
