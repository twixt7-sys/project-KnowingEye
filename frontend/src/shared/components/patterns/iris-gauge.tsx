import { useEffect, useState } from "react";

import type { AppIcon } from "@/shared/icons";
import { cn } from "../ui/utils";

type GaugeTone = "default" | "success" | "warning" | "danger";

const toneStroke: Record<GaugeTone, string> = {
  default: "var(--primary)",
  success: "var(--status-safe)",
  warning: "var(--status-watch)",
  danger: "var(--status-alert)",
};

const toneText: Record<GaugeTone, string> = {
  default: "text-primary",
  success: "text-status-safe",
  warning: "text-status-watch",
  danger: "text-status-alert",
};

type IrisGaugeProps = {
  /** Current value, 0..max. */
  value: number;
  max?: number;
  tone?: GaugeTone;
  /** Diameter in px. */
  size?: number;
  label?: string;
  sublabel?: string;
  /** Renders in the pupil instead of the numeric value. */
  icon?: AppIcon;
  /** Suffix appended to the numeric center value, e.g. "%". */
  suffix?: string;
  className?: string;
};

/**
 * A circular gauge drawn as a stylized watching eye: the track ring is the
 * sclera, the progress arc is the iris (tone-colored), and the center is the
 * pupil — either the numeric value or, when `icon` is given, a small glyph.
 * The arc sweeps in from zero on mount as one deliberate load moment.
 */
export function IrisGauge({
  value,
  max = 100,
  tone = "default",
  size = 104,
  label,
  sublabel,
  icon: Icon,
  suffix = "%",
  className,
}: IrisGaugeProps) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  const strokeWidth = Math.max(4, Math.round(size * 0.08));
  const radius = size / 2 - strokeWidth / 2 - 1;
  const displayValue = Number.isFinite(value) ? Math.round(value) : 0;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="-rotate-90"
          role="img"
          aria-label={label ? `${label}: ${displayValue}${suffix}` : `${displayValue}${suffix}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={toneStroke[tone]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - animated}
            className="iris-gauge__arc"
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {Icon ? (
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-current/10",
                toneText[tone],
              )}
              style={{ width: size * 0.36, height: size * 0.36 }}
            >
              <Icon weight="fill" className="h-[55%] w-[55%]" />
            </span>
          ) : (
            <span
              className={cn("font-mono font-semibold tabular-nums leading-none", toneText[tone])}
              style={{ fontSize: size * 0.22 }}
            >
              {displayValue}
              <span className="text-[0.55em] opacity-70">{suffix}</span>
            </span>
          )}
        </div>
      </div>

      {(label || sublabel) && (
        <div className="text-center">
          {label && (
            <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
          )}
          {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}
