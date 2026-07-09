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
 * Campus backdrop rendered as an "etched plate": the photo is desaturated,
 * blended into the paper background, and finished with the ruled dot grid
 * and grain. Replace the image at `brand.schoolCampusImage`.
 */
export function SchoolBackground({
  variant = "public",
  fixed = false,
  className,
}: SchoolBackgroundProps) {
  const overlay =
    variant === "workspace"
      ? "bg-background/92 dark:bg-background/93"
      : "bg-background/80 dark:bg-background/86";

  return (
    <div
      className={cn(
        "pointer-events-none inset-0 z-0 overflow-hidden",
        fixed ? "fixed" : "absolute",
        className,
      )}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70 mix-blend-luminosity grayscale"
        style={{ backgroundImage: `url(${brand.schoolCampusImage})` }}
      />

      <div className={cn("absolute inset-0", overlay)} />

      <div className={cn("ambient-bg", variant === "workspace" && "ambient-bg--workspace")} />

      <div className="grid-background !absolute" />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/70" />
    </div>
  );
}
