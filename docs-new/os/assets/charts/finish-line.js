// Finish-line milestone progress visualization.

import { parseDate } from '../core/schedule.js';

function escapeText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function finishLine(milestones, { start = '2026-04-16', end = '2026-07-04', width = 720, height = 120 } = {}) {
  const ms = [...milestones].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!ms.length) return '<p class="muted">No milestones</p>';

  const t0 = parseDate(start).getTime();
  const t1 = parseDate(end).getTime();
  const span = Math.max(t1 - t0, 1);
  const pad = { l: 24, r: 24, t: 28, b: 36 };
  const trackY = 58;
  const trackW = width - pad.l - pad.r;

  const xAt = (date) => pad.l + ((parseDate(date).getTime() - t0) / span) * trackW;

  let flags = '';
  let labels = '';
  ms.forEach((m, i) => {
    const x = xAt(m.date);
    const done = m.status === 'completed';
    const risk = m.status === 'at_risk';
    const color = done ? '#34d399' : risk ? '#fbbf24' : 'var(--accent)';
    const emoji = done ? '✓' : m.category === 'institutional' ? '🏁' : '⚑';
    flags += `<g transform="translate(${x.toFixed(1)},${trackY - 18})">
      <line x1="0" y1="18" x2="0" y2="32" stroke="${color}" stroke-width="2"/>
      <circle cx="0" cy="10" r="11" fill="var(--surface)" stroke="${color}" stroke-width="2"/>
      <text x="0" y="14" text-anchor="middle" font-size="11">${emoji}</text>
      <title>${escapeText(m.title)} — ${m.date}</title>
    </g>`;
    if (i % 2 === 0 || ms.length <= 6) {
      labels += `<text x="${x.toFixed(1)}" y="${trackY + 48}" text-anchor="middle" font-size="9" fill="var(--muted)">${escapeText(m.title.length > 14 ? m.title.slice(0, 12) + '…' : m.title)}</text>`;
    }
  });

  const today = new Date();
  const todayX = pad.l + ((today.getTime() - t0) / span) * trackW;
  const showToday = todayX >= pad.l && todayX <= width - pad.r;

  const completed = ms.filter((m) => m.status === 'completed').length;
  const pct = Math.round((completed / ms.length) * 100);

  return `<svg class="finish-line" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="milestone finish line">
    <text x="${pad.l}" y="16" font-size="11" fill="var(--muted)">Capstone race · ${completed}/${ms.length} checkpoints</text>
    <text x="${width - pad.r}" y="16" text-anchor="end" font-size="12" font-weight="600" fill="var(--accent)">${pct}%</text>
    <rect x="${pad.l}" y="${trackY}" width="${trackW}" height="8" rx="4" fill="var(--surface3)"/>
    <rect x="${pad.l}" y="${trackY}" width="${(trackW * completed / ms.length).toFixed(1)}" height="8" rx="4" fill="url(#finishGrad)"/>
    <defs>
      <linearGradient id="finishGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5b8def"/>
        <stop offset="100%" stop-color="#34d399"/>
      </linearGradient>
    </defs>
    ${showToday ? `<line x1="${todayX.toFixed(1)}" y1="${trackY - 8}" x2="${todayX.toFixed(1)}" y2="${trackY + 20}" stroke="#f472b6" stroke-width="2" stroke-dasharray="4 3"/><text x="${todayX.toFixed(1)}" y="${trackY - 12}" text-anchor="middle" font-size="9" fill="#f472b6">today</text>` : ''}
    <g transform="translate(${width - pad.r - 14},${trackY - 4})">
      <rect width="14" height="16" fill="url(#checkers)" stroke="var(--border)" stroke-width="1"/>
      <defs><pattern id="checkers" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="2" height="2" fill="#fff"/><rect x="2" y="2" width="2" height="2" fill="#fff"/>
        <rect x="2" width="2" height="2" fill="#111"/><rect y="2" width="2" height="2" fill="#111"/>
      </pattern></defs>
    </g>
    ${flags}
    ${labels}
  </svg>`;
}
