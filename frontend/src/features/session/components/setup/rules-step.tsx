import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import type { Exam } from "@/core/config/api";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const DEFAULT_RULES = [
  "Allow camera access when prompted.",
  "Sit upright with face and shoulders visible.",
  "Use good lighting and a tidy background.",
  "The exam timer starts only after this setup.",
];

const UNMONITORED_RULES = [
  "Read each question carefully before answering.",
  "Manage your time — the timer starts when you begin.",
  "You may flag questions to revisit before submitting.",
];

interface RulesStepProps {
  exam: Exam;
  monitoringEnabled: boolean;
  beginning?: boolean;
  onContinue: () => void;
}

export function RulesStep({
  exam,
  monitoringEnabled,
  beginning = false,
  onContinue,
}: RulesStepProps) {
  const rules = monitoringEnabled
    ? DEFAULT_RULES
    : exam.instructions?.trim()
      ? null
      : [...UNMONITORED_RULES, `Duration: ${exam.duration_minutes} minutes.`];

  return (
    <Card className="border-border bg-card/70 backdrop-blur shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Before you begin
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {monitoringEnabled
            ? "A quick environment check keeps the exam fair for everyone."
            : "This is an unmonitored exam — no webcam or identity check is required."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {exam.instructions?.trim() && !monitoringEnabled ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{exam.instructions}</p>
        ) : rules ? (
          <ul className="grid sm:grid-cols-2 gap-3 text-sm">
            {rules.map((text) => (
              <li
                key={text}
                className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-foreground"
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                {text}
              </li>
            ))}
          </ul>
        ) : null}
        <Button size="lg" className="w-full sm:w-auto" disabled={beginning} onClick={onContinue}>
          {!monitoringEnabled && beginning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting exam…
            </>
          ) : monitoringEnabled ? (
            "Continue to camera check"
          ) : (
            "Begin exam"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
