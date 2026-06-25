export const id = 'wbs';
export const label = 'WBS';
export const icon = 'tree';

const STATUSES = ['todo', 'in_progress', 'done'];
const collapsed = new Set();

function initCollapse(nodes, byParent) {
  if (collapsed.size) return;
  for (const n of nodes) {
    if ((byParent.get(n.id) || []).length) collapsed.add(n.id);
  }
  for (const n of nodes) {
    if (!n.parent_id) collapsed.delete(n.id);
  }
}

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const nodes = await store.getAll('wbs_nodes');
    const byParent = new Map();
    for (const n of nodes) {
      const p = n.parent_id || 'ROOT';
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(n);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    initCollapse(nodes, byParent);

    function rollup(node) {
      const children = byParent.get(node.id) || [];
      if (!children.length) return node.progress || 0;
      return children.reduce((s, c) => s + rollup(c), 0) / children.length;
    }

    let html = '';
    function walk(parentKey, depth) {
      const children = byParent.get(parentKey) || [];
      for (const n of children) {
        const kids = byParent.get(n.id) || [];
        const hasKids = kids.length > 0;
        const isOpen = !collapsed.has(n.id);
        const prog = hasKids ? rollup(n) : n.progress || 0;
        html += `<div class="wbs-node" data-id="${n.id}">
          <div class="wbs-row" style="padding-left:${depth * 18}px">
            <span class="wbs-toggle">
              ${hasKids ? `<span class="wbs-caret ${isOpen ? 'open' : ''}" data-toggle="${n.id}"></span>` : '<span style="width:9px;display:inline-block"></span>'}
              <span class="wbs-code">${utils.escapeHtml(n.code)}</span>
              <span class="wbs-edit" data-edit="${n.id}" style="cursor:pointer">${utils.escapeHtml(n.title)}</span>
            </span>
            <span class="wbs-dates muted" style="font-size:0.75rem">${n.start_date ? utils.escapeHtml(n.start_date.slice(0, 10)) : '—'} → ${n.end_date ? utils.escapeHtml(n.end_date.slice(0, 10)) : '—'}</span>
            <span class="wbs-owner muted" style="font-size:0.82rem">${utils.escapeHtml((n.owner || '').split(' ')[0] || '—')}</span>
            <span class="wbs-status"><span class="badge status-${n.status}">${(n.status || '').replace('_', ' ')}</span></span>
            <span><div class="progress" title="${utils.pct(prog)}"><span style="width:${utils.pct(prog)}"></span></div></span>
          </div>
        </div>`;
        if (hasKids && isOpen) walk(n.id, depth + 1);
      }
    }
    walk('ROOT', 0);

    const roots = byParent.get('ROOT') || [];
    const overall = roots.length ? roots.reduce((s, n) => s + rollup(n), 0) / roots.length : 0;

    container.innerHTML = `
      <section class="module-page">
        <header class="page-head">
          <div><h1>Work Breakdown Structure</h1><p class="page-sub">305 tasks from Gantt CSV · progress &amp; dates editable · Gantt derives from dates here. Overall: <strong>${utils.pct(overall)}</strong>.</p></div>
          <div class="row">
            <button class="btn btn-sm" id="w-expand">Expand all</button>
            <button class="btn btn-sm" id="w-collapse">Collapse all</button>
            <button class="btn btn-sm" id="w-export">Export outline</button>
            <button class="btn-primary btn-sm" id="w-add">+ Node</button>
          </div>
        </header>
        <div class="card" style="padding:0.5rem">
          <div class="wbs-row" style="font-weight:600;color:var(--muted)"><span>Code / Activity</span><span class="wbs-dates">Dates</span><span class="wbs-owner">Owner</span><span class="wbs-status">Status</span><span>Progress</span></div>
          <div class="wbs-tree">${html || '<p class="muted" style="padding:1rem">No WBS nodes yet.</p>'}</div>
        </div>
      </section>`;

    container.querySelectorAll('[data-toggle]').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const tid = el.dataset.toggle;
        if (collapsed.has(tid)) collapsed.delete(tid); else collapsed.add(tid);
        render();
      };
    });
    container.querySelectorAll('[data-edit]').forEach((el) => (el.onclick = () => openForm(el.dataset.edit)));
    container.querySelector('#w-expand').onclick = () => { collapsed.clear(); render(); };
    container.querySelector('#w-collapse').onclick = () => { nodes.forEach((n) => { if ((byParent.get(n.id) || []).length) collapsed.add(n.id); }); render(); };
    container.querySelector('#w-add').onclick = () => openForm();
    container.querySelector('#w-export').onclick = () => {
      let out = '';
      (function outline(key, depth) {
        for (const n of byParent.get(key) || []) { out += `${'  '.repeat(depth)}${n.code} ${n.title} [${n.status}]\n`; outline(n.id, depth + 1); }
      })('ROOT', 0);
      utils.downloadBlob('wbs-outline.txt', out, 'text/plain');
      utils.toast('WBS outline exported', 'ok');
    };
  }

  async function openForm(nodeId) {
    const nodes = await store.getAll('wbs_nodes');
    const n = nodeId ? await store.get('wbs_nodes', nodeId) : { id: utils.uid('WBS'), code: '', title: '', parent_id: null, level: 1, status: 'todo', progress: 0 };
    const isNew = !nodeId;
    const parentOptions = ['<option value="">— none (top level) —</option>']
      .concat(nodes.filter((x) => x.id !== n.id).map((x) => `<option value="${x.id}" ${n.parent_id === x.id ? 'selected' : ''}>${utils.escapeHtml(x.code)} ${utils.escapeHtml(x.title)}</option>`))
      .join('');
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.innerHTML = `<div class="modal card">
      <div class="row between"><h2 style="margin:0">${isNew ? 'New' : 'Edit'} WBS Node</h2><button class="btn-icon" data-x>✕</button></div>
      <div class="grid grid-2">
        <div class="field"><label>Code</label><input id="n-code" value="${utils.escapeHtml(n.code || '')}" placeholder="e.g. 2.1"></div>
        <div class="field"><label>Owner</label><input id="n-owner" value="${utils.escapeHtml(n.owner || '')}"></div>
      </div>
      <div class="field"><label>Title</label><input id="n-title" value="${utils.escapeHtml(n.title || '')}"></div>
      <div class="field"><label>Parent</label><select id="n-parent">${parentOptions}</select></div>
      <div class="field"><label>Deliverable</label><input id="n-deliv" value="${utils.escapeHtml(n.deliverable || '')}"></div>
      <div class="grid grid-3">
        <div class="field"><label>Status</label><select id="n-status">${STATUSES.map((s) => `<option ${n.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Progress %</label><input id="n-prog" type="number" min="0" max="100" value="${Math.round((n.progress || 0) * 100)}"></div>
        <div class="field"><label>Level</label><input id="n-level" type="number" min="1" max="6" value="${n.level || 1}"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Start date</label><input id="n-start" type="date" value="${(n.start_date || '').slice(0, 10)}"></div>
        <div class="field"><label>End date</label><input id="n-end" type="date" value="${(n.end_date || '').slice(0, 10)}"></div>
      </div>
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
    if (del) del.onclick = async () => {
      // reparent children to this node's parent to avoid orphans
      const children = (await store.getAll('wbs_nodes')).filter((x) => x.parent_id === n.id);
      for (const c of children) { c.parent_id = n.parent_id; await store.put('wbs_nodes', c); }
      await store.delete('wbs_nodes', n.id);
      await store.log('WBS node deleted', n.code);
      close();
      render();
    };
    dlg.querySelector('[data-save]').onclick = async () => {
      const parent = dlg.querySelector('#n-parent').value || null;
      const updated = {
        ...n,
        code: dlg.querySelector('#n-code').value.trim() || '0',
        title: dlg.querySelector('#n-title').value.trim() || 'Untitled',
        owner: dlg.querySelector('#n-owner').value.trim(),
        deliverable: dlg.querySelector('#n-deliv').value.trim(),
        parent_id: parent,
        status: dlg.querySelector('#n-status').value,
        progress: utils.clamp((+dlg.querySelector('#n-prog').value || 0) / 100, 0, 1),
        level: utils.clamp(+dlg.querySelector('#n-level').value || 1, 1, 6),
        start_date: dlg.querySelector('#n-start').value || null,
        end_date: dlg.querySelector('#n-end').value || null,
      };
      await store.put('wbs_nodes', updated);
      await store.log(isNew ? 'WBS node created' : 'WBS node updated', updated.code);
      close();
      render();
    };
  }

  await render();
}

export function unmount(container) {
  container.innerHTML = '';
}
