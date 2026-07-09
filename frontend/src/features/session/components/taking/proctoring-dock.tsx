import {
  Camera,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Loader2,
  ScanFace,
  UserCheck,
  Eye,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";

import type { FrameMetrics } from "@/core/config/api";
import type { MonitoringDockPosition } from "@/features/session/hooks/use-exam-taking";
import { MonitoringVideoOverlay } from "@/shared/components/monitoring/monitoring-video-overlay";
import type { useMonitoring } from "@/shared/hooks/use-monitoring";

const DETECTION_PARAMS: {
  metricKey: keyof FrameMetrics;
  flagKey: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { metricKey: "face_presence_pct", flagKey: "face_presence", label: "Face presence", icon: ScanFace },
  { metricKey: "identity_match_pct", flagKey: "identity", label: "Identity match", icon: UserCheck },
  { metricKey: "gaze_focus_pct", flagKey: "gaze_focus", label: "Head facing camera", icon: Eye },
  { metricKey: "posture_compliance_pct", flagKey: "posture", label: "Upper body visible", icon: PersonStanding },
];

const DOCK_POSITIONS: {
  id: MonitoringDockPosition;
  label: string;
  className: string;
  icon: typeof CornerDownRight;
}[] = [
  { id: "bottom-right", label: "Bottom right", className: "bottom-4 right-4", icon: CornerDownRight },
  { id: "bottom-left", label: "Bottom left", className: "bottom-4 left-4", icon: CornerDownLeft },
  { id: "top-right", label: "Top right", className: "top-20 right-4", icon: CornerUpRight },
  { id: "top-left", label: "Top left", className: "top-20 left-4", icon: CornerUpLeft },
];

interface ProctoringDockProps {
  monitoring: ReturnType<typeof useMonitoring>;
  webcamActive: boolean;
  feedOpen: boolean;
  onFeedOpenChange: (open: boolean) => void;
  dockPosition: MonitoringDockPosition;
  onDockPositionChange: (pos: MonitoringDockPosition) => void;
  enrolling: boolean;
  enrollMessage: string | null;
  onReEnroll: () => void;
}

export function ProctoringDock({
  monitoring,
  webcamActive,
  feedOpen,
  onFeedOpenChange,
  dockPosition,
  onDockPositionChange,
  enrolling,
  enrollMessage,
  onReEnroll,
}: ProctoringDockProps) {
  const dockLayout = DOCK_POSITIONS.find((p) => p.id === dockPosition) ?? DOCK_POSITIONS[0];

  return (
    <div
      className={`fixed z-40 max-w-[calc(100vw-2rem)] ${dockLayout.className} ${
        feedOpen ? "w-[min(520px,calc(100vw-2rem))]" : "w-72"
      }`}
    >
      <div className="bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl shadow-black/20 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
          <button
            type="button"
            onClick={() => onFeedOpenChange(!feedOpen)}
            className="flex flex-1 items-center justify-between gap-2 py-1 hover:opacity-80 transition-opacity min-w-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Camera className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm truncate">Monitoring feed</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-medium ${
                  monitoring.analysis && monitoring.analysis.overall_compliance_pct < 80
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {monitoring.analysis
                  ? `${monitoring.analysis.overall_compliance_pct.toFixed(0)}%`
                  : "…"}
              </span>
              {feedOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              )}
            </span>
          </button>
          <div className="flex items-center gap-0.5 shrink-0 border-l border-border pl-2">
            <button
              type="button"
              title="Re-capture identity reference"
              aria-label="Re-capture identity reference"
              disabled={enrolling}
              onClick={onReEnroll}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            >
              {enrolling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ScanFace className="w-3.5 h-3.5" />
              )}
            </button>
            {DOCK_POSITIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={`Move panel: ${label}`}
                aria-label={`Move panel: ${label}`}
                onClick={() => onDockPositionChange(id)}
                className={`p-1.5 rounded-md transition-colors ${
                  dockPosition === id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {feedOpen && (
          <div className="p-3">
            {enrollMessage && (
              <p className="mb-2 text-xs text-muted-foreground">{enrollMessage}</p>
            )}
            <div className="flex flex-row gap-3 items-stretch">
              <div className="w-[44%] min-w-[140px] shrink-0">
                <div className="aspect-[3/4] bg-black rounded-lg relative overflow-hidden h-full min-h-[160px]">
                  <video
                    ref={monitoring.videoRef}
                    className="h-full w-full object-cover scale-x-[-1]"
                    autoPlay
                    muted
                    playsInline
                  />
                  <MonitoringVideoOverlay
                    videoRef={monitoring.videoRef}
                    analysis={monitoring.analysis}
                    showPostureGuide
                    guideSize="compact"
                    mirrored
                  />
                  {!webcamActive && (
                    <Camera className="absolute inset-0 m-auto w-10 h-10 text-muted-foreground" />
                  )}
                  <div
                    className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] rounded-full flex items-center gap-1 ${
                      webcamActive
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                    {monitoring.status === "live"
                      ? "Live"
                      : monitoring.status === "fallback-rest"
                        ? "REST"
                        : monitoring.status}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Detected parameters
                </p>
                <div className="space-y-2">
                  {DETECTION_PARAMS.map((param) => {
                    const metrics = monitoring.analysis?.metrics;
                    const raw = metrics ? metrics[param.metricKey] : null;
                    const value = typeof raw === "number" ? raw : null;
                    const flagged = metrics?.flagged_metrics?.includes(param.flagKey);
                    return (
                      <div key={param.metricKey}>
                        <div className="flex items-center justify-between text-xs mb-0.5 gap-2">
                          <span className="flex items-center gap-1 text-muted-foreground min-w-0 truncate">
                            <param.icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{param.label}</span>
                          </span>
                          <span
                            className={`font-medium shrink-0 ${
                              flagged
                                ? "text-destructive"
                                : value === null
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                            }`}
                          >
                            {value === null ? "n/a" : `${value.toFixed(0)}%`}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              flagged
                                ? "bg-destructive"
                                : "bg-primary"
                            }`}
                            style={{ width: `${value ?? 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary">
                  <UserCheck className="w-3 h-3 shrink-0" />
                  Identity verified during setup
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
