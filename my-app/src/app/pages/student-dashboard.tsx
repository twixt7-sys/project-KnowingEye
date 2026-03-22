import { useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Eye,
} from "lucide-react";

export function StudentDashboard() {
  const [showExamInstructions, setShowExamInstructions] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);

  const upcomingExams = [
    {
      id: "1",
      title: "Database Systems Final Exam",
      course: "CS401",
      date: "2026-03-22",
      time: "10:00 AM",
      duration: "2 hours",
      status: "Ready to Start",
      type: "upcoming",
    },
    {
      id: "2",
      title: "Web Development Midterm",
      course: "CS302",
      date: "2026-03-22",
      time: "2:00 PM",
      duration: "90 mins",
      status: "Scheduled",
      type: "upcoming",
    },
    {
      id: "3",
      title: "Data Structures Quiz",
      course: "CS201",
      date: "2026-03-23",
      time: "9:00 AM",
      duration: "1 hour",
      status: "Scheduled",
      type: "upcoming",
    },
  ];

  const completedExams = [
    {
      id: "4",
      title: "Network Security Final",
      course: "CS405",
      date: "2026-03-21",
      score: 85,
      totalQuestions: 50,
      behaviorScore: 92,
      status: "Completed",
    },
    {
      id: "5",
      title: "Algorithm Analysis Midterm",
      course: "CS303",
      date: "2026-03-20",
      score: 78,
      totalQuestions: 40,
      behaviorScore: 88,
      status: "Completed",
    },
  ];

  const handleStartExam = (exam: any) => {
    setSelectedExam(exam);
    setShowExamInstructions(true);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            My Examinations
          </h1>
          <p className="text-muted-foreground">
            View your upcoming and completed exams
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">3</div>
                <div className="text-sm text-muted-foreground">
                  Upcoming Exams
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">2</div>
                <div className="text-sm text-muted-foreground">
                  Completed
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">81.5%</div>
                <div className="text-sm text-muted-foreground">
                  Avg Score
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Exams */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Upcoming Exams</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {upcomingExams.map((exam) => (
              <div
                key={exam.id}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      {exam.course}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {exam.title}
                    </h3>
                  </div>
                  {exam.status === "Ready to Start" && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                      Ready
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{exam.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      {exam.time} • {exam.duration}
                    </span>
                  </div>
                </div>

                {exam.status === "Ready to Start" ? (
                  <button
                    onClick={() => handleStartExam(exam)}
                    className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <PlayCircle className="w-5 h-5" />
                    Start Exam
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2 px-4 rounded-lg border border-border text-muted-foreground cursor-not-allowed"
                  >
                    Starts {exam.time}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Completed Exams */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Completed Exams</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Behavior
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {completedExams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-accent/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{exam.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {exam.course}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {exam.date}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-semibold">
                            {exam.score}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ({Math.round((exam.score / 100) * exam.totalQuestions)}/{exam.totalQuestions})
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full max-w-[100px] h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-secondary"
                              style={{ width: `${exam.behaviorScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {exam.behaviorScore}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/student/exam/${exam.id}/results`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Exam Instructions Modal */}
      {showExamInstructions && selectedExam && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowExamInstructions(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-1">
                  Exam Instructions
                </h3>
                <p className="text-muted-foreground">{selectedExam.title}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-lg bg-accent/50 border border-border">
                <h4 className="font-semibold mb-2">Before You Begin:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>
                      Ensure your webcam is working and positioned to clearly
                      show your face
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>
                      You will be monitored throughout the exam using AI-powered
                      facial and behavioral analysis
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>
                      Do not leave the exam window or look away from the screen
                      frequently
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>
                      Keep your workspace clear of unauthorized materials
                    </span>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-border">
                <h4 className="font-semibold mb-2">Exam Details:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <div className="font-medium">{selectedExam.duration}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Course:</span>
                    <div className="font-medium">{selectedExam.course}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-orange-600 dark:text-orange-400 mb-1">
                      Important Notice
                    </p>
                    <p className="text-orange-600/80 dark:text-orange-400/80">
                      By clicking "I Agree & Start", you consent to video
                      monitoring and behavioral analysis during this examination.
                      All data will be used solely for academic integrity
                      purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExamInstructions(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <Link
                to={`/student/exam/${selectedExam.id}`}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium hover:opacity-90 transition-opacity text-center"
              >
                I Agree & Start
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
