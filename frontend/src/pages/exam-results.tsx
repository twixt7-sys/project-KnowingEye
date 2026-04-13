import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Camera,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  BarChart3,
  Download,
  ArrowLeft,
} from "lucide-react";

export function ExamResults() {
  const { examId } = useParams();
  const [selectedTab, setSelectedTab] = useState<"overview" | "behavior" | "timeline">("overview");

  // Mock data
  const examData = {
    title: "Database Systems Final Exam",
    course: "CS401",
    date: "2026-03-21",
    score: 85,
    totalQuestions: 50,
    correctAnswers: 42,
    timeSpent: "1h 45m",
    behaviorScore: 92,
  };

  const behaviorMetrics = [
    {
      label: "Face Detection",
      score: 98,
      status: "excellent",
      icon: Camera,
      description: "Face detected 98% of the time",
    },
    {
      label: "Gaze Focus",
      score: 89,
      status: "good",
      icon: Eye,
      description: "Maintained focus on screen",
    },
    {
      label: "Posture Stability",
      score: 92,
      status: "excellent",
      icon: Activity,
      description: "Consistent posture maintained",
    },
    {
      label: "Anomaly Detection",
      score: 95,
      status: "excellent",
      icon: AlertTriangle,
      description: "No suspicious activities detected",
    },
  ];

  const events = [
    {
      time: "10:00:00",
      type: "info",
      message: "Exam started",
      severity: "normal",
    },
    {
      time: "10:15:23",
      type: "warning",
      message: "Looking away detected",
      severity: "low",
    },
    {
      time: "10:32:15",
      type: "success",
      message: "Question 20 completed",
      severity: "normal",
    },
    {
      time: "10:45:30",
      type: "warning",
      message: "Face not detected for 2 seconds",
      severity: "medium",
    },
    {
      time: "11:00:12",
      type: "success",
      message: "Question 35 completed",
      severity: "normal",
    },
    {
      time: "11:30:45",
      type: "warning",
      message: "Posture change detected",
      severity: "low",
    },
    {
      time: "11:45:00",
      type: "success",
      message: "Exam submitted",
      severity: "normal",
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-blue-600 dark:text-blue-400";
    if (score >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusColor = (status: string) => {
    if (status === "excellent") return "from-green-500 to-green-600";
    if (status === "good") return "from-blue-500 to-blue-600";
    if (status === "fair") return "from-orange-500 to-orange-600";
    return "from-red-500 to-red-600";
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{examData.title}</h1>
              <p className="text-muted-foreground">
                {examData.course} • {examData.date}
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors">
              <Download className="w-4 h-4" />
              Download Report
            </button>
          </div>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Exam Score</span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-3xl font-bold mb-1 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {examData.score}%
            </div>
            <div className="text-xs text-muted-foreground">
              {examData.correctAnswers}/{examData.totalQuestions} correct
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Behavior Score
              </span>
              <Activity className="w-4 h-4 text-green-500" />
            </div>
            <div className={`text-3xl font-bold mb-1 ${getScoreColor(examData.behaviorScore)}`}>
              {examData.behaviorScore}%
            </div>
            <div className="text-xs text-muted-foreground">
              Excellent compliance
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Time Spent</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-3xl font-bold mb-1">{examData.timeSpent}</div>
            <div className="text-xs text-muted-foreground">
              of 2h 00m available
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-3xl font-bold mb-1 text-green-600 dark:text-green-400">
              Passed
            </div>
            <div className="text-xs text-muted-foreground">
              No flags raised
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setSelectedTab("overview")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              selectedTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedTab("behavior")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              selectedTab === "behavior"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Behavior Analysis
          </button>
          <button
            onClick={() => setSelectedTab("timeline")}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              selectedTab === "timeline"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Event Timeline
          </button>
        </div>

        {/* Tab Content */}
        {selectedTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Chart */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Performance Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Correct Answers</span>
                    <span className="font-medium">{examData.correctAnswers}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-600"
                      style={{ width: `${(examData.correctAnswers / examData.totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Wrong Answers</span>
                    <span className="font-medium">{examData.totalQuestions - examData.correctAnswers}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-red-600"
                      style={{ width: `${((examData.totalQuestions - examData.correctAnswers) / examData.totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Exam Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Questions</span>
                  <span className="font-medium">{examData.totalQuestions}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Correct</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {examData.correctAnswers}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Wrong</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {examData.totalQuestions - examData.correctAnswers}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Final Score</span>
                  <span className="font-medium text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {examData.score}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "behavior" && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {behaviorMetrics.map((metric, index) => (
                <div
                  key={index}
                  className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getStatusColor(metric.status)} flex items-center justify-center`}>
                      <metric.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      metric.status === "excellent"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}>
                      {metric.status}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">{metric.label}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {metric.description}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getStatusColor(metric.status)}`}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold">{metric.score}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Overall Behavior Assessment</h3>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-600 dark:text-green-400 mb-1">
                      Excellent Behavior
                    </p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80">
                      Your behavior during the exam was exemplary. No suspicious activities were detected, and you maintained proper focus throughout the examination.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "timeline" && (
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-6">Event Timeline</h3>
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-20 text-sm text-muted-foreground font-mono">
                    {event.time}
                  </div>
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        event.type === "success"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : event.type === "warning"
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {event.type === "success" ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : event.type === "warning" ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 pb-4 border-b border-border last:border-0">
                    <p className="text-sm">{event.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
