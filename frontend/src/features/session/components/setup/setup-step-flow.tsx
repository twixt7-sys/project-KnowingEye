import {
  CheckCircle2,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Progress } from "@/shared/components/ui/progress";

export type SetupStep = "rules" | "camera" | "identity" | "ready";

export const SETUP_STEPS: { id: SetupStep; label: string; icon: LucideIcon }[] = [
  { id: "rules", label: "Briefing", icon: ShieldCheck },
  { id: "camera", label: "Camera", icon: Video },
  { id: "identity", label: "Identity", icon: ScanFace },
  { id: "ready", label: "Launch", icon: Sparkles },
];

function stepIndex(step: SetupStep) {
  return SETUP_STEPS.findIndex((s) => s.id === step);
}

interface SetupStepFlowProps {
  step: SetupStep;
  steps?: { id: SetupStep; label: string; icon: LucideIcon }[];
}

export function SetupStepFlow({ step, steps = SETUP_STEPS }: SetupStepFlowProps) {
  const progressValue = ((stepIndex(step) + 1) / steps.length) * 100;
  const currentIndex = stepIndex(step);

  return (
    <>
      <Progress value={progressValue} className="h-1.5 bg-muted" />

      <ol className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((s, i) => {
          const active = step === s.id;
          const done = currentIndex > i;
          const Icon = s.icon;
          return (
            <li
              key={s.id}
              className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 transition-colors ${
                active
                  ? "border-primary/50 bg-primary/10"
                  : done
                    ? "border-primary/20 bg-muted/60"
                    : "border-border bg-card/40"
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
              )}
              <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
