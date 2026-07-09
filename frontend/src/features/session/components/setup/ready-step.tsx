import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

interface ReadyStepProps {
  identityOk: boolean;
  beginning: boolean;
  refreshingSession: boolean;
  onBegin: () => void;
}

export function ReadyStep({
  identityOk,
  beginning,
  refreshingSession,
  onBegin,
}: ReadyStepProps) {
  return (
    <div className="pt-2 border-t border-border space-y-3">
      <p className="text-sm text-primary flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        Identity verified — you are cleared to start.
      </p>
      <Button
        size="lg"
        className="w-full"
        disabled={!identityOk || beginning || refreshingSession}
        onClick={onBegin}
      >
        {beginning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting exam…
          </>
        ) : (
          "Begin exam"
        )}
      </Button>
    </div>
  );
}
