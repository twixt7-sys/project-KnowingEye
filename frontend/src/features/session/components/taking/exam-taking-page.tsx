import { AlertTriangle, Loader2 } from "@/shared/icons";

import { FocusShell } from "@/features/session/components/taking/focus-shell";
import { ProctoringDock } from "@/features/session/components/taking/proctoring-dock";
import { QuestionNavigator } from "@/features/session/components/taking/question-navigator";
import { QuestionPanel } from "@/features/session/components/taking/question-panel";
import { useExamTaking } from "@/features/session/hooks/use-exam-taking";

export function ExamTakingPage() {
  const {
    navigate,
    loading,
    error,
    submitting,
    session,
    attempt,
    questions,
    activeQuestion,
    currentQuestion,
    setCurrentQuestion,
    answeredCount,
    progress,
    flaggedCount,
    showSubmitModal,
    setShowSubmitModal,
    monitoring,
    monitoringEnabled,
    webcamActive,
    behaviorAlerts,
    feedOpen,
    setFeedOpen,
    enrolling,
    enrollMessage,
    dockPosition,
    setMonitoringDockPosition,
    handleReEnroll,
    handleAnswerSelect,
    toggleFlag,
    handleSubmit,
  } = useExamTaking();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Starting your exam session...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !activeQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Error Loading Exam</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/examinee")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const activeAnswer = attempt.answers[activeQuestion.id]?.answer_text ?? "";

  return (
    <FocusShell
      monitoringEnabled={monitoringEnabled}
      webcamActive={webcamActive}
      behaviorAlerts={behaviorAlerts}
      timeRemaining={attempt.timeRemaining}
      submitting={submitting}
      onSubmitClick={() => setShowSubmitModal(true)}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <QuestionPanel
              question={activeQuestion}
              questionIndex={currentQuestion}
              totalQuestions={questions.length}
              answer={attempt.answers[activeQuestion.id]}
              answerText={activeAnswer}
              submitting={submitting}
              onAnswerChange={(answer) => handleAnswerSelect(activeQuestion.id, answer)}
              onToggleFlag={() => toggleFlag(activeQuestion.id)}
              onPrevious={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              onNext={() =>
                setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))
              }
              onSubmitClick={() => setShowSubmitModal(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <QuestionNavigator
              questions={questions}
              currentQuestion={currentQuestion}
              answers={attempt.answers}
              answeredCount={answeredCount}
              progress={progress}
              flaggedCount={flaggedCount}
              autosaveStatus={attempt.autosaveStatus}
              onSelectQuestion={setCurrentQuestion}
            />
          </div>
        </div>
      </div>

      {monitoringEnabled && (
        <ProctoringDock
          monitoring={monitoring}
          webcamActive={webcamActive}
          feedOpen={feedOpen}
          onFeedOpenChange={setFeedOpen}
          dockPosition={dockPosition}
          onDockPositionChange={setMonitoringDockPosition}
          enrolling={enrolling}
          enrollMessage={enrollMessage}
          onReEnroll={() => void handleReEnroll()}
        />
      )}

      {showSubmitModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Submit Exam?</h3>
              <p className="text-muted-foreground">
                Are you sure you want to submit your exam? This action cannot be undone.
              </p>
            </div>

            <div className="bg-accent/50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Answered:</span>
                  <div className="font-medium">
                    {answeredCount}/{questions.length}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Unanswered:</span>
                  <div className="font-medium text-accent-foreground">
                    {questions.length - answeredCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Continue Exam
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FocusShell>
  );
}
