import {
  buildTimelineColumns,
  buildWbsMaps,
  cellActive,
  fmtDisplay,
  groupColumnsByPhase,
  projectBounds,
  resolvePhases,
  rollupProgress,
  sameDay,
  todayDate,
  weekBandsForGroup,
} from '../../core/schedule.js';

export const id = 'gantt';
export const label = 'Gantt Chart';
export const icon = 'timeline';

const rowCollapsed = new Set();
const phaseCollapsed = new Set();
let ganttSeed = null;

function initRowCollapse(nodes, byParent) {
  if (rowCollapsed.size) return;
  for (const n of nodes) {
    if ((byParent.get(n.id) || []).length) rowCollapsed.add(n.id);
  }
  for (const n of nodes) {
    if (!n.parent_id && (byParent.get(n.id) || []).length) rowCollapsed.delete(n.id);
  }
}

function initPhaseCollapse(phases) {
  if (phaseCollapsed.size) return;
  // Mirror WBS: all phases start expanded (empty collapsed set).
}

function togglePhase(phaseId) {
  if (phaseCollapsed.has(phaseId)) phaseCollapsed.delete(phaseId);
  else phaseCollapsed.add(phaseId);
}

function indentPx(depth) {
  return 8 + depth * 20;
}

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  if (!ganttSeed) {
    try {
      ganttSeed = await utils.fetchJson('os/data/seed/gantt.json');
    } catch {
      ganttSeed = { phases: null, config: {} };
    }
  }

  const phases = resolvePhases(ganttSeed.phases);

  async function render() {
    const nodes = await store.getAll('wbs_nodes');
    const { byParent } = buildWbsMaps(nodes);
    initRowCollapse(nodes, byParent);
    initPhaseCollapse(phases);

    const today = todayDate();
    const bounds = projectBounds(nodes, phases);
    const expandedPhases = new Set(phases.map((p) => p.id).filter((id) => !phaseCollapsed.has(id)));
    const cols = buildTimelineColumns(phases, expandedPhases);
    const groups = groupColumnsByPhase(cols);

    let rows = '';
    function walk(parentKey, depth) {
      for (const n of byParent.get(parentKey) || []) {
        const kids = byParent.get(n.id) || [];
        const hasKids = kids.length > 0;
        const isOpen = !rowCollapsed.has(n.id);
        const prog = hasKids ? rollupProgress(n, byParent) : n.progress || 0;
        const cells = cols
          .map((col) => {
            const active = cellActive(n, col.start, col.end);
            const isToday = col.type === 'day' && sameDay(col.start, today);
            const cls = [
              active ? `gantt-cell on status-${n.status || 'todo'}` : 'gantt-cell',
              isToday ? 'gantt-col-today' : '',
            ].filter(Boolean).join(' ');
            const title = active ? `${n.code} ${n.title} (${Math.round(prog * 100)}%)` : '';
            const style = col.type === 'phase' && active
              ? ` style="background:color-mix(in srgb, ${col.phase.color} 45%, var(--surface2))"`
              : '';
            return `<td class="${cls}"${style} title="${utils.escapeHtml(title)}" data-id="${n.id}"></td>`;
          })
          .join('');
        const titleText = n.title.length > 42 - depth * 2 ? n.title.slice(0, 40 - depth * 2) + '…' : n.title;
        rows += `<tr class="gantt-row" data-depth="${depth}">
          <th class="gantt-row-label" style="padding-left:${indentPx(depth)}px" title="${utils.escapeHtml(n.title)}">
            ${hasKids ? `<button type="button" class="gantt-caret ${isOpen ? 'open' : ''}" data-toggle="${n.id}" aria-label="Toggle"></button>` : '<span class="gantt-caret-spacer"></span>'}
            <span class="mono gantt-code">${utils.escapeHtml(n.code)}</span>
            <span class="gantt-task-title">${utils.escapeHtml(titleText)}</span>
          </th>
          ${cells}
        </tr>`;
        if (hasKids && isOpen) walk(n.id, depth + 1);
      }
    }
    walk('ROOT', 0);

    const phaseHead = groups
      .map((group) => {
        const collapsed = group.collapsed;
        const span = group.cols.length;
        return `<th class="gantt-phase-head" colspan="${span}" data-phase="${group.phase.id}" style="border-bottom-color:${group.phase.color}">
          <button type="button" class="gantt-caret ${collapsed ? '' : 'open'}" data-phase-toggle="${group.phase.id}" aria-label="Toggle phase"></button>
          <span class="gantt-phase-label">${utils.escapeHtml(group.phase.id)}</span>
          <span class="gantt-phase-range muted">${utils.escapeHtml(fmtDisplay(group.start).replace(/, \d{4}$/, ''))} – ${utils.escapeHtml(fmtDisplay(group.end).replace(/, \d{4}$/, ''))}</span>
        </th>`;
      })
      .join('');

    const weekHead = groups
      .flatMap((group) => weekBandsForGroup(group).map((band) => {
        const isToday = !group.collapsed && band.start && sameDay(band.start, today);
        return `<th class="gantt-week-head${isToday ? ' gantt-col-today' : ''}" colspan="${band.span}" data-phase="${group.phase.id}">${utils.escapeHtml(band.label)}</th>`;
      }))
      .join('');

    const dayHead = cols
      .map((col) => {
        if (col.type === 'phase') {
          return `<th class="gantt-col-head gantt-col-collapsed" data-phase="${col.phase.id}" title="${utils.escapeHtml(col.label)}">…</th>`;
        }
        const isToday = sameDay(col.start, today);
        const tip = fmtDisplay(col.start);
        return `<th class="gantt-col-head${isToday ? ' gantt-col-today' : ''}" data-phase="${col.phase.id}" title="${utils.escapeHtml(tip)}">${utils.escapeHtml(col.label)}</th>`;
      })
      .join('');

    const rangeLabel = `${fmtDisplay(bounds.min)} – ${fmtDisplay(bounds.max)}`;

    container.innerHTML = `
      <section class="module-page gantt-page">
        <header class="page-head">
          <div>
            <h1>Gantt Chart</h1>
            <p class="page-sub">Daily timeline aligned with <code>Knowing Eye Gantt Chart - Sheet1.csv</code> · Today: <strong>${utils.escapeHtml(fmtDisplay(today))}</strong> · ${utils.escapeHtml(rangeLabel)}. Toggle ▶ on phases or tasks. Edit dates in <a href="#/wbs">WBS</a>.</p>
          </div>
          <div class="gantt-toolbar">
            <button class="btn btn-sm" id="g-expand-rows">Expand rows</button>
            <button class="btn btn-sm" id="g-collapse-rows">Collapse rows</button>
            <button class="btn btn-sm" id="g-expand-phases">Expand phases</button>
            <button class="btn btn-sm" id="g-collapse-phases">Collapse phases</button>
          </div>
        </header>
        <div class="gantt-grid-wrap card">
          <table class="gantt-grid">
            <thead>
              <tr><th class="gantt-row-label gantt-corner" rowspan="3">WBS Task</th>${phaseHead}</tr>
              <tr>${weekHead}</tr>
              <tr>${dayHead}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="muted" style="font-size:0.8rem">P1 Planning · P2 System Development · P3 Testing &amp; Docs · project ${utils.escapeHtml(ganttSeed.config?.project_start || '2026-04-16')} – ${utils.escapeHtml(ganttSeed.config?.project_end || '2026-06-10')}</p>
      </section>`;

    container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tid = btn.dataset.toggle;
        if (rowCollapsed.has(tid)) rowCollapsed.delete(tid);
        else rowCollapsed.add(tid);
        render();
      };
    });

    container.querySelectorAll('[data-phase-toggle]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        togglePhase(btn.dataset.phaseToggle);
        render();
      };
    });

    container.querySelectorAll('.gantt-phase-head').forEach((th) => {
      th.onclick = (e) => {
        if (e.target.closest('[data-phase-toggle]')) return;
        togglePhase(th.dataset.phase);
        render();
      };
    });

    container.querySelector('#g-expand-rows').onclick = () => { rowCollapsed.clear(); render(); };
    container.querySelector('#g-collapse-rows').onclick = () => {
      nodes.forEach((n) => { if ((byParent.get(n.id) || []).length) rowCollapsed.add(n.id); });
      for (const n of nodes) { if (!n.parent_id) rowCollapsed.delete(n.id); }
      render();
    };
    container.querySelector('#g-expand-phases').onclick = () => { phaseCollapsed.clear(); render(); };
    container.querySelector('#g-collapse-phases').onclick = () => { phases.forEach((p) => phaseCollapsed.add(p.id)); render(); };
    container.querySelectorAll('.gantt-cell.on').forEach((cell) => {
      cell.onclick = () => { location.hash = '#/wbs'; };
    });
  }

  await render();
}

export function unmount(container) {
  container.innerHTML = '';
}
