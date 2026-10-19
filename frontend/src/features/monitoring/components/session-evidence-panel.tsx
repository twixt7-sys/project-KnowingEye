import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchSnapshotImageSrc } from "@/features/monitoring/api/monitoring-api";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { monitoringQueries } from "@/features/monitoring/queries/queries";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { Camera, Loader2 } from "@/shared/icons";
import type { SessionSnapshotRow } from "@/shared/types/api";

const label = (value: string) => value.replace(/_/g, " ");
const when = (iso: string) => new Date(iso).toLocaleTimeString();

/**
 * One evidence JPEG. The endpoint is permission-checked (it is not public
 * media), so the bytes are fetched with the caller's token.
 */
function SnapshotImage({
  snapshot,
  className,
}: {
  snapshot: SessionSnapshotRow;
  className?: string;
}) {
  const query = useQuery({
    queryKey: monitoringKeys.snapshotImage(snapshot.id),
    queryFn: () => fetchSnapshotImageSrc(snapshot.id),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const url = query.data;

  if (url) {
    return (
      <img
        src={url}
        alt={`${label(snapshot.label)} snapshot at ${when(snapshot.captured_at)}`}
        className={className}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className ?? ""}`}
    >
      {query.isError ? "Unavailable" : <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  );
}

function SnapshotTile({
  snapshot,
  onOpen,
}: {
  snapshot: SessionSnapshotRow;
  onOpen: (snapshot: SessionSnapshotRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(snapshot)}
      className="group block w-full overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SnapshotImage snapshot={snapshot} className="aspect-[4/3] w-full object-cover" />
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium capitalize">
          {snapshot.flags.length ? snapshot.flags.map(label).join(", ") : "No anomaly flagged"}
        </p>
        <p className="text-[0.68rem] text-muted-foreground tabular-nums">
          {when(snapshot.captured_at)}
        </p>
      </div>
    </button>
  );
}

/**
 * Persisted proctoring evidence for a session: the frame behind each warning
 * and the last frames before a termination. Staff-only (the endpoint refuses
 * everyone else), kept for incident review and student disputes.
 */
export function SessionEvidencePanel({ sessionId }: { sessionId: string }) {
  const query = useQuery(monitoringQueries.sessionSnapshots(sessionId));
  const [open, setOpen] = useState<SessionSnapshotRow | null>(null);

  const snapshots = query.data ?? [];
  const warnings = snapshots.filter((s) => s.kind === "warning");
  const termination = snapshots.filter((s) => s.kind === "termination");

  return (
    <section className="mt-6 rounded-xl border bg-card p-4" aria-label="Evidence snapshots">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Camera className="h-4 w-4" />
        Evidence snapshots
        {snapshots.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">
            {snapshots.length}
          </span>
        )}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Frames saved when a warning was raised and when the session was terminated. Only
        staff can see these.
      </p>

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading snapshots…</p>}
      {query.isError && (
        <p className="text-sm text-destructive">Could not load the evidence snapshots.</p>
      )}
      {!query.isLoading && !query.isError && snapshots.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No snapshots yet. They are saved when a warning is raised and when a session is
          terminated.
        </p>
      )}

      {warnings.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium">Warnings ({warnings.length})</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {warnings.map((s) => (
              <li key={s.id} className="min-w-0">
                <SnapshotTile snapshot={s} onOpen={setOpen} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {termination.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">
            Before termination ({termination.length})
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {termination.map((s) => (
              <li key={s.id} className="min-w-0">
                <SnapshotTile snapshot={s} onOpen={setOpen} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          {open && (
            <>
              <DialogTitle className="capitalize">
                {open.kind === "warning"
                  ? `Warning: ${label(open.alert_type ?? open.label)}`
                  : "Before termination"}
              </DialogTitle>
              <DialogDescription>
                {open.student} · {open.exam_title} · {new Date(open.captured_at).toLocaleString()}
              </DialogDescription>
              <SnapshotImage
                snapshot={open}
                className="max-h-[60vh] w-full rounded-md bg-black object-contain"
              />
              <dl className="grid gap-1 text-sm">
                {open.alert_message && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Alert</dt>
                    <dd>
                      {open.alert_message}
                      {open.alert_severity && (
                        <span className="ml-1.5 capitalize text-muted-foreground">
                          ({open.alert_severity})
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Detected</dt>
                  <dd className="capitalize">
                    {open.flags.length ? open.flags.map(label).join(", ") : "Nothing flagged"}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
