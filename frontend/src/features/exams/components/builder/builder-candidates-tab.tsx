import type { ExamAssignment } from "@/features/exams/api/exam-api";

interface BuilderCandidatesTabProps {
  assignments: ExamAssignment[];
  candidateEmail: string;
  setCandidateEmail: (value: string) => void;
  candidateCsv: string;
  setCandidateCsv: (value: string) => void;
  onAddCandidate: () => void;
  onImportCandidates: () => void;
  addCandidatePending: boolean;
  importCandidatesPending: boolean;
}

export function BuilderCandidatesTab({
  assignments,
  candidateEmail,
  setCandidateEmail,
  candidateCsv,
  setCandidateCsv,
  onAddCandidate,
  onImportCandidates,
  addCandidatePending,
  importCandidatesPending,
}: BuilderCandidatesTabProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Candidate roster</h2>
      <p className="text-sm text-muted-foreground">
        Assign examinees who may take this exam when &quot;Assigned candidates only&quot; is enabled.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          placeholder="candidate@email.com"
          value={candidateEmail}
          onChange={(e) => setCandidateEmail(e.target.value)}
          className="field-input flex-1 min-w-[200px]"
        />
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          disabled={addCandidatePending || !candidateEmail.trim()}
          onClick={onAddCandidate}
        >
          {addCandidatePending ? "Adding…" : "Add candidate"}
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Bulk import CSV</label>
        <textarea
          rows={4}
          value={candidateCsv}
          onChange={(e) => setCandidateCsv(e.target.value)}
          className="field-input font-mono text-xs"
        />
        <button
          type="button"
          className="mt-2 px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-50"
          disabled={importCandidatesPending}
          onClick={onImportCandidates}
        >
          {importCandidatesPending ? "Importing…" : "Import roster"}
        </button>
      </div>
      <ul className="divide-y border rounded-lg">
        {assignments.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No candidates assigned yet.</li>
        ) : (
          assignments.map((a) => (
            <li key={a.id} className="p-3 text-sm flex justify-between">
              <span>{a.user_name || a.user_email}</span>
              <span className="text-muted-foreground">
                {a.extra_time_minutes ? `+${a.extra_time_minutes} min` : ""}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
