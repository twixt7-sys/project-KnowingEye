import { Clock, EyeOff, Lock, Users } from "@/shared/icons";

import type { Exam } from "@/core/config/api";

interface ExamEditLockNoticeProps {
  exam: Exam;
  /** True on the Candidates tab, which stays editable while the exam is in progress. */
  onCandidatesTab: boolean;
  onUnpublish: () => void;
  unpublishPending: boolean;
  onEditCandidates: () => void;
}

/**
 * Explains why the exam's questions, content and settings are locked, and offers the way
 * out: unpublish -> edit -> republish for a published exam, or the candidate roster (the
 * only thing that can change) while it's in progress. The lock itself is decided and
 * enforced by the server; this only reads `exam.edit_lock`.
 */
export function ExamEditLockNotice({
  exam,
  onCandidatesTab,
  onUnpublish,
  unpublishPending,
  onEditCandidates,
}: ExamEditLockNoticeProps) {
  const lock = exam.edit_lock ?? null;
  if (!lock) return null;

  if (lock === "ongoing") {
    if (onCandidatesTab) {
      return (
        <Notice tone="watch" icon={<Clock className="w-5 h-5" />} title="Exam in progress">
          Questions, content and settings are locked, but you can still add and update
          candidates here.
        </Notice>
      );
    }
    return (
      <Notice
        tone="watch"
        icon={<Clock className="w-5 h-5" />}
        title="Exam in progress: only candidates can be edited"
        action={
          <button
            type="button"
            onClick={onEditCandidates}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-sm"
          >
            <Users className="w-4 h-4" /> Edit candidates
          </button>
        }
      >
        The scheduled start time has passed or examinees are taking it, so questions, content
        and settings are locked to protect active examinees. It can't be unpublished until it
        ends.
      </Notice>
    );
  }

  if (lock === "published") {
    // Candidates don't need unpublishing; don't nag on that tab.
    if (onCandidatesTab) return null;
    return (
      <Notice
        tone="muted"
        icon={<Lock className="w-5 h-5" />}
        title="Unpublish this exam to edit it"
        action={
          exam.can_unpublish ? (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={unpublishPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
            >
              <EyeOff className="w-4 h-4" />
              {unpublishPending ? "Unpublishing…" : "Unpublish to edit"}
            </button>
          ) : null
        }
      >
        {exam.can_unpublish
          ? "Published exams are read-only. Unpublish it, make your changes, then publish it again from Review & publish."
          : "Examinees have already taken this exam, so it can't be unpublished. Archive and duplicate it to make changes."}
      </Notice>
    );
  }

  if (onCandidatesTab) return null;
  return (
    <Notice tone="muted" icon={<Lock className="w-5 h-5" />} title="This exam is archived">
      Unarchive it before making changes.
    </Notice>
  );
}

function Notice({
  tone,
  icon,
  title,
  action,
  children,
}: {
  tone: "watch" | "muted";
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "watch"
      ? "border-status-watch/30 bg-status-watch/5 text-status-watch"
      : "border-border bg-muted/40 text-foreground";
  return (
    <section
      aria-label={title}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg border ${toneClass}`}
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
