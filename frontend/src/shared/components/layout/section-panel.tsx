import { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../ui/utils";

type SectionPanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  toolbar?: ReactNode;
  fill?: boolean;
  className?: string;
  children: ReactNode;
};

export function SectionPanel({
  title,
  description,
  action,
  actionHref,
  actionLabel,
  toolbar,
  fill = false,
  className,
  children,
}: SectionPanelProps) {
  return (
    <section
      className={cn(
        "section-panel surface-panel flex flex-col overflow-hidden",
        fill && "min-h-0 flex-1",
        className
      )}
    >
      <header className="section-header shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="section-title">{title}</h2>
            {description && <p className="section-subtitle">{description}</p>}
          </div>
          {action}
          {actionHref && actionLabel && (
            <Link to={actionHref} className="section-link shrink-0">
              {actionLabel}
            </Link>
          )}
        </div>
        {toolbar && <div className="mt-3">{toolbar}</div>}
      </header>
      <div className={cn("section-body", fill && "flex min-h-0 flex-1 flex-col")}>
        {children}
      </div>
    </section>
  );
}
