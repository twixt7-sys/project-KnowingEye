// Shared WBS tree + Gantt phase timeline (aligned with Gantt CSV).

export const PHASES = [
  { id: 'P1', label: 'P1 — Planning', start: '2026-04-16', end: '2026-05-02', color: '#5b8def' },
  { id: 'P2', label: 'P2 — System Development', start: '2026-05-03', end: '2026-06-21', color: '#7c5cff' },
  { id: 'P3', label: 'P3 — Testing & Docs', start: '2026-06-22', end: '2026-07-18', color: '#34d399' },
];

export function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtIso(d) {
  return d.toISOString().slice(0, 10);
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

export function weekLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

/** Week-start columns inside expanded phases. */
export function buildWeekColumns(phases, expandedPhaseIds) {
  const cols = [];
  for (const ph of phases) {
    const expanded = expandedPhaseIds.has(ph.id);
    const start = parseDate(ph.start);
    const end = parseDate(ph.end);
    if (!start || !end) continue;
    if (!expanded) {
      cols.push({ type: 'phase', phase: ph, key: ph.id, label: ph.label, start, end });
      continue;
    }
    const days = eachDay(start, end);
    for (let i = 0; i < days.length; i += 7) {
      const wStart = days[i];
      const wEnd = addDays(wStart, 6);
      const cap = wEnd > end ? end : wEnd;
      cols.push({
        type: 'week',
        phase: ph,
        key: `${ph.id}-w${i}`,
        label: weekLabel(wStart),
        start: wStart,
        end: cap,
      });
    }
  }
  return cols;
}

export function cellActive(node, colStart, colEnd) {
  const s = parseDate(node.start_date);
  const e = parseDate(node.end_date) || s;
  if (!s || !e) return false;
  return colStart <= e && colEnd >= s;
}

export function projectBounds(nodes) {
  let min = parseDate('2026-04-16');
  let max = parseDate('2026-07-18');
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
