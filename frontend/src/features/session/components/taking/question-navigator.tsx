import { Flag } from "@/shared/icons";

import type { ExamSection, Question } from "@/core/config/api";
import type { SavedAnswer } from "@/features/session/hooks/use-exam-attempt";

interface QuestionNavigatorProps {
  questions: Question[];
  sections: ExamSection[];
  currentQuestion: number;
  answers: Record<number, SavedAnswer>;
  answeredCount: number;
  progress: number;
  flaggedCount: number;
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  onSelectQuestion: (index: number) => void;
}

interface QuestionGroup {
  key: string;
  title: string | null;
  entries: { question: Question; index: number }[];
}

/** Group questions into per-section buckets, in section order, preserving
 * overall question order within each bucket. Unsectioned questions form
 * their own bucket (titled only when at least one real section exists, so
 * an exam with no sections at all still renders as a plain flat list). */
function groupBySections(questions: Question[], sections: ExamSection[]): QuestionGroup[] {
  const withIndex = questions.map((question, index) => ({ question, index }));
  if (sections.length === 0) {
    return [{ key: "all", title: null, entries: withIndex }];
  }

  const bySection = new Map<number, QuestionGroup>(
    sections.map((s) => [s.id, { key: String(s.id), title: s.title, entries: [] }])
  );
  const unsectioned: QuestionGroup = { key: "unsectioned", title: "Other questions", entries: [] };

  for (const entry of withIndex) {
    const group = entry.question.section != null ? bySection.get(entry.question.section) : null;
    (group ?? unsectioned).entries.push(entry);
  }

  const ordered = [...sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => bySection.get(s.id))
    .filter((g): g is QuestionGroup => !!g && g.entries.length > 0);
  if (unsectioned.entries.length > 0) ordered.push(unsectioned);
  return ordered;
}

export function QuestionNavigator({
  questions,
  sections,
  currentQuestion,
  answers,
  answeredCount,
  progress,
  flaggedCount,
  autosaveStatus,
  onSelectQuestion,
}: QuestionNavigatorProps) {
  const groups = groupBySections(questions, sections);
  return (
    <div className="sticky top-24 space-y-6">
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">Progress</h3>
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Answered</span>
            <span className="font-medium">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {flaggedCount} question(s) flagged for review
        </div>
        {autosaveStatus !== "idle" && (
          <p className="text-xs mt-2 text-muted-foreground">
            {autosaveStatus === "saving" && "Saving…"}
            {autosaveStatus === "saved" && "All changes saved"}
            {autosaveStatus === "error" && "Save failed — will retry"}
          </p>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold">All Questions</h3>
        {groups.map((group) => {
          const groupAnswered = group.entries.filter(
            ({ question }) => (answers[question.id]?.answer_text ?? "").trim().length > 0
          ).length;
          return (
            <div key={group.key}>
              {group.title && (
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {groupAnswered}/{group.entries.length}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-5 gap-2">
                {group.entries.map(({ question: q, index }) => {
                  const isActive = currentQuestion === index;
                  const isAnswered = (answers[q.id]?.answer_text ?? "").trim().length > 0;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onSelectQuestion(index)}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all relative ${
                        isActive
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : isAnswered
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {index + 1}
                      {answers[q.id]?.flagged_for_review && (
                        <Flag className="w-3 h-3 absolute -top-1 -right-1 fill-accent-foreground text-accent-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
