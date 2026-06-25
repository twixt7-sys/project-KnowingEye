// SvgGantt — pure SVG + vanilla JS Gantt renderer. No external dependencies.
// Features: month/week/quarter zoom, draggable + resizable bars, dependency
// arrows (finish-to-start), milestone diamonds, today line, SVG export.

const DAY = 86400000;
const ZOOM = { week: 26, month: 7, quarter: 3.2 };
const ROW_H = 34;
const HEADER_H = 44;
const LABEL_W = 190;
const STATUS_COLORS = {
  done: '#34d399', in_progress: '#5b8def', todo: '#8b95a8', backlog: '#6b7280', review: '#fbbf24',
};

function parse(d) { return new Date(String(d).length <= 10 ? d + 'T00:00:00' : d); }
function fmtMonth(d) { return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
function addDays(d, n) { return new Date(d.getTime() + n * DAY); }
function toISO(d) { return d.toISOString().slice(0, 10); }

export class SvgGantt {
  constructor({ tasks = [], config = {}, onTaskChange = null } = {}) {
    this.tasks = tasks.map((t) => ({ ...t }));
    this.config = config;
    this.onTaskChange = onTaskChange;
    this.zoom = config.zoom || 'month';
    this.container = null;
  }

  setZoom(level) {
    if (ZOOM[level]) {
      this.zoom = level;
      this.render(this.container);
    }
  }

  _bounds() {
    const starts = this.tasks.map((t) => parse(t.start));
    const ends = this.tasks.map((t) => parse(t.end));
    let min = this.config.start_date ? parse(this.config.start_date) : new Date(Math.min(...starts));
    let max = this.config.end_date ? parse(this.config.end_date) : new Date(Math.max(...ends));
    min = addDays(min, -2);
    max = addDays(max, 4);
    return { min, max };
  }

  _x(date, min, dayW) { return LABEL_W + Math.round(((parse(date) - min) / DAY) * dayW); }

  render(container) {
    this.container = container;
    const dayW = ZOOM[this.zoom];
    const { min, max } = this._bounds();
    const totalDays = Math.max(1, Math.round((max - min) / DAY));
    const width = LABEL_W + totalDays * dayW;
    const height = HEADER_H + this.tasks.length * ROW_H + 12;
    const taskIndex = new Map(this.tasks.map((t, i) => [t.id, i]));

    // month gridlines + labels
    let grid = '';
    let cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cursor <= max) {
      const x = this._x(cursor, min, dayW);
      grid += `<line x1="${x}" y1="${HEADER_H}" x2="${x}" y2="${height}" stroke="var(--border)" stroke-dasharray="2 4"/>`;
      grid += `<text x="${x + 5}" y="26" font-size="11" fill="var(--muted)">${fmtMonth(cursor)}</text>`;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    // today line
    const today = new Date();
    let todayLine = '';
    if (today >= min && today <= max) {
      const tx = this._x(today, min, dayW);
      todayLine = `<line x1="${tx}" y1="${HEADER_H - 6}" x2="${tx}" y2="${height}" stroke="var(--accent2)" stroke-width="1.5"/><text x="${tx + 4}" y="${HEADER_H - 8}" font-size="9" fill="var(--accent2)">today</text>`;
    }

    // dependency arrows
    let deps = '';
    this.tasks.forEach((t, i) => {
      (t.dependencies || []).forEach((depId) => {
        const di = taskIndex.get(depId);
        if (di == null) return;
        const dep = this.tasks[di];
        const x1 = this._x(dep.end, min, dayW);
        const y1 = HEADER_H + di * ROW_H + ROW_H / 2;
        const x2 = this._x(t.start, min, dayW);
        const y2 = HEADER_H + i * ROW_H + ROW_H / 2;
        const mx = Math.max(x1 + 8, x2 - 8);
        deps += `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" fill="none" stroke="var(--muted)" stroke-width="1.2" marker-end="url(#gantt-arrow)" opacity="0.7"/>`;
      });
    });

    // rows + bars
    let rows = '';
    this.tasks.forEach((t, i) => {
      const y = HEADER_H + i * ROW_H;
      const barY = y + 6;
      const barH = ROW_H - 14;
      rows += `<rect x="0" y="${y}" width="${width}" height="${ROW_H}" fill="${i % 2 ? 'transparent' : 'var(--accent-soft)'}" opacity="0.5"/>`;
      rows += `<text x="10" y="${y + ROW_H / 2 + 4}" font-size="11" fill="var(--text)" clip-path="inset(0 0 0 0)">${this._truncate(t.title, 26)}</text>`;

      if (t.milestone) {
        const mx = this._x(t.start, min, dayW);
        const my = y + ROW_H / 2;
        rows += `<path d="M${mx} ${my - 8} L${mx + 8} ${my} L${mx} ${my + 8} L${mx - 8} ${my} Z" fill="var(--accent2)" stroke="#fff" stroke-width="1" class="gantt-bar" data-id="${t.id}"><title>${t.title} · ${t.start}</title></path>`;
        rows += `<text x="${mx + 12}" y="${my + 4}" font-size="10" fill="var(--muted)">${this._truncate(t.title, 18)}</text>`;
      } else {
        const x = this._x(t.start, min, dayW);
        const w = Math.max(6, this._x(t.end, min, dayW) - x);
        const color = STATUS_COLORS[t.status] || '#5b8def';
        rows += `<g class="gantt-bar-group" data-id="${t.id}" style="cursor:grab">`;
        rows += `<rect class="gantt-bar" data-id="${t.id}" data-role="move" x="${x}" y="${barY}" width="${w}" height="${barH}" rx="5" fill="${color}" opacity="0.35"/>`;
        rows += `<rect x="${x}" y="${barY}" width="${(w * (t.progress || 0)).toFixed(1)}" height="${barH}" rx="5" fill="${color}"/>`;
        rows += `<rect class="gantt-handle" data-id="${t.id}" data-role="resize-l" x="${x - 2}" y="${barY}" width="6" height="${barH}" fill="transparent" style="cursor:ew-resize"/>`;
        rows += `<rect class="gantt-handle" data-id="${t.id}" data-role="resize-r" x="${x + w - 4}" y="${barY}" width="6" height="${barH}" fill="transparent" style="cursor:ew-resize"/>`;
        rows += `<title>${t.title}\n${t.start} → ${t.end} (${Math.round((t.progress || 0) * 100)}%)\n${t.assignee || ''}</title>`;
        rows += `</g>`;
      }
    });

    const svg = `<svg class="gantt-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="var(--muted)"/></marker></defs>
      <rect x="0" y="0" width="${width}" height="${HEADER_H}" fill="var(--surface2)"/>
      <line x1="${LABEL_W}" y1="0" x2="${LABEL_W}" y2="${height}" stroke="var(--border-strong)"/>
      ${grid}${todayLine}${deps}${rows}
    </svg>`;

    container.innerHTML = svg;
    this._svg = container.querySelector('svg');
    this._bindDrag(min, dayW);
  }

  _truncate(s, n) {
    s = String(s || '');
    return (s.length > n ? s.slice(0, n - 1) + '…' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  _bindDrag(min, dayW) {
    if (!this.onTaskChange) return;
    const svg = this._svg;
    let drag = null;

    const pointerDown = (e) => {
      const handle = e.target.closest('[data-role]');
      if (!handle) return;
      const id = handle.dataset.id;
      const role = handle.dataset.role;
      const task = this.tasks.find((t) => t.id === id);
      if (!task || task.milestone) return;
      drag = { id, role, task, startX: e.clientX, origStart: parse(task.start), origEnd: parse(task.end) };
      svg.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const pointerMove = (e) => {
      if (!drag) return;
      const deltaDays = Math.round((e.clientX - drag.startX) / dayW);
      if (deltaDays === 0) return;
      const t = drag.task;
      if (drag.role === 'move') {
        t.start = toISO(addDays(drag.origStart, deltaDays));
        t.end = toISO(addDays(drag.origEnd, deltaDays));
      } else if (drag.role === 'resize-l') {
        const ns = addDays(drag.origStart, deltaDays);
        if (ns < drag.origEnd) t.start = toISO(ns);
      } else if (drag.role === 'resize-r') {
        const ne = addDays(drag.origEnd, deltaDays);
        if (ne > drag.origStart) t.end = toISO(ne);
      }
      this.render(this.container);
    };

    const pointerUp = () => {
      if (drag) {
        this.onTaskChange({ ...drag.task });
        drag = null;
      }
    };

    svg.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    this._cleanup = () => {
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
    };
  }

  exportSvg() {
    if (!this._svg) return '';
    const clone = this._svg.cloneNode(true);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + clone.outerHTML;
  }

  destroy() {
    this._cleanup?.();
  }
}
