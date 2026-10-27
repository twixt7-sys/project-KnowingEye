import { useVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";

import type { SessionReportRow } from "@/core/config/api";
import { LiveSessionCard } from "@/features/monitoring/components/live-session-card";
import { type CardLayout, cardLayoutOption } from "@/features/monitoring/lib/card-layout";

const VIRTUAL_THRESHOLD = 20;
const GAP = 16;

type SessionGridProps = {
  sessions: SessionReportRow[];
  layout: CardLayout;
  onChanged: () => void;
};

/** Columns of at least `minTileWidth` that fit in `width`, never fewer than one. */
export function columnsFor(width: number, minTileWidth: number) {
  return Math.max(1, Math.floor((width + GAP) / (minTileWidth + GAP)));
}

function SessionGridStatic({ sessions, layout, onChanged }: SessionGridProps) {
  const { minTileWidth } = cardLayoutOption(layout);
  return (
    <div
      className="grid gap-4 p-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minTileWidth}px), 1fr))`,
      }}
    >
      {sessions.map((s) => (
        <LiveSessionCard key={s.id} session={s} size={layout} onChanged={onChanged} />
      ))}
    </div>
  );
}

function SessionGridVirtual({ sessions, layout, onChanged }: SessionGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { minTileWidth, estimatedRowHeight } = cardLayoutOption(layout);
  const cols = columnsFor(width, minTileWidth);
  const rowCount = Math.ceil(sessions.length / cols);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    gap: GAP,
  });

  // Rows change height with the tile size; drop measurements taken at the old size.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure only when the shape changes
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [layout, cols]);

  return (
    <div ref={parentRef} className="max-h-[640px] overflow-y-auto p-4">
      <div
        ref={innerRef}
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * cols;
          const rowSessions = sessions.slice(startIdx, startIdx + cols);
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 grid w-full gap-4"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowSessions.map((s) => (
                <LiveSessionCard key={s.id} session={s} size={layout} onChanged={onChanged} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionGrid({ sessions, layout, onChanged }: SessionGridProps) {
  if (sessions.length < VIRTUAL_THRESHOLD) {
    return <SessionGridStatic sessions={sessions} layout={layout} onChanged={onChanged} />;
  }
  return <SessionGridVirtual sessions={sessions} layout={layout} onChanged={onChanged} />;
}
