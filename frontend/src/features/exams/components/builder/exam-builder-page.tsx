import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, PlayCircle } from "@/shared/icons";

import { BuilderCandidatesTab } from "@/features/exams/components/builder/builder-candidates-tab";
import { BuilderPublishTab } from "@/features/exams/components/builder/builder-publish-tab";
import { BuilderQuestionsTab } from "@/features/exams/components/builder/builder-questions-tab";
import { BuilderSettingsTab } from "@/features/exams/components/builder/builder-settings-tab";
import { useCanPreviewExam } from "@/features/exams/hooks/use-can-preview-exam";
import { useExamBuilder } from "@/features/exams/hooks/use-exam-builder";
import { examPreviewPath } from "@/features/exams/lib/exam-paths";
import type { BuilderTab } from "@/features/exams/schemas/builder-schemas";

const TABS: { key: BuilderTab; label: string }[] = [
  { key: "settings", label: "Exam settings" },
  { key: "questions", label: "Questions" },
  { key: "candidates", label: "Candidates" },
  { key: "publish", label: "Review & publish" },
];

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export function ExamBuilderPage() {
  const { examId } = useParams();
  const id = Number(examId);
  const builder = useExamBuilder(id);
  const canPreviewExam = useCanPreviewExam();
  const canPreview = canPreviewExam(builder.exam?.created_by);

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
          to={builder.exam.status === "archived" ? "/examiner/archived" : "/examiner"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />{" "}
          {builder.exam.status === "archived" ? "Back to archived exams" : "Back to dashboard"}
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{builder.exam.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {builder.exam.exam_code ? `Code: ${builder.exam.exam_code} · ` : ""}
            {builder.questions.length} questions · {builder.totalPoints} pts ·{" "}
            <span className="font-medium text-foreground">
              {builder.exam.status === "active" ? "Published" : capitalize(builder.exam.status)}
            </span>
          </p>
        </div>
        {canPreview && (
          <Link
            to={examPreviewPath(builder.exam.id)}
            className="inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent"
          >
            <PlayCircle className="w-4 h-4" /> Preview as student
          </Link>
        )}
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
          examId={builder.exam.id}
          questions={builder.questions}
          sections={builder.sections}
          status={builder.exam.status}
          editable={builder.questionsEditable}
          canPreview={canPreview}
          saving={builder.saving}
          showQuestionForm={builder.showQuestionForm}
          editingQuestion={builder.editingQuestion}
          questionDraft={builder.questionDraft}
          setQuestionDraft={builder.setQuestionDraft}
          questionAttachments={builder.questionAttachments}
          pendingFiles={builder.pendingFiles}
          setPendingFiles={builder.setPendingFiles}
          attachmentBusy={builder.attachmentBusy}
          questionError={builder.questionError}
          importForm={builder.importForm}
          importStatus={builder.importStatus}
          importProblems={builder.importProblems}
          importBusy={builder.importBusy}
          formDownloadBusy={builder.formDownloadBusy}
          onOpenNew={builder.openNewQuestion}
          onAddSection={builder.addSection}
          onRenameSection={builder.renameSection}
          onRemoveSection={builder.removeSection}
          onEdit={builder.openEditQuestion}
          onDelete={builder.removeQuestion}
          onReorder={builder.reorderQuestionsByIds}
          onCloseQuestionForm={builder.closeQuestionForm}
          onSaveQuestion={builder.saveQuestion}
          onAttachmentPick={builder.handleAttachmentPick}
          onRemoveAttachment={builder.removeAttachment}
          onUploadOptionImage={builder.uploadOptionImageForQuestion}
          onCreateSection={builder.createSectionForQuestion}
          onDownloadImportForm={builder.downloadImportForm}
          onImportFile={builder.handleImportFile}
          onRecheckImport={builder.recheckImport}
          onClearImport={builder.clearImport}
          onRunImport={builder.runImport}
        />
      )}

      {builder.tab === "candidates" && (
        <BuilderCandidatesTab
          examId={builder.exam.id}
          exclusionEnforced={
            builder.exam.exclude_completed_examinees === true && !builder.exam.is_practice
          }
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
          onUnpublish={builder.unpublish}
          unpublishPending={builder.unpublishPending}
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
