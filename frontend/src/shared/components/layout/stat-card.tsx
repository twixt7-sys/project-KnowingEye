import { type LucideIcon } from "lucide-react";
import { cn } from "../ui/utils";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  compact?: boolean;
  className?: string;
};

const toneStyles = {
  default: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  compact = false,
  className,
}: StatCardProps) {
  if (compact) {
    return (
      <div className={cn("surface-panel flex items-center gap-3 p-3", className)}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className={cn("h-4 w-4", toneStyles[tone])} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight tracking-tight">{value}</p>
          <p className="truncate text-xs font-medium">{label}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-panel p-5 transition-transform duration-200 hover:-translate-y-0.5",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className={cn("h-5 w-5", toneStyles[tone])} />
        </div>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
