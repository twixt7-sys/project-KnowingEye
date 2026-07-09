import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../ui/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-input bg-card">
        <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      </div>
      <p
        className="mb-2 font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/80"
        aria-hidden
      >
        — nothing here —
      </p>
      <h3 className="font-serif text-lg font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
