import { Loader2 } from "@/shared/icons";

import { cn } from "../ui/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

/** Centered spinner for a table/list body while its first page of data loads. */
export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <output
      className={cn(
        "flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </output>
  );
}
