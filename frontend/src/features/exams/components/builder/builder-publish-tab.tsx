import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ClipboardList, Send, ShieldCheck, XCircle } from "@/shared/icons";

import type { Exam, PublishReadiness } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import { BuilderStat } from "@/features/exams/components/builder/builder-primitives";

interface BuilderPublishTabProps {
  exam: Exam;
  readiness: PublishReadiness;
  isDraft: boolean;
  saving: boolean;
  onPublish: () => void;
  onSubmitForReview: () => void;
  submitPending: boolean;
  onApprove: () => void;
  approvePending: boolean;
  onReject: (note: string) => void;
  rejectPending: boolean;
}

const APPROVAL_LABEL: Record<NonNullable<Exam["approval_status"]>, string> = {
  not_submitted: "Not submitted",
  pending: "Pending program head review",
  approved: "Approved",
  rejected: "Rejected - needs revision",
};

const APPROVAL_TONE: Record<NonNullable<Exam["approval_status"]>, string> = {
  not_submitted: "bg-muted text-muted-foreground border-border",
  pending: "bg-status-watch/10 text-status-watch border-status-watch/30",
  approved: "bg-status-safe/10 text-status-safe border-status-safe/30",
  rejected: "bg-status-alert/10 text-status-alert border-status-alert/30",
};

export function BuilderPublishTab({
  exam,
  readiness,
  isDraft,
  saving,
  onPublish,
  onSubmitForReview,
  submitPending,
  onApprove,
  approvePending,
  onReject,
  rejectPending,
}: BuilderPublishTabProps) {
  const { canApproveExams, isAdmin } = useAuth();
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approvalStatus = exam.approval_status ?? "not_submitted";
  const canSubmit = isDraft && readiness.ready && approvalStatus !== "pending" && !isAdmin;
  const canPublish = isDraft && readiness.ready && (isAdmin || approvalStatus === "approved");

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/examiner/exams/${exam.id}/grading`}
          className="text-sm text-primary underline"
        >
          Open Speed Grader
        </Link>
        <Link to={`/exams/${exam.id}`} className="text-sm text-primary underline">
          Exam summary &amp; analytics
        </Link>
      </div>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ClipboardList className="w-5 h-5" /> Publish checklist
      </h2>
      <div className="grid sm:grid-cols-3 gap-4 text-sm">
        <BuilderStat label="Questions" value={String(readiness.question_count)} />
        <BuilderStat label="Total points" value={String(readiness.total_points)} />
        <BuilderStat label="Pass mark" value={`${exam.passing_score}%`} />
      </div>

      {isDraft && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Approval status</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${APPROVAL_TONE[approvalStatus]}`}
            >
              {APPROVAL_LABEL[approvalStatus]}
            </span>
          </div>

          {approvalStatus === "rejected" && exam.rejection_note && (
            <p className="text-sm text-status-alert bg-status-alert/5 rounded-md p-3">
              <span className="font-medium">Reviewer feedback: </span>
              {exam.rejection_note}
            </p>
          )}

          {approvalStatus !== "approved" && (
            <p className="text-xs text-muted-foreground">
              A program head or admin must approve this exam before it can be published.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <button
                type="button"
                onClick={onSubmitForReview}
                disabled={submitPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 text-sm"
              >
                <Send className="w-4 h-4" />
                {submitPending
                  ? "Submitting…"
                  : approvalStatus === "rejected"
                    ? "Resubmit for review"
                    : "Submit for review"}
              </button>
            )}

            {approvalStatus === "pending" && canApproveExams && (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={approvePending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-status-safe text-white hover:opacity-90 text-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {approvePending ? "Approving…" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectForm((v) => !v)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-status-alert text-status-alert hover:bg-status-alert/5 text-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}
          </div>

          {showRejectForm && (
            <div className="space-y-2 pt-1">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain what needs to change before this can be approved…"
                className="w-full rounded-lg border border-border bg-input-background p-2 text-sm"
                rows={3}
              />
              <button
                type="button"
                onClick={() => {
                  onReject(rejectNote);
                  setShowRejectForm(false);
                  setRejectNote("");
                }}
                disabled={rejectPending || !rejectNote.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-status-alert text-white hover:opacity-90 text-sm disabled:opacity-50"
              >
                {rejectPending ? "Rejecting…" : "Confirm rejection"}
              </button>
            </div>
          )}
        </div>
      )}

      {readiness.issues.length > 0 && (
        <div className="rounded-lg border border-status-alert/30 bg-status-alert/5 p-4">
          <p className="font-medium text-status-alert mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Must fix before publishing
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {readiness.issues.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {readiness.warnings.length > 0 && (
        <div className="rounded-lg border border-status-watch/30 bg-status-watch/5 p-4">
          <p className="font-medium text-status-watch mb-2">Recommendations</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {readiness.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {canPublish && (
        <button
          type="button"
          onClick={onPublish}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-status-safe text-white hover:opacity-90"
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Publishing…" : "Publish entrance exam"}
        </button>
      )}

      {!isDraft && (
        <p className="text-sm text-status-safe flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> This exam is already published.
        </p>
      )}
    </div>
  );
}
