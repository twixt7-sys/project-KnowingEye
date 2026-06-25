import { cn } from "../ui/utils";

type ScrollableDataTableProps = {
  children: React.ReactNode;
  className?: string;
  /** Fixed row cap (scroll inside). Ignored when `fill` is true. */
  maxRows?: number;
  /** Grow to fill parent section - for overview dashboards. */
  fill?: boolean;
};

export function ScrollableDataTable({
  children,
  className,
  maxRows = 10,
  fill = false,
}: ScrollableDataTableProps) {
  return (
    <div
      className={cn(
        "overflow-auto",
        fill && "min-h-0 flex-1",
        className
      )}
      style={fill ? undefined : { maxHeight: `calc(2.875rem * ${maxRows} + 2.75rem)` }}
    >
      {children}
    </div>
  );
}
