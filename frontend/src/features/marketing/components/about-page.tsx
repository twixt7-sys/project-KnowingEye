import { Award, Lightbulb, Target } from "lucide-react";

import { brand } from "@/core/config/brand";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";

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

export function AboutPage() {
  return (
    <div className="w-full max-w-6xl py-4">
      <PageHeaderV2
        title="About Knowing Eye"
        description="A Web-Based Examination Platform with Behavior Monitoring Using Facial and Postural Analysis"
        className="text-center [&_.page-description]:mx-auto [&_.page-description]:max-w-4xl"
      />
      <div className="mb-20 text-center">
        <div className="inline-block rounded-lg bg-accent px-4 py-2 text-accent-foreground">
          Capstone Project 2026
        </div>
      </div>

      <section className="mb-20 rounded-2xl bg-gradient-to-b from-accent/20 to-transparent py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                <Lightbulb className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-semibold">The Problem</h3>
              <p className="text-muted-foreground">
                Online examination systems lack reliable real-time monitoring, leading to increased
                risk of cheating and heavy reliance on manual supervision.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-semibold">Our Solution</h3>
              <p className="text-muted-foreground">
                A full-stack web-based examination platform integrated with AI-powered behavioral
                monitoring using computer vision and deep learning to enhance exam integrity and
                automate monitoring.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-20">
        <PageHeaderV2
          title="Project Objectives"
          description="To design and develop a centralized web-based examination platform with integrated real-time behavioral monitoring"
          className="text-center [&_.page-description]:mx-auto [&_.page-description]:max-w-2xl"
        />
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          {objectives.map((objective, index) => (
            <div
              key={objective}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-sm">{objective}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-20 rounded-2xl bg-gradient-to-b from-transparent via-accent/20 to-transparent py-16">
        <div className="mx-auto max-w-4xl">
          <PageHeaderV2 title="System Scope" className="text-center" />
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 text-xl font-semibold text-green-600 dark:text-green-400">
                Included Features
              </h3>
              <ul className="space-y-2 text-muted-foreground">
                {[
                  "Web-based examination platform",
                  "Real-time webcam monitoring",
                  "Facial detection and posture analysis",
                  "Behavior scoring and anomaly detection",
                  "Admin dashboard with reports",
                  "Session logging and storage",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 text-xl font-semibold text-muted-foreground">Out of Scope</h3>
              <ul className="space-y-2 text-muted-foreground">
                {[
                  "Mobile application support",
                  "External system integrations",
                  "Biometric hardware devices",
                  "Nationwide deployment",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-20">
        <PageHeaderV2
          title="Development Team"
          description={`${brand.departmentName} · ${brand.institutionName}`}
          className="text-center [&_.page-description]:mx-auto"
        />
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                {member.name.charAt(0)}
              </div>
              <h3 className="mb-1 font-semibold">{member.name}</h3>
              <p className="text-sm text-muted-foreground">{member.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-gradient-to-b from-transparent via-accent/20 to-transparent py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Award className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Legacy College of Compostela</h2>
          <p className="mb-4 text-lg text-muted-foreground">{brand.departmentName}</p>
          <p className="text-muted-foreground">Compostela, Davao de Oro, Philippines</p>
        </div>
      </section>
    </div>
  );
}
