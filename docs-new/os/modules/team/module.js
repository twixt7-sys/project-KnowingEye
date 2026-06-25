export const id = 'team';
export const label = 'Team';
export const icon = 'users';

const RACI_AREAS = [
  { key: 'planning', label: 'Planning' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'backend', label: 'Backend' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'ai', label: 'AI / CV' },
  { key: 'testing', label: 'Testing' },
  { key: 'docs', label: 'Docs' },
];

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const members = await store.getAll('team');
    members.sort((a, b) => (a.id < b.id ? -1 : 1));
    const info = await store.getTeamInfo();
    const tasks = await store.getAll('tasks');

    const cards = members
      .map((m) => {
        const open = tasks.filter((t) => t.assignee === m.name && t.status !== 'done').length;
        const total = tasks.filter((t) => t.assignee === m.name).length;
        return `<div class="card member-card" data-id="${m.id}" title="Click to edit" style="cursor:pointer">
          <div class="row" style="gap:0.7rem">
            <span class="member-avatar">${initials(m.name)}</span>
            <div><strong>${utils.escapeHtml(m.name)}</strong><div class="muted" style="font-size:0.82rem">${utils.escapeHtml(m.role)}</div></div>
          </div>
          <div class="focus-tags">${(m.focus || []).map((f) => `<span class="badge">${utils.escapeHtml(f)}</span>`).join('')}</div>
          ${m.email ? `<div class="muted" style="font-size:0.8rem">${utils.escapeHtml(m.email)}</div>` : ''}
          <div class="muted" style="font-size:0.82rem">${open} open · ${total} total tasks</div>
          <div class="progress"><span style="width:${total ? Math.round(((total - open) / total) * 100) : 0}%"></span></div>
        </div>`;
      })
      .join('');

    const raciRows = members
      .map(
        (m) =>
          `<tr><td>${utils.escapeHtml(m.name.split(' ')[0])}</td>${RACI_AREAS.map((a) => {
            const v = (m.raci || {})[a.key] || '';
            const cls = v === 'R' ? 'text-ok' : v === 'A' ? 'text-warn' : '';
            return `<td class="${cls}" style="text-align:center;font-weight:600">${v || '·'}</td>`;
          }).join('')}</tr>`
      )
      .join('');

    container.innerHTML = `
      <section class="module-page">
        <header class="page-head">
          <div><h1>Team</h1><p class="page-sub">Project organization, responsibilities, and workload. Everything here is editable.</p></div>
          <button class="btn-primary btn-sm" id="add-member">+ Add Member</button>
        </header>

        <div class="card">
          <div class="row between">
            <div class="card-title" style="margin:0">Project Adviser &amp; Team</div>
            <button class="btn btn-sm" id="edit-info">Edit adviser / team name</button>
          </div>
          <div class="row" style="gap:0.7rem;margin-top:0.6rem">
            <span class="member-avatar" style="background:linear-gradient(135deg,var(--accent2),var(--ai))">${initials(info.advisor?.name)}</span>
            <div>
              <strong>${utils.escapeHtml(info.advisor?.name || '—')}</strong>
              <div class="muted" style="font-size:0.82rem">${utils.escapeHtml(info.advisor?.title || 'Project Adviser')}</div>
            </div>
          </div>
          <p class="muted" style="font-size:0.82rem;margin:0.6rem 0 0">Team name: ${info.team_name ? utils.escapeHtml(info.team_name) : '<em>(not set)</em>'}</p>
        </div>

        <div class="grid grid-2">${cards || '<p class="muted">No members yet. Add one above.</p>'}</div>

        <div class="card">
          <div class="card-title">Responsibility Matrix (RACI-lite)</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Member</th>${RACI_AREAS.map((a) => `<th style="text-align:center">${a.label}</th>`).join('')}</tr></thead>
              <tbody>${raciRows}</tbody>
            </table>
          </div>
          <p class="muted" style="font-size:0.78rem;margin-top:0.5rem"><strong class="text-ok">R</strong> Responsible · <strong class="text-warn">A</strong> Accountable · <strong>C</strong> Consulted · <strong>I</strong> Informed</p>
        </div>
      </section>`;

    container.querySelector('#add-member').onclick = () => openMember();
    container.querySelector('#edit-info').onclick = () => openInfo(info);
    container.querySelectorAll('.member-card').forEach((el) => (el.onclick = () => openMember(el.dataset.id)));
  }

  async function openMember(memberId) {
    const m = memberId ? await store.get('team', memberId) : { id: utils.uid('TM'), focus: [], raci: {} };
    const isNew = !memberId;
    const dlg = modal(`${isNew ? 'Add' : 'Edit'} Member`, `
      <div class="field"><label>Name</label><input id="t-name" value="${utils.escapeHtml(m.name || '')}"></div>
      <div class="grid grid-2">
        <div class="field"><label>Role</label><input id="t-role" value="${utils.escapeHtml(m.role || '')}"></div>
        <div class="field"><label>Email</label><input id="t-email" value="${utils.escapeHtml(m.email || '')}"></div>
      </div>
      <div class="field"><label>Focus areas (comma separated)</label><input id="t-focus" value="${utils.escapeHtml((m.focus || []).join(', '))}"></div>
      <div class="field"><label>RACI (R/A/C/I per area)</label>
        <div class="grid grid-3">${RACI_AREAS.map((a) => `<div><label style="font-size:0.72rem">${a.label}</label><select id="raci-${a.key}">${['', 'R', 'A', 'C', 'I'].map((v) => `<option ${(m.raci || {})[a.key] === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')}</div>
      </div>`, isNew ? null : 'Delete');
    dlg.onSave = async () => {
      const updated = {
        ...m,
        name: val(dlg, '#t-name') || 'Unnamed',
        role: val(dlg, '#t-role'),
        email: val(dlg, '#t-email'),
        focus: val(dlg, '#t-focus').split(',').map((s) => s.trim()).filter(Boolean),
        raci: Object.fromEntries(RACI_AREAS.map((a) => [a.key, dlg.querySelector(`#raci-${a.key}`).value])),
      };
      await store.put('team', updated);
      await store.log(isNew ? 'Member added' : 'Member updated', updated.name);
      dlg.close();
      render();
    };
    dlg.onDelete = async () => { await store.delete('team', m.id); await store.log('Member removed', m.name); dlg.close(); render(); };
  }

  async function openInfo(info) {
    const dlg = modal('Edit Adviser / Team Name', `
      <div class="field"><label>Team name (leave blank if none)</label><input id="i-team" value="${utils.escapeHtml(info.team_name || '')}"></div>
      <div class="grid grid-2">
        <div class="field"><label>Adviser name</label><input id="i-adv" value="${utils.escapeHtml(info.advisor?.name || '')}"></div>
        <div class="field"><label>Adviser title</label><input id="i-advtitle" value="${utils.escapeHtml(info.advisor?.title || 'Project Adviser')}"></div>
      </div>`);
    dlg.onSave = async () => {
      await store.saveTeamInfo({
        team_name: val(dlg, '#i-team'),
        advisor: { name: val(dlg, '#i-adv'), title: val(dlg, '#i-advtitle') },
      });
      await store.log('Team info updated');
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
