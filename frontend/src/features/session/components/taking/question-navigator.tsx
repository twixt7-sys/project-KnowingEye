import { Flag } from "lucide-react";

import type { Question } from "@/core/config/api";
import type { SavedAnswer } from "@/features/session/hooks/use-exam-attempt";

interface QuestionNavigatorProps {
  questions: Question[];
  currentQuestion: number;
  answers: Record<number, SavedAnswer>;
  answeredCount: number;
  progress: number;
  flaggedCount: number;
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  onSelectQuestion: (index: number) => void;
}

export function QuestionNavigator({
  questions,
  currentQuestion,
  answers,
  answeredCount,
  progress,
  flaggedCount,
  autosaveStatus,
  onSelectQuestion,
}: QuestionNavigatorProps) {
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

      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">All Questions</h3>
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, index) => {
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
    </div>
  );
}
