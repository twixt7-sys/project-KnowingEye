// Shared WBS tree + Gantt phase timeline (aligned with Gantt CSV / Sheet1).

export const PHASES = [
  { id: 'P1', label: 'P1 - Planning', start: '2026-04-16', end: '2026-05-02', color: '#5b8def' },
  { id: 'P2', label: 'P2 - System Development', start: '2026-05-03', end: '2026-06-21', color: '#7c5cff' },
  { id: 'P3', label: 'P3 - Testing & Docs', start: '2026-06-22', end: '2026-07-18', color: '#34d399' },
];

export function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDate() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12);
}

export function sameDay(a, b) {
  if (!a || !b) return false;
  return fmtIso(a) === fmtIso(b);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function eachDay(start, end) {
  const out = [];
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export function dayOfWeekLetter(d) {
  return d.toLocaleDateString('en-US', { weekday: 'narrow' }).slice(0, 1);
}

export function dayHeaderLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

export function fmtDisplay(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildWbsMaps(nodes) {
  const byParent = new Map();
  const byId = new Map();
  for (const n of nodes) {
    byId.set(n.id, n);
    const p = n.parent_id || 'ROOT';
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return { byParent, byId };
}

export function rollupProgress(node, byParent) {
  const children = byParent.get(node.id) || [];
  if (!children.length) return node.progress || 0;
  return children.reduce((s, c) => s + rollupProgress(c, byParent), 0) / children.length;
}

/** Daily columns inside expanded phases; one summary column when collapsed. */
export function buildTimelineColumns(phases, expandedPhaseIds) {
  const cols = [];
  for (const ph of phases) {
    const start = parseDate(ph.start);
    const end = parseDate(ph.end);
    if (!start || !end) continue;
    if (!expandedPhaseIds.has(ph.id)) {
      cols.push({ type: 'phase', phase: ph, key: ph.id, label: ph.label, start, end });
      continue;
    }
    for (const d of eachDay(start, end)) {
      cols.push({
        type: 'day',
        phase: ph,
        key: `${ph.id}-${fmtIso(d)}`,
        label: dayOfWeekLetter(d),
        dateLabel: dayHeaderLabel(d),
        start: d,
        end: d,
      });
    }
  }
  return cols;
}

/** @deprecated use buildTimelineColumns */
export function buildWeekColumns(phases, expandedPhaseIds) {
  return buildTimelineColumns(phases, expandedPhaseIds);
}

export function groupColumnsByPhase(cols) {
  const groups = [];
  for (const col of cols) {
    const last = groups[groups.length - 1];
    if (last && last.phase.id === col.phase.id) {
      last.cols.push(col);
      last.end = col.end;
    } else {
      groups.push({
        phase: col.phase,
        cols: [col],
        start: col.start,
        end: col.end,
        collapsed: col.type === 'phase',
      });
    }
  }
  return groups;
}

export function weekBandsForGroup(group) {
  if (group.collapsed) {
    return [{ label: group.phase.id, span: 1 }];
  }
  const bands = [];
  for (let i = 0; i < group.cols.length; i += 7) {
    const chunk = group.cols.slice(i, i + 7);
    bands.push({
      label: `W${Math.floor(i / 7) + 1}`,
      span: chunk.length,
      start: chunk[0].start,
    });
  }
  return bands;
}

export function cellActive(node, colStart, colEnd) {
  const s = parseDate(node.start_date);
  const e = parseDate(node.end_date) || s;
  if (!s || !e) return false;
  return colStart <= e && colEnd >= s;
}

export function projectBounds(nodes, phases = PHASES) {
  let min = parseDate(phases[0]?.start) || parseDate('2026-04-16');
  let max = parseDate(phases[phases.length - 1]?.end) || parseDate('2026-07-18');
  for (const ph of phases) {
    const s = parseDate(ph.start);
    const e = parseDate(ph.end);
    if (s && s < min) min = s;
    if (e && e > max) max = e;
  }
  for (const n of nodes) {
    const s = parseDate(n.start_date);
    const e = parseDate(n.end_date);
    if (s && s < min) min = s;
    if (e && e > max) max = e;
  }
  return { min, max };
}

export function phaseForCode(code) {
  const top = String(code || '').split('.')[0];
  if (top === '0') return 'P3';
  if (top === '1') return 'P1';
  if (top === '2') return 'P2';
  return 'P3';
}

export function resolvePhases(seedPhases) {
  if (Array.isArray(seedPhases) && seedPhases.length) return seedPhases;
  return PHASES;
}
