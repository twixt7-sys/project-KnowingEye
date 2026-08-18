import type { AppIcon } from "@/shared/icons";
import type { ReactNode } from "react";

import { StatCard } from "../layout/stat-card";
import { cn } from "../ui/utils";

export type StatGridItem = {
  label: string;
  value: string;
  hint?: string;
  icon: AppIcon;
  tone?: "default" | "success" | "warning" | "danger";
};

type StatGridProps = {
  items: StatGridItem[];
  compact?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
  trailing?: ReactNode;
};

const columnClass: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function StatGrid({
  items,
  compact = false,
  columns = 4,
  className,
  trailing,
}: StatGridProps) {
  return (
    <div className={cn("page-metrics", className)}>
      <div className={cn("grid gap-3", columnClass[columns])}>
        {items.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            icon={item.icon}
            tone={item.tone}
            compact={compact}
          />
        ))}
      </div>
      {trailing}
    </div>
  );
}
