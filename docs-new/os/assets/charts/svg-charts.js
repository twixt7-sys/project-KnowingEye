// Pure-SVG chart helpers. Return SVG markup strings (no external libs).
// Colors pull from CSS custom properties via currentColor / explicit vars.

const PALETTE = ['#5b8def', '#7c5cff', '#34d399', '#fbbf24', '#f472b6', '#38bdf8', '#fb923c', '#a78bfa'];

function escapeText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Horizontal/vertical single-series bar chart.
export function barChart(data, { width = 420, height = 220, max, color = 'var(--accent)', valueSuffix = '' } = {}) {
  const items = data.filter(Boolean);
  if (!items.length) return '<p class="muted">No data</p>';
  const pad = { top: 16, right: 16, bottom: 36, left: 36 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const peak = max ?? Math.max(...items.map((d) => d.value), 1);
  const bw = cw / items.length;
  let bars = '';
  items.forEach((d, i) => {
    const h = (d.value / peak) * ch;
    const x = pad.left + i * bw + bw * 0.15;
    const y = pad.top + ch - h;
    const w = bw * 0.7;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${d.color || color}"><title>${escapeText(d.label)}: ${escapeText(d.value)}${valueSuffix}</title></rect>`;
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--text)">${escapeText(d.value)}${valueSuffix}</text>`;
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(pad.top + ch + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${escapeText(d.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="bar chart"><line x1="${pad.left}" y1="${pad.top + ch}" x2="${width - pad.right}" y2="${pad.top + ch}" stroke="var(--border)"/>${bars}</svg>`;
}

// Grouped bar chart for several metrics (used by classification metrics).
export function groupedBar(groups, { width = 480, height = 240, max = 100, valueSuffix = '%' } = {}) {
  if (!groups.length) return '<p class="muted">No data</p>';
  const pad = { top: 18, right: 16, bottom: 40, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const gw = cw / groups.length;
  let bars = '';
  groups.forEach((g, i) => {
    const h = (g.value / max) * ch;
    const x = pad.left + i * gw + gw * 0.2;
    const y = pad.top + ch - h;
    const w = gw * 0.6;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${PALETTE[i % PALETTE.length]}"><title>${escapeText(g.label)}: ${g.value}${valueSuffix}</title></rect>`;
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text)">${g.value}${valueSuffix}</text>`;
    bars += `<text x="${(x + w / 2).toFixed(1)}" y="${(pad.top + ch + 18).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)">${escapeText(g.label)}</text>`;
  });
  // gridlines
  let grid = '';
  for (let t = 0; t <= 4; t++) {
    const gy = pad.top + (ch / 4) * t;
    grid += `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" stroke="var(--border)" stroke-dasharray="2 4"/>`;
    grid += `<text x="${pad.left - 6}" y="${gy + 3}" text-anchor="end" font-size="9" fill="var(--muted)">${Math.round(max - (max / 4) * t)}</text>`;
  }
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="grouped bar chart">${grid}${bars}</svg>`;
}

// Donut chart from [{label, value, color}].
export function donutChart(data, { size = 180, thickness = 26 } = {}) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) return '<p class="muted">No data</p>';
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let arcs = '';
  items.forEach((d, i) => {
    const frac = d.value / total;
    const len = frac * circ;
    arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color || PALETTE[i % PALETTE.length]}" stroke-width="${thickness}" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${escapeText(d.label)}: ${d.value}</title></circle>`;
    offset += len;
  });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="donut chart"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface3)" stroke-width="${thickness}"/>${arcs}<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="26" font-weight="700" fill="var(--text)">${total}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="10" fill="var(--muted)">total</text></svg>`;
}

export function legend(data) {
  return `<div class="row" style="gap:0.8rem;font-size:0.8rem">${data
    .map((d, i) => `<span class="row" style="gap:0.35rem"><span style="width:11px;height:11px;border-radius:3px;background:${d.color || PALETTE[i % PALETTE.length]}"></span>${escapeText(d.label)}</span>`)
    .join('')}</div>`;
}

// Ring gauge 0..1 for health scores.
export function gauge(value, { size = 120, label = '' } = {}) {
  const r = (size - 16) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const len = v * circ;
  const color = v >= 0.75 ? 'var(--ok)' : v >= 0.5 ? 'var(--warn)' : 'var(--danger)';
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="gauge">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface3)" stroke-width="12"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text)">${Math.round(v * 100)}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="9" fill="var(--muted)">${escapeText(label)}</text>
  </svg>`;
}

export { PALETTE };
