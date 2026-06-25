import { orgChartHtml, personAvatar } from '../../assets/template-images.js';

export const id = 'team';
export const label = 'Team';
export const icon = 'users';

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const members = await store.getAll('team');
    members.sort((a, b) => (a.id < b.id ? -1 : 1));
    const info = await store.getTeamInfo();

    const cards = members
      .map((m) => `<div class="card member-card" data-id="${m.id}" title="Click to edit" style="cursor:pointer">
          <div class="row" style="gap:0.7rem">
            ${personAvatar(m.id, m.name)}
            <div><strong>${utils.escapeHtml(m.name)}</strong><div class="muted" style="font-size:0.82rem">${utils.escapeHtml(m.role)}</div></div>
          </div>
          <div class="focus-tags">${(m.focus || []).map((f) => `<span class="badge">${utils.escapeHtml(f)}</span>`).join('')}</div>
          ${m.email ? `<div class="muted" style="font-size:0.8rem">${utils.escapeHtml(m.email)}</div>` : ''}
        </div>`)
      .join('');

    container.innerHTML = `
      <section class="module-page">
        <header class="page-head">
          <div><h1>Team</h1><p class="page-sub">Photos: <code>os/assets/people/tm-1.png</code> … <code>tm-4.png</code>, <code>adviser.png</code></p></div>
          <button class="btn-primary btn-sm" id="add-member">+ Add Member</button>
        </header>

        <div class="card">
          <div class="card-title">Organization chart</div>
          ${orgChartHtml(info.advisor, members, utils.escapeHtml)}
        </div>

        <div class="card">
          <div class="row between">
            <div class="card-title" style="margin:0">Edit adviser</div>
            <button class="btn btn-sm" id="edit-info">Edit</button>
          </div>
          <div class="row" style="gap:0.7rem;margin-top:0.6rem">
            ${personAvatar('adviser', info.advisor?.name)}
            <div>
              <strong>${utils.escapeHtml(info.advisor?.name || '—')}</strong>
              <div class="muted" style="font-size:0.82rem">${utils.escapeHtml(info.advisor?.title || 'Project Adviser')}</div>
            </div>
          </div>
        </div>

        <div class="grid grid-2">${cards || '<p class="muted">No members yet.</p>'}</div>
      </section>`;

    container.querySelector('#add-member').onclick = () => openMember();
    container.querySelector('#edit-info').onclick = () => openInfo(info);
    container.querySelectorAll('.member-card').forEach((el) => (el.onclick = () => openMember(el.dataset.id)));
  }

  async function openMember(memberId) {
    const m = memberId ? await store.get('team', memberId) : { id: utils.uid('TM'), focus: [] };
    const isNew = !memberId;
    const dlg = modal(`${isNew ? 'Add' : 'Edit'} Member`, `
      <div class="field"><label>Name</label><input id="t-name" value="${utils.escapeHtml(m.name || '')}"></div>
      <div class="grid grid-2">
        <div class="field"><label>Role</label><input id="t-role" value="${utils.escapeHtml(m.role || '')}"></div>
        <div class="field"><label>Email</label><input id="t-email" value="${utils.escapeHtml(m.email || '')}"></div>
      </div>
      <div class="field"><label>Focus areas (comma separated)</label><input id="t-focus" value="${utils.escapeHtml((m.focus || []).join(', '))}"></div>`, isNew ? null : 'Delete');
    dlg.onSave = async () => {
      const updated = {
        ...m,
        name: val(dlg, '#t-name') || 'Unnamed',
        role: val(dlg, '#t-role'),
        email: val(dlg, '#t-email'),
        focus: val(dlg, '#t-focus').split(',').map((s) => s.trim()).filter(Boolean),
      };
      await store.put('team', updated);
      await store.log(isNew ? 'Member added' : 'Member updated', updated.name);
      dlg.close();
      render();
    };
    dlg.onDelete = async () => { await store.delete('team', m.id); dlg.close(); render(); };
  }

  async function openInfo(info) {
    const dlg = modal('Edit Adviser', `
      <div class="grid grid-2">
        <div class="field"><label>Adviser name</label><input id="i-adv" value="${utils.escapeHtml(info.advisor?.name || '')}"></div>
        <div class="field"><label>Adviser title</label><input id="i-advtitle" value="${utils.escapeHtml(info.advisor?.title || 'Project Adviser')}"></div>
      </div>`);
    dlg.onSave = async () => {
      await store.saveTeamInfo({
        advisor: { name: val(dlg, '#i-adv'), title: val(dlg, '#i-advtitle') },
      });
      dlg.close();
      render();
    };
  }

  function val(root, sel) { return root.querySelector(sel).value.trim(); }

  function modal(title, body, deleteLabel) {
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.innerHTML = `<div class="modal card">
      <div class="row between"><h2 style="margin:0">${title}</h2><button class="btn-icon" data-x>✕</button></div>
      ${body}
      <div class="row between">
        ${deleteLabel ? `<button class="btn-danger btn-sm" data-del>${deleteLabel}</button>` : '<span></span>'}
        <div class="row"><button class="btn btn-sm" data-cancel>Cancel</button><button class="btn-primary btn-sm" data-save>Save</button></div>
      </div></div>`;
    container.append(dlg);
    dlg.close = () => dlg.remove();
    dlg.querySelector('[data-x]').onclick = dlg.close;
    dlg.querySelector('[data-cancel]').onclick = dlg.close;
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('[data-save]').onclick = () => dlg.onSave?.();
    const del = dlg.querySelector('[data-del]');
    if (del) del.onclick = () => dlg.onDelete?.();
    return dlg;
  }

  await render();
}

export function unmount(container) {
  container.innerHTML = '';
}
