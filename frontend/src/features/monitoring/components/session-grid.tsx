import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { SessionReportRow } from "@/core/config/api";
import { LiveSessionCard } from "@/features/monitoring/components/live-session-card";

const VIRTUAL_THRESHOLD = 20;
const ROW_HEIGHT = 340;
const COLS = 2;

type SessionGridProps = {
  sessions: SessionReportRow[];
  onTerminated: () => void;
};

function SessionGridStatic({ sessions, onTerminated }: SessionGridProps) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      {sessions.map((s) => (
        <LiveSessionCard key={s.id} session={s} onTerminated={onTerminated} />
      ))}
    </div>
  );
}

function SessionGridVirtual({ sessions, onTerminated }: SessionGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(sessions.length / COLS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    gap: 16,
  });

  return (
    <div ref={parentRef} className="max-h-[640px] overflow-y-auto p-4">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * COLS;
          const rowSessions = sessions.slice(startIdx, startIdx + COLS);
          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full gap-4 sm:grid-cols-2"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {rowSessions.map((s) => (
                <LiveSessionCard key={s.id} session={s} onTerminated={onTerminated} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionGrid({ sessions, onTerminated }: SessionGridProps) {
  if (sessions.length < VIRTUAL_THRESHOLD) {
    return <SessionGridStatic sessions={sessions} onTerminated={onTerminated} />;
  }
  return <SessionGridVirtual sessions={sessions} onTerminated={onTerminated} />;
}
