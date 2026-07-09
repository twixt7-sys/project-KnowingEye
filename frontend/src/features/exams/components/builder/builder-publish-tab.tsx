import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";

import type { Exam, PublishReadiness } from "@/core/config/api";
import { BuilderStat } from "@/features/exams/components/builder/builder-primitives";

interface BuilderPublishTabProps {
  exam: Exam;
  readiness: PublishReadiness;
  isDraft: boolean;
  saving: boolean;
  onPublish: () => void;
}

export function BuilderPublishTab({
  exam,
  readiness,
  isDraft,
  saving,
  onPublish,
}: BuilderPublishTabProps) {
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

      {readiness.issues.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="font-medium text-red-600 mb-2 flex items-center gap-2">
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
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="font-medium text-amber-700 mb-2">Recommendations</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {readiness.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {readiness.ready && isDraft && (
        <button
          type="button"
          onClick={onPublish}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <CheckCircle2 className="w-4 h-4" />
          {saving ? "Publishing…" : "Publish entrance exam"}
        </button>
      )}

      {!isDraft && (
        <p className="text-sm text-emerald-600 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> This exam is already published.
        </p>
      )}
    </div>
  );
}
