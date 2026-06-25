import { SvgGantt } from '../../assets/charts/svg-gantt.js';

export const id = 'gantt';
export const label = 'Gantt Chart';
export const icon = 'timeline';

let chart = null;

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function draw() {
    const tasks = await store.getAll('gantt_tasks');
    const seed = await store.getSeed('gantt.json').catch(() => ({ config: {} }));
    const config = seed.config || {};
    const host = container.querySelector('#gantt-host');
    chart = new SvgGantt({
      tasks: tasks.length ? tasks : seed.tasks || [],
      config,
      onTaskChange: async (task) => {
        await store.put('gantt_tasks', task);
        await store.log('Gantt task rescheduled', `${task.id} ${task.start}→${task.end}`);
      },
    });
    chart.render(host);
    host.addEventListener('dblclick', (e) => {
      const bar = e.target.closest('[data-id]');
      if (bar) openForm(bar.dataset.id);
    });
  }

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head">
        <div><h1>Gantt Chart</h1><p class="page-sub">Drag bars to reschedule, drag edges to resize, double-click a bar to edit. Diamonds are milestones.</p></div>
        <div class="gantt-toolbar">
          <span class="muted" style="font-size:0.8rem">Zoom</span>
          <button class="btn btn-sm" data-zoom="week">Week</button>
          <button class="btn btn-sm" data-zoom="month">Month</button>
          <button class="btn btn-sm" data-zoom="quarter">Quarter</button>
          <button class="btn btn-sm" id="g-add">+ Task</button>
          <button class="btn-primary btn-sm" id="g-export">Export SVG</button>
        </div>
      </header>
      <div class="gantt-scroll" id="gantt-host"></div>
      <p class="muted" style="font-size:0.8rem">Bars colored by status: <span class="text-ok">done</span>, <span style="color:var(--accent)">in progress</span>, <span class="muted">pending</span>.</p>
    </section>`;

  await draw();

  container.querySelectorAll('[data-zoom]').forEach((b) => (b.onclick = () => chart.setZoom(b.dataset.zoom)));
  container.querySelector('#g-add').onclick = () => openForm();
  container.querySelector('#g-export').onclick = () => {
    utils.downloadBlob('gantt-chart.svg', chart.exportSvg(), 'image/svg+xml');
    utils.toast('Gantt exported as SVG', 'ok');
  };

  async function openForm(taskId) {
    const today = new Date().toISOString().slice(0, 10);
    const t = taskId ? await store.get('gantt_tasks', taskId) : { id: utils.uid('GNT'), start: today, end: today, progress: 0, milestone: false, dependencies: [] };
    const isNew = !taskId;
    const all = await store.getAll('gantt_tasks');
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.innerHTML = `<div class="modal card">
      <div class="row between"><h2 style="margin:0">${isNew ? 'New' : 'Edit'} Gantt Task</h2><button class="btn-icon" data-x>✕</button></div>
      <div class="field"><label>Title</label><input id="g-title" value="${utils.escapeHtml(t.title || '')}"></div>
      <div class="grid grid-2">
        <div class="field"><label>Start</label><input id="g-start" type="date" value="${(t.start || '').slice(0, 10)}"></div>
        <div class="field"><label>End</label><input id="g-end" type="date" value="${(t.end || '').slice(0, 10)}"></div>
        <div class="field"><label>Assignee</label><input id="g-assignee" value="${utils.escapeHtml(t.assignee || '')}"></div>
        <div class="field"><label>Progress %</label><input id="g-prog" type="number" min="0" max="100" value="${Math.round((t.progress || 0) * 100)}"></div>
        <div class="field"><label>Status</label><select id="g-status">${['todo', 'in_progress', 'done'].map((s) => `<option ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>WBS ref</label><input id="g-wbs" value="${utils.escapeHtml(t.wbs_ref || '')}"></div>
      </div>
      <div class="field"><label><input type="checkbox" id="g-ms" ${t.milestone ? 'checked' : ''} style="width:auto;margin-right:0.4rem">Milestone (diamond marker)</label></div>
      <div class="field"><label>Dependencies</label><select id="g-deps" multiple size="3">${all.filter((x) => x.id !== t.id).map((x) => `<option value="${x.id}" ${(t.dependencies || []).includes(x.id) ? 'selected' : ''}>${utils.escapeHtml(x.title || x.id)}</option>`).join('')}</select></div>
      <div class="row between">
        ${isNew ? '<span></span>' : '<button class="btn-danger btn-sm" data-del>Delete</button>'}
        <div class="row"><button class="btn btn-sm" data-cancel>Cancel</button><button class="btn-primary btn-sm" data-save>Save</button></div>
      </div></div>`;
    container.append(dlg);
    const close = () => dlg.remove();
    dlg.querySelector('[data-x]').onclick = close;
    dlg.querySelector('[data-cancel]').onclick = close;
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    const del = dlg.querySelector('[data-del]');
    if (del) del.onclick = async () => { await store.delete('gantt_tasks', t.id); await store.log('Gantt task deleted', t.id); close(); chart.destroy(); await draw(); };
    dlg.querySelector('[data-save]').onclick = async () => {
      const deps = [...dlg.querySelector('#g-deps').selectedOptions].map((o) => o.value);
      const updated = {
        ...t,
        title: dlg.querySelector('#g-title').value.trim() || 'Untitled',
        start: dlg.querySelector('#g-start').value || today,
        end: dlg.querySelector('#g-end').value || today,
        assignee: dlg.querySelector('#g-assignee').value.trim(),
        progress: utils.clamp((+dlg.querySelector('#g-prog').value || 0) / 100, 0, 1),
        status: dlg.querySelector('#g-status').value,
        wbs_ref: dlg.querySelector('#g-wbs').value.trim(),
        milestone: dlg.querySelector('#g-ms').checked,
        dependencies: deps,
      };
      await store.put('gantt_tasks', updated);
      await store.log(isNew ? 'Gantt task created' : 'Gantt task updated', updated.title);
      close();
      chart.destroy();
      await draw();
    };
  }
}

export function unmount(container) {
  chart?.destroy();
  chart = null;
  container.innerHTML = '';
}
