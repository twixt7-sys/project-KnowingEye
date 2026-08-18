import { Loader2, UserCheck } from "@/shared/icons";

import { Button } from "@/shared/components/ui/button";

interface IdentityStepProps {
  enrolling: boolean;
  faceDetected: boolean;
  canCaptureIdentity: boolean;
  onCapture: () => void;
}

export function IdentityStep({
  enrolling,
  faceDetected,
  canCaptureIdentity,
  onCapture,
}: IdentityStepProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <UserCheck className="w-4 h-4 text-primary" />
        {enrolling
          ? "Capturing reference face — first run may take up to a minute…"
          : faceDetected
            ? "Face detected — enrolling automatically"
            : "Align yourself in the guide, then capture"}
      </div>
      <Button
        variant="outline"
        className="w-full"
        disabled={!canCaptureIdentity}
        onClick={onCapture}
      >
        {enrolling ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enrolling…
          </>
        ) : (
          "Capture identity now"
        )}
      </Button>
    </div>
  );
}
