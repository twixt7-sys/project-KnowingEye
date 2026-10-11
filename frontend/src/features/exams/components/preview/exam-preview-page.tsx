import { AlertTriangle, ClipboardList, Loader2 } from "@/shared/icons";

import { useExamPreview } from "@/features/exams/hooks/use-exam-preview";
import { RulesStep } from "@/features/session/components/setup/rules-step";
import { FocusShell } from "@/features/session/components/taking/focus-shell";
import { PreviewBanner } from "@/features/session/components/taking/preview-banner";
import { QuestionNavigator } from "@/features/session/components/taking/question-navigator";
import { QuestionPanel } from "@/features/session/components/taking/question-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { Button } from "@/shared/components/ui/button";

/**
 * The exam exactly as a student would meet it - instructions, then the
 * runner - for an examiner checking their work. Nothing here talks to the
 * session API, so nothing is saved, submitted or monitored.
 */
export function ExamPreviewPage() {
  const preview = useExamPreview();
  const { exam, questions, activeQuestion, currentQuestion, exit } = preview;

  if (preview.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading preview…</p>
        </div>
      </div>
    );
  }

  if (preview.error || !exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Can't preview this exam</h2>
          <p className="text-muted-foreground mb-4">{preview.error ?? "Exam not found."}</p>
          <Button onClick={exit}>Exit preview</Button>
        </div>
      </div>
    );
  }

  if (preview.isEmpty || !activeQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <EmptyState
          icon={ClipboardList}
          title="No questions to preview"
          description="This exam has no questions yet, or its question pools draw none. Add questions in the builder to preview them."
          action={<Button onClick={exit}>Exit preview</Button>}
        />
      </div>
    );
  }

  if (preview.phase === "instructions") {
    return (
      <div className="min-h-screen bg-background">
        <PreviewBanner onExit={exit} />
        <div className="container max-w-3xl mx-auto py-10 px-4 space-y-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
              Exam preview
            </p>
            <h1 className="text-2xl md:text-3xl font-bold">{exam.title}</h1>
            {exam.monitoring_enabled !== false && (
              <p className="text-sm text-muted-foreground mt-2">
                Monitored exams show students the camera rules and a camera and identity check
                before they begin. Those steps are skipped in previews.
              </p>
            )}
          </div>
          {/* The unmonitored variant is the one that shows the exam's own instructions; a monitored exam's students see the camera rules here instead. */}
          <RulesStep
            exam={exam}
            monitoringEnabled={false}
            description="The exam's instructions, as written."
            continueLabel="Start preview"
            onContinue={preview.start}
          />
        </div>
      </div>
    );
  }

  return (
    <FocusShell
      preview
      onExitPreview={exit}
      monitoringEnabled={false}
      disableCopyPaste={false}
      webcamActive={false}
      behaviorAlerts={[]}
      timeRemaining={preview.timeRemaining}
      submitting={false}
      onSubmitClick={exit}
    >
      <div className="container mx-auto px-4 py-8">
        {preview.requestedQuestionMissing && (
          <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
            That question isn't part of this random draw (question pool or shuffle), so the preview
            starts at question 1.
          </p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <QuestionPanel
              question={activeQuestion}
              questionIndex={currentQuestion}
              totalQuestions={questions.length}
              sectionTitle={
                activeQuestion.section != null
                  ? (preview.sections.find((s) => s.id === activeQuestion.section)?.title ?? null)
                  : null
              }
              answer={preview.answers[activeQuestion.id]}
              answerText={preview.answers[activeQuestion.id]?.answer_text ?? ""}
              submitting={false}
              submitLabel="End preview"
              onAnswerChange={(answer) => preview.setAnswer(activeQuestion.id, answer)}
              onToggleFlag={() => preview.toggleFlag(activeQuestion.id)}
              onPrevious={() => preview.setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              onNext={() =>
                preview.setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))
              }
              onSubmitClick={exit}
            />
          </div>

          <div className="lg:col-span-1">
            <QuestionNavigator
              questions={questions}
              sections={preview.sections}
              currentQuestion={currentQuestion}
              answers={preview.answers}
              answeredCount={preview.answeredCount}
              progress={preview.progress}
              flaggedCount={preview.flaggedCount}
              autosaveStatus="idle"
              onSelectQuestion={preview.setCurrentQuestion}
              stickyTopClassName="top-36"
            />
          </div>
        </div>
      </div>
    </FocusShell>
  );
}
