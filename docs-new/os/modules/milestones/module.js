export const id = 'milestones';
export const label = 'Milestones';
export const icon = 'flag';

const STATUSES = ['upcoming', 'at_risk', 'completed', 'missed'];

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const milestones = (await store.getAll('milestones')).sort((a, b) => (a.date < b.date ? -1 : 1));

    const rows = milestones
      .map((m) => {
        const days = utils.daysFromToday(m.date);
        const overdue = m.status !== 'completed' && days < 0;
        const status = overdue ? 'missed' : m.status;
        const countdown = m.status === 'completed' ? 'Done' : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`;
        return `<div class="card" data-id="${m.id}" style="border-left:3px solid var(--${m.category === 'institutional' ? 'accent2' : 'accent'});cursor:pointer" title="Click to edit">
          <div class="row between">
            <div>
              <strong>${utils.escapeHtml(m.title)}</strong>
              <span class="badge" style="margin-left:0.5rem">${m.category}</span>
              <div class="muted" style="font-size:0.85rem;margin-top:0.2rem">${utils.escapeHtml(m.description || '')}</div>
            </div>
            <div style="text-align:right;min-width:120px">
              <div>${utils.fmtDate(m.date)}</div>
              <span class="badge status-${status}">${(status || '').replace('_', ' ')}</span>
              <div class="muted ${overdue ? 'text-danger' : ''}" style="font-size:0.8rem;margin-top:0.2rem">${countdown}</div>
            </div>
          </div>
        </div>`;
      })
      .join('');

    const inst = milestones.filter((m) => m.category === 'institutional').length;
    const tech = milestones.filter((m) => m.category === 'technical').length;

    container.innerHTML = `
      <section class="module-page">
        <header class="page-head">
          <div><h1>Milestones</h1><p class="page-sub">${inst} institutional · ${tech} technical. Click a card to edit.</p></div>
          <button class="btn-primary btn-sm" id="add-ms">+ New Milestone</button>
        </header>
        <div class="grid" style="gap:0.7rem">${rows || '<p class="muted">No milestones yet.</p>'}</div>
      </section>`;

    container.querySelector('#add-ms').onclick = () => openForm();
    container.querySelectorAll('[data-id]').forEach((el) => (el.onclick = () => openForm(el.dataset.id)));
  }

  async function openForm(msId) {
    const m = msId ? await store.get('milestones', msId) : { id: utils.uid('MS'), category: 'technical', status: 'upcoming', date: new Date().toISOString().slice(0, 10) };
    const isNew = !msId;
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.innerHTML = `<div class="modal card">
      <div class="row between"><h2 style="margin:0">${isNew ? 'New' : 'Edit'} Milestone</h2><button class="btn-icon" data-x>✕</button></div>
      <div class="field"><label>Title</label><input id="m-title" value="${utils.escapeHtml(m.title || '')}"></div>
      <div class="field"><label>Description</label><textarea id="m-desc" rows="2">${utils.escapeHtml(m.description || '')}</textarea></div>
      <div class="grid grid-3">
        <div class="field"><label>Date</label><input id="m-date" type="date" value="${m.date || ''}"></div>
        <div class="field"><label>Category</label><select id="m-cat">${['institutional', 'technical'].map((c) => `<option ${m.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Status</label><select id="m-status">${STATUSES.map((s) => `<option ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
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
    if (del) del.onclick = async () => { await store.delete('milestones', m.id); await store.log('Milestone deleted', m.title); close(); render(); };
    dlg.querySelector('[data-save]').onclick = async () => {
      const updated = {
        ...m,
        title: dlg.querySelector('#m-title').value.trim() || 'Untitled',
        description: dlg.querySelector('#m-desc').value.trim(),
        date: dlg.querySelector('#m-date').value,
        category: dlg.querySelector('#m-cat').value,
        status: dlg.querySelector('#m-status').value,
      };
      await store.put('milestones', updated);
      await store.log(isNew ? 'Milestone created' : 'Milestone updated', updated.title);
      close();
      render();
    };
  }

  await render();
}

export function unmount(container) {
  container.innerHTML = '';
}
