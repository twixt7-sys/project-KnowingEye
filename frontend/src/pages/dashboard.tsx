import { useEffect, useState } from "react";
import { apiClient } from "../core/config/api";
import {
  Users,
  FileText,
  Activity,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  Clock,
  Eye,
  TrendingUp,
  Play,
  Pause,
  Square,
  Settings,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router";

export function Dashboard() {
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [showExamControlModal, setShowExamControlModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [examTimers, setExamTimers] = useState<{ [key: string]: number }>({
    "1": 7200,
    "2": 5400,
  });
  const [examStatus, setExamStatus] = useState<{ [key: string]: "running" | "paused" | "stopped" }>({
    "1": "running",
    "2": "running",
  });

  const [reportStats, setReportStats] = useState<{
    total_sessions: number;
    active_sessions: number;
    unresolved_alerts: number;
    behavior_events: number;
  } | null>(null);

  useEffect(() => {
    apiClient
      .getReportSummary()
      .then((data) => setReportStats(data))
      .catch(() => setReportStats(null));
  }, []);

  const stats = [
    {
      label: "Active Sessions",
      value: reportStats ? String(reportStats.active_sessions) : "—",
      change: reportStats ? `${reportStats.total_sessions} total` : "Loading…",
      icon: Activity,
      color: "from-green-500 to-green-600",
    },
    {
      label: "Behavior Events",
      value: reportStats ? String(reportStats.behavior_events) : "—",
      change: "From monitoring pipeline",
      icon: BarChart3,
      color: "from-violet-500 to-violet-600",
    },
    {
      label: "Unresolved Alerts",
      value: reportStats ? String(reportStats.unresolved_alerts) : "—",
      change: "Requires review",
      icon: AlertTriangle,
      color: "from-amber-500 to-amber-600",
    },
    {
      label: "Flagged Events",
      value: "18",
      change: "Needs review",
      icon: AlertTriangle,
      color: "from-orange-500 to-orange-600",
    },
  ];

  const recentExams = [
    {
      id: "1",
      title: "Database Systems Final Exam",
      students: 45,
      status: "Active",
      date: "2026-03-22",
      time: "10:00 AM",
      duration: "2 hours",
      flagged: 3,
    },
    {
      id: "2",
      title: "Web Development Midterm",
      students: 38,
      status: "Active",
      date: "2026-03-22",
      time: "2:00 PM",
      duration: "90 mins",
      flagged: 1,
    },
    {
      id: "3",
      title: "Data Structures Quiz",
      students: 52,
      status: "Scheduled",
      date: "2026-03-23",
      time: "9:00 AM",
      duration: "1 hour",
      flagged: 0,
    },
    {
      id: "4",
      title: "Network Security Final",
      students: 41,
      status: "Completed",
      date: "2026-03-21",
      time: "3:00 PM",
      duration: "2 hours",
      flagged: 5,
    },
  ];

  const recentAlerts = [
    {
      student: "John Doe",
      exam: "Database Systems Final",
      type: "Multiple faces detected",
      severity: "high",
      time: "2 min ago",
    },
    {
      student: "Jane Smith",
      exam: "Web Development Midterm",
      type: "Looking away frequently",
      severity: "medium",
      time: "5 min ago",
    },
    {
      student: "Mike Johnson",
      exam: "Database Systems Final",
      type: "Object detected in frame",
      severity: "high",
      time: "8 min ago",
    },
  ];

  const handleViewMonitoring = (examId: string) => {
    setSelectedExam(examId);
    setShowMonitoringModal(true);
  };

  const handleExamControl = (examId: string) => {
    const exam = recentExams.find((e) => e.id === examId);
    setSelectedExam(exam);
    setShowExamControlModal(true);
  };

  const handleStartExam = (examId: string) => {
    setExamStatus((prevStatus) => ({
      ...prevStatus,
      [examId]: "running",
    }));
  };

  const handlePauseExam = (examId: string) => {
    setExamStatus((prevStatus) => ({
      ...prevStatus,
      [examId]: "paused",
    }));
  };

  const handleStopExam = (examId: string) => {
    setExamStatus((prevStatus) => ({
      ...prevStatus,
      [examId]: "stopped",
    }));
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor exams and analyze student behavior in real-time
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-muted-foreground">{stat.change}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Exams List */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border border-border">
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-semibold">Examinations</h2>
                  <button
                    onClick={() => setShowCreateExamModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Exam
                  </button>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search exams..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors">
                    <Filter className="w-4 h-4" />
                    Filter
                  </button>
                </div>
              </div>

              <div className="divide-y divide-border">
                {recentExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-6 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{exam.title}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {exam.students} students
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {exam.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {exam.time}
                          </span>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          exam.status === "Active"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : exam.status === "Scheduled"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {exam.status}
                      </span>
                      {exam.flagged > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                          {exam.flagged} flagged
                        </span>
                      )}
                      <button
                        onClick={() => handleViewMonitoring(exam.id)}
                        className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Monitor
                      </button>
                      <button
                        onClick={() => handleExamControl(exam.id)}
                        className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Control
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold">Recent Alerts</h2>
              </div>

              <div className="divide-y divide-border">
                {recentAlerts.map((alert, index) => (
                  <div key={index} className="p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          alert.severity === "high"
                            ? "bg-red-500"
                            : "bg-orange-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm mb-1">
                          {alert.student}
                        </p>
                        <p className="text-xs text-muted-foreground mb-1">
                          {alert.exam}
                        </p>
                        <p className="text-sm mb-2">{alert.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border">
                <button className="w-full text-center text-sm text-primary hover:underline">
                  View all alerts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Exam Modal */}
      {showCreateExamModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateExamModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Create New Exam</h3>
              <button
                onClick={() => setShowCreateExamModal(false)}
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

            <form className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Exam Title</label>
                <input
                  type="text"
                  placeholder="e.g., Database Systems Final Exam"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Time</label>
                  <input
                    type="time"
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  placeholder="120"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm mb-2">Description</label>
                <textarea
                  rows={4}
                  placeholder="Enter exam description..."
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Create Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monitoring Modal */}
      {showMonitoringModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMonitoringModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Live Monitoring</h3>
              <button
                onClick={() => setShowMonitoringModal(false)}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video feeds */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                    <Eye className="w-12 h-12 text-muted-foreground" />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded">
                      Live
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      Student {i}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Behavior Score: 92%
                    </span>
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded">
                      Normal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exam Control Modal */}
      {showExamControlModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExamControlModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Exam Control</h3>
              <button
                onClick={() => setShowExamControlModal(false)}
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-semibold">Exam: {selectedExam.title}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      examStatus[selectedExam.id] === "running"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : examStatus[selectedExam.id] === "paused"
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {examStatus[selectedExam.id]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleStartExam(selectedExam.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
                <button
                  onClick={() => handlePauseExam(selectedExam.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
                <button
                  onClick={() => handleStopExam(selectedExam.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm text-muted-foreground">
                    Time Remaining:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {Math.floor(examTimers[selectedExam.id] / 3600)}h
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.floor((examTimers[selectedExam.id] % 3600) / 60)}m
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {examTimers[selectedExam.id] % 60}s
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </button>
                <Link
                  to={`/exams/${selectedExam.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}