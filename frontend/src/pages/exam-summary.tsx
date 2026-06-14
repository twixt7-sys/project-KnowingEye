import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  Camera,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";

export function ExamSummary() {
  const { examId } = useParams();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Mock data
  const examData = {
    title: "Database Systems Final Exam",
    course: "CS401",
    date: "2026-03-21",
    duration: "2 hours",
    totalStudents: 45,
    completed: 45,
    averageScore: 81.5,
    averageBehavior: 87.3,
  };

  const students = [
    {
      id: 1,
      name: "John Doe",
      score: 85,
      behaviorScore: 92,
      timeSpent: "1h 45m",
      flagged: 2,
      faceDetection: 98,
      gazeFocus: 89,
      postureStability: 92,
      anomalyScore: 95,
      status: "completed",
    },
    {
      id: 2,
      name: "Jane Smith",
      score: 92,
      behaviorScore: 96,
      timeSpent: "1h 50m",
      flagged: 0,
      faceDetection: 99,
      gazeFocus: 95,
      postureStability: 94,
      anomalyScore: 98,
      status: "completed",
    },
    {
      id: 3,
      name: "Mike Johnson",
      score: 78,
      behaviorScore: 73,
      timeSpent: "1h 55m",
      flagged: 8,
      faceDetection: 85,
      gazeFocus: 72,
      postureStability: 68,
      anomalyScore: 67,
      status: "completed",
    },
    {
      id: 4,
      name: "Sarah Williams",
      score: 88,
      behaviorScore: 91,
      timeSpent: "1h 42m",
      flagged: 1,
      faceDetection: 97,
      gazeFocus: 88,
      postureStability: 90,
      anomalyScore: 94,
      status: "completed",
    },
    {
      id: 5,
      name: "David Brown",
      score: 76,
      behaviorScore: 82,
      timeSpent: "1h 58m",
      flagged: 4,
      faceDetection: 91,
      gazeFocus: 80,
      postureStability: 79,
      anomalyScore: 78,
      status: "completed",
    },
  ];

  const behaviorMetrics = [
    {
      label: "Face Detection Rate",
      average: 94,
      icon: Camera,
      description: "Average face detection across all students",
    },
    {
      label: "Gaze Focus",
      average: 85,
      icon: Eye,
      description: "Average gaze focus score",
    },
    {
      label: "Posture Stability",
      average: 87,
      icon: Activity,
      description: "Average posture consistency",
    },
    {
      label: "Anomaly Detection",
      average: 86,
      icon: AlertTriangle,
      description: "Average anomaly-free score",
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-blue-600 dark:text-blue-400";
    if (score >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getBehaviorColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-blue-500";
    if (score >= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  const handleViewStudent = (student: any) => {
    setSelectedStudent(student);
    setShowStudentModal(true);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/examiner"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{examData.title}</h1>
              <p className="text-muted-foreground">
                {examData.course} • {examData.date} • {examData.duration}
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{examData.completed}</div>
                <div className="text-sm text-muted-foreground">
                  Completed
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              of {examData.totalStudents} students
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{examData.averageScore}%</div>
                <div className="text-sm text-muted-foreground">
                  Avg Score
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingUp className="w-3 h-3" />
              Above expected
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{examData.averageBehavior}%</div>
                <div className="text-sm text-muted-foreground">
                  Avg Behavior
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Excellent compliance
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">15</div>
                <div className="text-sm text-muted-foreground">
                  Total Flags
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              3 students flagged
            </div>
          </div>
        </div>

        {/* Behavior Metrics Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Behavior Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {behaviorMetrics.map((metric, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <metric.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className={`text-2xl font-bold ${getScoreColor(metric.average)}`}>
                    {metric.average}%
                  </span>
                </div>
                <h3 className="font-semibold mb-1">{metric.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-semibold">Student Results</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Exam Score
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Behavior
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Flags
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-accent/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold">
                          {student.name.charAt(0)}
                        </div>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-lg font-semibold ${getScoreColor(student.score)}`}>
                        {student.score}%
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getBehaviorColor(student.behaviorScore)}`}
                            style={{ width: `${student.behaviorScore}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {student.behaviorScore}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {student.timeSpent}
                    </td>
                    <td className="px-6 py-4">
                      {student.flagged > 0 ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                          {student.flagged} flags
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                          Clean
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewStudent(student)}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Student Detail Modal */}
      {showStudentModal && selectedStudent && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowStudentModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-semibold mb-1">
                  {selectedStudent.name}
                </h3>
                <p className="text-muted-foreground">
                  Detailed Behavior Analysis
                </p>
              </div>
              <button
                onClick={() => setShowStudentModal(false)}
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

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground mb-1">
                  Exam Score
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(selectedStudent.score)}`}>
                  {selectedStudent.score}%
                </div>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground mb-1">
                  Behavior Score
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(selectedStudent.behaviorScore)}`}>
                  {selectedStudent.behaviorScore}%
                </div>
              </div>
            </div>

            {/* Behavior Metrics */}
            <h4 className="font-semibold mb-4">Behavior Parameters</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                {
                  label: "Face Detection",
                  score: selectedStudent.faceDetection,
                  icon: Camera,
                },
                {
                  label: "Gaze Focus",
                  score: selectedStudent.gazeFocus,
                  icon: Eye,
                },
                {
                  label: "Posture Stability",
                  score: selectedStudent.postureStability,
                  icon: Activity,
                },
                {
                  label: "Anomaly Score",
                  score: selectedStudent.anomalyScore,
                  icon: CheckCircle,
                },
              ].map((metric, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <metric.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{metric.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getBehaviorColor(metric.score)}`}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-12">
                      {metric.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div
              className={`p-4 rounded-lg border ${
                selectedStudent.behaviorScore >= 90
                  ? "bg-green-500/10 border-green-500/20"
                  : selectedStudent.behaviorScore >= 70
                  ? "bg-blue-500/10 border-blue-500/20"
                  : "bg-orange-500/10 border-orange-500/20"
              }`}
            >
              <div className="flex items-start gap-3">
                {selectedStudent.behaviorScore >= 90 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p
                    className={`font-semibold mb-1 ${
                      selectedStudent.behaviorScore >= 90
                        ? "text-green-600 dark:text-green-400"
                        : "text-orange-600 dark:text-orange-400"
                    }`}
                  >
                    {selectedStudent.behaviorScore >= 90
                      ? "Excellent Behavior"
                      : selectedStudent.behaviorScore >= 70
                      ? "Good Behavior"
                      : "Flagged for Review"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent.behaviorScore >= 90
                      ? "No suspicious activities detected during the examination."
                      : selectedStudent.behaviorScore >= 70
                      ? "Minor behavioral anomalies detected but within acceptable range."
                      : "Multiple suspicious activities detected. Manual review recommended."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
