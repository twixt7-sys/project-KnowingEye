import { Users, Target, Lightbulb, Award } from "lucide-react";

export function About() {
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

  return (
    <div className="min-h-screen py-12">
      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About Knowing Eye
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            A Web-Based Examination Platform with Behavior Monitoring Using
            Facial and Postural Analysis
          </p>
          <div className="inline-block px-4 py-2 rounded-lg bg-accent text-accent-foreground">
            Capstone Project 2026
          </div>
        </div>
      </section>

      {/* Vision & Problem */}
      <section className="py-16 bg-gradient-to-b from-accent/20 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">The Problem</h3>
                <p className="text-muted-foreground">
                  Online examination systems lack reliable real-time monitoring,
                  leading to increased risk of cheating and heavy reliance on
                  manual supervision.
                </p>
              </div>

              <div className="p-8 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Our Solution</h3>
                <p className="text-muted-foreground">
                  A full-stack web-based examination platform integrated with
                  AI-powered behavioral monitoring using computer vision and deep
                  learning to enhance exam integrity and automate monitoring.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Project Objectives</h2>
            <p className="text-lg text-muted-foreground">
              To design and develop a centralized web-based examination platform
              with integrated real-time behavioral monitoring
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {objectives.map((objective, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-semibold mt-0.5">
                  {index + 1}
                </div>
                <p className="text-sm">{objective}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Scope */}
      <section className="py-16 bg-gradient-to-b from-transparent via-accent/20 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              System Scope
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
                  Included Features
                </h3>
                <ul className="space-y-2">
                  {[
                    "Web-based examination platform",
                    "Real-time webcam monitoring",
                    "Facial detection and posture analysis",
                    "Behavior scoring and anomaly detection",
                    "Admin dashboard with reports",
                    "Session logging and storage",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="text-xl font-semibold mb-4 text-muted-foreground">
                  Out of Scope
                </h3>
                <ul className="space-y-2">
                  {[
                    "Mobile application support",
                    "External system integrations",
                    "Biometric hardware devices",
                    "Nationwide deployment",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 rounded-xl bg-card border border-border">
              <h3 className="text-xl font-semibold mb-4">Target Users</h3>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 rounded-lg bg-primary/10 text-primary">
                  Exam Administrators
                </span>
                <span className="px-4 py-2 rounded-lg bg-secondary/10 text-secondary">
                  Examinees
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Environment: Controlled academic testing environment with
                simulated exam sessions
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Development Team</h2>
            <p className="text-lg text-muted-foreground">
              Institute of Information Technology
              <br />
              Legacy College of Compostela
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {team.map((member, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                  {member.name.charAt(0)}
                </div>
                <h3 className="font-semibold mb-1">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institution */}
      <section className="py-16 bg-gradient-to-b from-transparent via-accent/20 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl bg-card border border-border">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Legacy College of Compostela
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              Institute of Information Technology
            </p>
            <p className="text-muted-foreground">
              Compostela, Davao de Oro, Philippines
            </p>
            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Project Type: Capstone Project
                <br />
                Date Started: March 2026
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Future Improvements */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Future Enhancements</h2>
            <p className="text-lg text-muted-foreground">
              Planned improvements for future versions
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              "Mobile application support",
              "Multi-camera monitoring",
              "Advanced AI behavior prediction",
              "Integration with institutional systems",
              "Scalable cloud deployment",
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-center"
              >
                <p className="text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
