import { ReactNode } from "react";
import { cn } from "../ui/utils";

type PageShellProps = {
  fill?: boolean;
  className?: string;
  children: ReactNode;
};

/** Workspace page frame - use `fill` on overview-style pages that stretch tables. */
export function PageShell({ fill = false, className, children }: PageShellProps) {
  return (
    <div className={cn(fill ? "page-shell" : "page-flow", className)}>{children}</div>
  );
}
