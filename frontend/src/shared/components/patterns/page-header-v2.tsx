import type { ReactNode } from "react";

import { FadeIn } from "../../lib/motion";
import { cn } from "../ui/utils";

type PageHeaderV2Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  metrics?: ReactNode;
  className?: string;
};

export function PageHeaderV2({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  className,
}: PageHeaderV2Props) {
  return (
    <FadeIn>
      <header className={cn("page-header mb-5 space-y-4", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description && <p className="page-description">{description}</p>}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          )}
        </div>
        {metrics}
      </header>
    </FadeIn>
  );
}
