import type { ReactNode } from "react";

import { cn } from "../ui/utils";

type FocusShellProps = {
  children: ReactNode;
  /** Sticky top bar content (timer, submit, back link, etc.). */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Minimal chrome for exam-taking and other distraction-free flows.
 * Session-specific exam UI lives in features/session; this is the shared shell.
 */
export function FocusShell({
  children,
  header,
  footer,
  className,
  contentClassName,
}: FocusShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-background", className)}>
      {header && (
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          {header}
        </header>
      )}

      <main className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}>
        {children}
      </main>

      {footer && (
        <footer className="shrink-0 border-t border-border bg-card/95 backdrop-blur">
          {footer}
        </footer>
      )}
    </div>
  );
}
