import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "@/shared/icons";

import { BuilderCandidatesTab } from "@/features/exams/components/builder/builder-candidates-tab";
import { BuilderPublishTab } from "@/features/exams/components/builder/builder-publish-tab";
import { BuilderQuestionsTab } from "@/features/exams/components/builder/builder-questions-tab";
import { BuilderSettingsTab } from "@/features/exams/components/builder/builder-settings-tab";
import { useExamBuilder } from "@/features/exams/hooks/use-exam-builder";
import type { BuilderTab } from "@/features/exams/schemas/builder-schemas";

const TABS: { key: BuilderTab; label: string }[] = [
  { key: "settings", label: "Exam settings" },
  { key: "questions", label: "Questions" },
  { key: "candidates", label: "Candidates" },
  { key: "publish", label: "Review & publish" },
];

export function ExamBuilderPage() {
  const { examId } = useParams();
  const id = Number(examId);
  const builder = useExamBuilder(id);

  if (builder.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading exam builder…
      </div>
    );
  }

  if (builder.loadError && !builder.exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-status-alert max-w-md">{builder.loadError}</p>
        <Link
          to="/examiner"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  if (!builder.form || !builder.exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Exam not found.</p>
        <Link to="/examiner" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Link
          to="/examiner"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{builder.exam.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {builder.exam.exam_code ? `Code: ${builder.exam.exam_code} · ` : ""}
            {builder.questions.length} questions · {builder.totalPoints} pts ·{" "}
            {builder.exam.status}
          </p>
        </div>
      </div>

      {builder.error && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-status-alert/30 bg-status-alert/5 text-status-alert text-sm">
          {builder.error}
        </div>
      )}
      {builder.message && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-status-safe/30 bg-status-safe/5 text-status-safe text-sm">
          {builder.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => builder.setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm border ${
              builder.tab === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {builder.tab === "settings" && (
        <BuilderSettingsTab
          exam={builder.exam}
          form={builder.form}
          setForm={builder.setForm}
          isDraft={builder.isDraft}
          saving={builder.saving}
          onSave={builder.saveSettings}
        />
      )}

      {builder.tab === "questions" && (
        <BuilderQuestionsTab
          questions={builder.questions}
          isDraft={builder.isDraft}
          saving={builder.saving}
          showQuestionForm={builder.showQuestionForm}
          editingQuestion={builder.editingQuestion}
          questionDraft={builder.questionDraft}
          setQuestionDraft={builder.setQuestionDraft}
          questionAttachments={builder.questionAttachments}
          pendingFiles={builder.pendingFiles}
          setPendingFiles={builder.setPendingFiles}
          attachmentBusy={builder.attachmentBusy}
          importCsv={builder.importCsv}
          setImportCsv={builder.setImportCsv}
          importErrors={builder.importErrors}
          importBusy={builder.importBusy}
          onOpenNew={builder.openNewQuestion}
          onAddSection={() => void builder.addSection()}
          onEdit={builder.openEditQuestion}
          onDelete={(q) => void builder.removeQuestion(q)}
          onReorder={builder.reorderQuestionsByIds}
          onCloseQuestionForm={() => builder.setShowQuestionForm(false)}
          onSaveQuestion={builder.saveQuestion}
          onAttachmentPick={(files) => void builder.handleAttachmentPick(files)}
          onRemoveAttachment={(a) => void builder.removeAttachment(a)}
          onImportFile={(file) => void builder.handleImportFile(file)}
          onRunImport={builder.runImport}
        />
      )}

      {builder.tab === "candidates" && (
        <BuilderCandidatesTab
          assignments={builder.assignments}
          candidateEmail={builder.candidateEmail}
          setCandidateEmail={builder.setCandidateEmail}
          candidateCsv={builder.candidateCsv}
          setCandidateCsv={builder.setCandidateCsv}
          onAddCandidate={builder.addCandidate}
          onImportCandidates={builder.importCandidates}
          addCandidatePending={builder.addCandidatePending}
          importCandidatesPending={builder.importCandidatesPending}
        />
      )}

      {builder.tab === "publish" && builder.readiness && (
        <BuilderPublishTab
          exam={builder.exam}
          readiness={builder.readiness}
          isDraft={builder.isDraft}
          saving={builder.saving}
          onPublish={builder.publish}
          onSubmitForReview={builder.submitForReview}
          submitPending={builder.submitPending}
          onApprove={builder.approveReview}
          approvePending={builder.approvePending}
          onReject={builder.rejectReview}
          rejectPending={builder.rejectPending}
        />
      )}
    </div>
  );
}
