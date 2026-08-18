import { ChevronLeft, ChevronRight, Flag, Loader2 } from "@/shared/icons";

import type { Question, QuestionAttachment } from "@/core/config/api";
import type { SavedAnswer } from "@/features/session/hooks/use-exam-attempt";
import { Textarea } from "@/shared/components/ui/textarea";

function choiceOptions(question: Question): string[] {
  if (question.question_type === "true_false") {
    return question.options?.length >= 2 ? question.options : ["True", "False"];
  }
  return question.options ?? [];
}

function QuestionAnswerFields({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (answer: string) => void;
}) {
  const qtype = question.question_type;

  if (qtype === "short_answer") {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor={`answer-${question.id}`}>
          Your answer
        </label>
        <input
          id={`answer-${question.id}`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here…"
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    );
  }

  if (qtype === "essay") {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor={`answer-${question.id}`}>
          Your response
        </label>
        <Textarea
          id={`answer-${question.id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your essay response here…"
          rows={8}
          className="min-h-40"
        />
        <p className="text-xs text-muted-foreground">
          Essay responses may be flagged for manual review.
        </p>
      </div>
    );
  }

  const options = choiceOptions(question);
  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        This question has no answer choices configured. You can skip it or contact your instructor.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <button
          key={`${question.id}-${index}`}
          type="button"
          onClick={() => onChange(option)}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            value === option
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                value === option ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {value === option && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
            </div>
            <span>{option}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function QuestionAttachments({ attachments }: { attachments?: QuestionAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mb-6 space-y-3">
      {attachments.map((att) => (
        <div key={att.id} className="rounded-lg border bg-muted/30 p-3">
          {att.kind === "image" && (
            <img src={att.url} alt={att.caption || "Question image"} className="max-h-64 rounded-md mx-auto" />
          )}
          {att.kind === "pdf" && (
            <a href={att.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
              Open PDF{att.caption ? `: ${att.caption}` : ""}
            </a>
          )}
          {att.kind === "audio" && (
            <audio controls src={att.url} className="w-full">
              Audio attachment
            </audio>
          )}
        </div>
      ))}
    </div>
  );
}

interface QuestionPanelProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  answer: SavedAnswer | undefined;
  answerText: string;
  submitting: boolean;
  onAnswerChange: (answer: string) => void;
  onToggleFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmitClick: () => void;
}

export function QuestionPanel({
  question,
  questionIndex,
  totalQuestions,
  answer,
  answerText,
  submitting,
  onAnswerChange,
  onToggleFlag,
  onPrevious,
  onNext,
  onSubmitClick,
}: QuestionPanelProps) {
  const isLast = questionIndex === totalQuestions - 1;

  return (
    <div className="bg-card rounded-xl border border-border p-6 md:p-8 mb-6">
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Question {questionIndex + 1} of {totalQuestions}
          </h2>
          <button
            type="button"
            onClick={onToggleFlag}
            className={`p-2 rounded-lg transition-colors ${
              answer?.flagged_for_review
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent"
            }`}
          >
            <Flag className={`w-5 h-5 ${answer?.flagged_for_review ? "fill-current" : ""}`} />
          </button>
        </div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          {question.question_type.replace("_", " ")}
        </p>
        <p className="text-lg mb-6">{question.question_text}</p>
        <QuestionAttachments attachments={question.attachments} />
      </div>

      <div className="mb-8">
        <QuestionAnswerFields question={question} value={answerText} onChange={onAnswerChange} />
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-border">
        <button
          type="button"
          onClick={onPrevious}
          disabled={questionIndex === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onSubmitClick}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Exam"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
