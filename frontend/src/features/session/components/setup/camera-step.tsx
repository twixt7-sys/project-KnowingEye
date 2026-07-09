import { Camera } from "lucide-react";

import { MonitoringVideoOverlay } from "@/shared/components/monitoring/monitoring-video-overlay";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import type { useMonitoring } from "@/shared/hooks/use-monitoring";

interface CameraStepProps {
  monitoring: ReturnType<typeof useMonitoring>;
  webcamLive: boolean;
  showContinue?: boolean;
  onContinue: () => void;
}

export function CameraStep({ monitoring, webcamLive, showContinue = false, onContinue }: CameraStepProps) {
  return (
    <Card className="border-border bg-card/70 backdrop-blur shadow-2xl overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Live proctoring preview
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Match your position to the user outline — aligned means you are ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-border shadow-inner">
          <video
            ref={monitoring.videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover scale-x-[-1]"
          />
          <MonitoringVideoOverlay
            videoRef={monitoring.videoRef}
            analysis={monitoring.analysis}
            showPostureGuide
            mirrored
          />
          {webcamLive && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-destructive/90 border-0 text-[10px] uppercase tracking-wider text-destructive-foreground">
                Rec
              </Badge>
            </div>
          )}
        </div>
        {showContinue && webcamLive && (
          <Button className="mt-4 w-full" onClick={onContinue}>
            Camera looks good — verify identity
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
