import type { LucideIcon } from "lucide-react";
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

const toneText = {
  default: "text-primary",
  success: "text-status-safe",
  warning: "text-status-watch",
  danger: "text-status-alert",
};

const toneTick = {
  default: "bg-primary",
  success: "bg-status-safe",
  warning: "bg-status-watch",
  danger: "bg-status-alert",
};

/**
 * Ledger-style stat: mono uppercase label with a tone tick, large tabular
 * numeral, and a ruled hint line. The icon sits ghosted in the corner.
 */
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
      <div className={cn("surface-panel relative overflow-hidden p-3 pl-4", className)}>
        <span
          className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r", toneTick[tone])}
          aria-hidden
        />
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-70", toneText[tone])} aria-hidden />
        </div>
        <p className="mt-1 font-mono text-xl font-medium tabular-nums leading-tight tracking-tight">
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-panel group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <span
        className={cn("absolute inset-y-4 left-0 w-[3px] rounded-r", toneTick[tone])}
        aria-hidden
      />
      <Icon
        className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 text-foreground opacity-[0.05] transition-opacity duration-200 group-hover:opacity-[0.09]"
        strokeWidth={1.25}
        aria-hidden
      />

      <div className="flex items-center gap-2">
        <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
      </div>

      <p className="mt-3 font-mono text-[1.75rem] font-medium tabular-nums leading-none tracking-tight">
        {value}
      </p>

      {hint && (
        <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
