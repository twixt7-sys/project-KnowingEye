import { brand } from "../../../core/config/brand";
import { cn } from "../ui/utils";

type SchoolBackgroundProps = {
  /** Stronger overlay on workspace pages for readability over data tables. */
  variant?: "public" | "workspace";
  /** Pin to viewport (public marketing pages). */
  fixed?: boolean;
  className?: string;
};

/**
 * Full-bleed campus photo with animated ambient layers and readability overlay.
 * Replace the image at `brand.schoolCampusImage` (see core/config/brand.ts).
 */
export function SchoolBackground({
  variant = "public",
  fixed = false,
  className,
}: SchoolBackgroundProps) {
  const overlay =
    variant === "workspace"
      ? "bg-background/88 dark:bg-background/90"
      : "bg-background/72 dark:bg-background/82";

  return (
    <div
      className={cn(
        "pointer-events-none inset-0 z-0 overflow-hidden",
        fixed ? "fixed" : "absolute",
        className
      )}
      aria-hidden
    >
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${brand.schoolCampusImage})` }}
      />

      <div
        className={cn(
          "ambient-bg",
          variant === "workspace" && "ambient-bg--workspace"
        )}
      >
        <div className="ambient-bg__orb ambient-bg__orb--1" />
        <div className="ambient-bg__orb ambient-bg__orb--2" />
        <div className="ambient-bg__orb ambient-bg__orb--3" />
        <div className="ambient-bg__mesh" />
        <div className="ambient-bg__grid" />
        <div className="ambient-bg__shimmer" />
      </div>

      <div className={cn("absolute inset-0", overlay)} />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/14 via-transparent to-background/95" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/30" />
    </div>
  );
}
