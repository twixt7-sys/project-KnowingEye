import {
  PHASES,
  buildWbsMaps,
  buildWeekColumns,
  cellActive,
  parseDate,
  rollupProgress,
} from '../../core/schedule.js';

export const id = 'gantt';
export const label = 'Gantt Chart';
export const icon = 'timeline';

const rowCollapsed = new Set();
const phaseCollapsed = new Set();

function initRowCollapse(nodes, byParent) {
  if (rowCollapsed.size) return;
  for (const n of nodes) {
    if ((byParent.get(n.id) || []).length) rowCollapsed.add(n.id);
  }
  // show top-level phases expanded
  for (const n of nodes) {
    if (!n.parent_id && (byParent.get(n.id) || []).length) rowCollapsed.delete(n.id);
  }
}

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const nodes = await store.getAll('wbs_nodes');
    const { byParent } = buildWbsMaps(nodes);
    initRowCollapse(nodes, byParent);

    const expandedPhases = new Set(PHASES.map((p) => p.id).filter((id) => !phaseCollapsed.has(id)));
    const cols = buildWeekColumns(PHASES, expandedPhases);

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
            const cls = active ? `gantt-cell on status-${n.status || 'todo'}` : 'gantt-cell';
            const title = active ? `${n.code} ${n.title} (${Math.round(prog * 100)}%)` : '';
            const style = col.type === 'phase' && active ? ` style="background:color-mix(in srgb, ${col.phase.color} 45%, var(--surface2))"` : '';
            return `<td class="${cls}"${style} title="${utils.escapeHtml(title)}" data-id="${n.id}"></td>`;
          })
          .join('');
        rows += `<tr class="gantt-row" data-depth="${depth}">
          <th class="gantt-row-label" style="padding-left:${8 + depth * 14}px" title="${utils.escapeHtml(n.title)}">
            ${hasKids ? `<button type="button" class="gantt-caret ${isOpen ? 'open' : ''}" data-toggle="${n.id}" aria-label="Toggle"></button>` : '<span class="gantt-caret-spacer"></span>'}
            <span class="mono">${utils.escapeHtml(n.code)}</span>
            <span class="gantt-task-title">${utils.escapeHtml(n.title.length > 36 ? n.title.slice(0, 34) + '…' : n.title)}</span>
          </th>
          ${cells}
        </tr>`;
        if (hasKids && isOpen) walk(n.id, depth + 1);
      }
    }
    walk('ROOT', 0);

    const phaseHead = cols
      .map((col) => {
        if (col.type === 'phase') {
          const collapsed = phaseCollapsed.has(col.phase.id);
          return `<th class="gantt-phase-head" colspan="1" data-phase="${col.phase.id}" title="${utils.escapeHtml(col.label)}">
            <button type="button" class="phase-toggle" data-phase="${col.phase.id}">${collapsed ? '▶' : '▼'}</button>
            ${utils.escapeHtml(col.phase.id)}
          </th>`;
        }
        return `<th class="gantt-col-head" data-phase="${col.phase.id}">${utils.escapeHtml(col.label)}</th>`;
      })
      .join('');

    container.innerHTML = `
      <section class="module-page gantt-page">
        <header class="page-head">
          <div><h1>Gantt Chart</h1><p class="page-sub">Tree + phase columns (CSV-aligned Apr 16 – Jul 18). Toggle ▶ phases or task rows. Edit in <a href="#/wbs">WBS</a>.</p></div>
          <div class="gantt-toolbar">
            <button class="btn btn-sm" id="g-expand-rows">Expand rows</button>
            <button class="btn btn-sm" id="g-collapse-rows">Collapse rows</button>
            <button class="btn btn-sm" id="g-expand-phases">Expand all phases</button>
            <button class="btn btn-sm" id="g-collapse-phases">Collapse phases</button>
          </div>
        </header>
        <div class="gantt-grid-wrap card">
          <table class="gantt-grid">
            <thead>
              <tr><th class="gantt-row-label">WBS Task</th>${phaseHead}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="muted" style="font-size:0.8rem">P1 Planning · P2 System Development · P3 Testing &amp; Docs — dates from <code>Knowing Eye Gantt Chart - Sheet1.csv</code></p>
      </section>`;

    container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.toggle;
        if (rowCollapsed.has(id)) rowCollapsed.delete(id); else rowCollapsed.add(id);
        render();
      };
    });
    container.querySelectorAll('.phase-toggle').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.phase;
        if (phaseCollapsed.has(id)) phaseCollapsed.delete(id); else phaseCollapsed.add(id);
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
    container.querySelector('#g-collapse-phases').onclick = () => { PHASES.forEach((p) => phaseCollapsed.add(p.id)); render(); };
    container.querySelectorAll('.gantt-cell.on').forEach((cell) => {
      cell.onclick = () => { location.hash = '#/wbs'; };
    });
  }

  await render();
}

export function unmount(container) {
  container.innerHTML = '';
}
