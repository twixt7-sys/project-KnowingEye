import type { AppIcon } from "@/shared/icons";
import type { ReactNode } from "react";

import { cn } from "@/shared/components/ui/utils";

/**
 * Centered section heading: a mono kicker seated between two brass rules,
 * a display-serif title, and an optional centered description.
 */
export function SectionHeading({
  kicker,
  title,
  description,
  className,
}: {
  kicker: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("mx-auto mb-10 max-w-2xl text-center", className)}>
      <div className="flex items-center justify-center gap-3">
        <span className="h-px w-7 bg-gold/70" aria-hidden />
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-primary">
          {kicker}
        </p>
        <span className="h-px w-7 bg-gold/70" aria-hidden />
      </div>
      <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-[2.125rem]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  );
}

/**
 * Numbered "index card": mono index and ghosted icon over a hairline,
 * serif title, free-form body. The signature card of the marketing pages.
 */
export function IndexCard({
  index,
  icon: Icon,
  title,
  children,
  className,
}: {
  index: string;
  icon: AppIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "surface-panel-interactive group relative flex flex-col overflow-hidden p-6",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <span className="portal-index">{index}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-4.5 w-4.5" weight="regular" />
        </span>
      </div>
      <h3 className="mt-4 font-serif text-xl font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 flex-1">{children}</div>
    </article>
  );
}

/** List with small square ink markers — replaces the generic dot bullets. */
export function TickList({
  items,
  tone = "default",
  className,
}: {
  items: readonly string[];
  tone?: "default" | "safe" | "muted";
  className?: string;
}) {
  const marker =
    tone === "safe"
      ? "bg-status-safe"
      : tone === "muted"
        ? "bg-muted-foreground/50"
        : "bg-primary/70";
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed">
          <span
            className={cn("mt-[0.4375rem] h-1.5 w-1.5 shrink-0 rotate-45", marker)}
            aria-hidden
          />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Mono stamp chip — for badges like "Capstone Project 2026". */
export function StampChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-gold/45 bg-gold/10 px-3 py-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-foreground">
      {children}
    </span>
  );
}
