import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { ExamTimer } from "@/features/session/components/taking/exam-timer";

interface FocusShellProps {
  monitoringEnabled: boolean;
  webcamActive: boolean;
  behaviorAlerts: string[];
  timeRemaining: number;
  submitting: boolean;
  onSubmitClick: () => void;
  children: ReactNode;
}

export function FocusShell({
  monitoringEnabled,
  webcamActive,
  behaviorAlerts,
  timeRemaining,
  submitting,
  onSubmitClick,
  children,
}: FocusShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {monitoringEnabled && (
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    webcamActive
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {webcamActive ? "Monitoring Active" : "Camera Offline"}
                  </span>
                </div>
              )}
              {monitoringEnabled && behaviorAlerts.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {behaviorAlerts[behaviorAlerts.length - 1]}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <ExamTimer seconds={timeRemaining} />
              <button
                type="button"
                onClick={onSubmitClick}
                disabled={submitting}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Exam"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
