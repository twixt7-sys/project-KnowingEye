import { CheckCircle2, type LucideIcon } from "lucide-react";

import { Progress } from "../ui/progress";
import { cn } from "../ui/utils";

export type StepFlowItem<T extends string = string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type StepFlowProps<T extends string = string> = {
  step: T;
  steps: StepFlowItem<T>[];
  className?: string;
};

function stepIndex<T extends string>(steps: StepFlowItem<T>[], step: T) {
  return steps.findIndex((s) => s.id === step);
}

export function StepFlow<T extends string = string>({
  step,
  steps,
  className,
}: StepFlowProps<T>) {
  const currentIndex = stepIndex(steps, step);
  const progressValue = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className={className}>
      <Progress value={progressValue} className="h-1.5 bg-muted" />

      <ol
        className={cn(
          "mt-6 grid gap-2",
          steps.length <= 2
            ? "grid-cols-2"
            : steps.length === 3
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {steps.map((s, i) => {
          const active = step === s.id;
          const done = currentIndex > i;
          const Icon = s.icon;

          return (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : done
                    ? "border-primary/20 bg-muted/60"
                    : "border-border bg-card/40"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
