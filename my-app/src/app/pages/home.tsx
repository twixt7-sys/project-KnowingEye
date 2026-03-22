import { Link } from "react-router";
import {
  Eye,
  ShieldCheck,
  LineChart,
  Camera,
  Brain,
  FileCheck,
  ArrowRight,
  Play,
} from "lucide-react";
import { useState } from "react";

export function Home() {
  const [showVideoModal, setShowVideoModal] = useState(false);

  const features = [
    {
      icon: Camera,
      title: "Real-time Monitoring",
      description:
        "Continuous webcam capture with AI-powered facial and postural analysis during exams",
    },
    {
      icon: Brain,
      title: "AI Behavior Detection",
      description:
        "Advanced deep learning models detect suspicious activities and anomalies in real-time",
    },
    {
      icon: Eye,
      title: "Gaze Tracking",
      description:
        "Precise eye movement and head pose estimation to monitor focus and attention",
    },
    {
      icon: ShieldCheck,
      title: "Identity Verification",
      description:
        "Face recognition technology ensures the right person is taking the exam",
    },
    {
      icon: LineChart,
      title: "Analytics Dashboard",
      description:
        "Comprehensive reports with behavior scores, anomaly flags, and session playback",
    },
    {
      icon: FileCheck,
      title: "Exam Management",
      description:
        "Complete platform for creating, scheduling, and deploying online examinations",
    },
  ];

  const stats = [
    { label: "Detection Accuracy", value: "95%" },
    { label: "Real-time Analysis", value: "<100ms" },
    { label: "Behavior Metrics", value: "15+" },
    { label: "Automated Monitoring", value: "100%" },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 text-accent-foreground text-sm mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              AI-Powered Exam Monitoring
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Knowing Eye
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-4">
              Web-Based Examination Platform
            </p>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Advanced behavior monitoring using facial and postural analysis to
              ensure exam integrity with automated AI detection
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button
                onClick={() => setShowVideoModal(true)}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-lg"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive AI-powered monitoring system designed to enhance exam
              integrity and automate supervision
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-b from-transparent via-accent/20 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Seamless workflow from exam creation to behavioral analysis
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {[
              {
                step: "01",
                title: "User Authentication",
                description:
                  "Students log in and their identity is verified using facial recognition",
              },
              {
                step: "02",
                title: "Exam Session Starts",
                description:
                  "Webcam streams are captured in real-time as the student takes the exam",
              },
              {
                step: "03",
                title: "AI Analysis",
                description:
                  "Deep learning models analyze facial expressions, gaze, and posture continuously",
              },
              {
                step: "04",
                title: "Behavior Scoring",
                description:
                  "Suspicious activities are detected, scored, and flagged automatically",
              },
              {
                step: "05",
                title: "Admin Dashboard",
                description:
                  "Administrators monitor sessions live and review comprehensive behavioral reports",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex gap-6 items-start p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center p-12 rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Join the future of online examination with AI-powered monitoring
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-white text-primary hover:bg-white/90 transition-colors text-lg font-semibold"
            >
              Launch Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold">Platform Demo</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  Demo video would be displayed here
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
