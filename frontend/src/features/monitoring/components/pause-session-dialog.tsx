import { useEffect, useId, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Loader2, Pause } from "@/shared/icons";

const REASON_MAX_LENGTH = 255;

interface PauseSessionDialogProps {
  open: boolean;
  /** Examinee's name, for the description. */
  studentName?: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

/** Confirms pausing an exam and collects the optional note the examinee will see. */
export function PauseSessionDialog({
  open,
  studentName,
  busy,
  onOpenChange,
  onConfirm,
}: PauseSessionDialogProps) {
  const reasonId = useId();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause exam?</DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName}'s` : "The"} exam clock stops and they can't answer or
            submit until you resume. The time spent paused is added back to their deadline. Unlike
            terminating, nothing is lost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={reasonId}>Note for the examinee (optional)</Label>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Please wait while we sort out a room issue."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onConfirm(reason)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            Pause exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
