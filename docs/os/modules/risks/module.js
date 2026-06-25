export const id = 'risks';
export const label = 'Risks & Issues';
export const icon = 'alert';

function scoreColor(score) {
  if (score >= 15) return '#f87171';
  if (score >= 9) return '#fbbf24';
  if (score >= 4) return '#fcd34d';
  return '#34d399';
}

export async function mount(container, ctx) {
  const { store, utils } = ctx;

  async function render() {
    const risks = await store.getAll('risks');
    const sorted = [...risks].sort((a, b) => b.probability * b.impact - a.probability * a.impact);

    // heat map cells: count risks per (probability, impact)
    const grid = {};
    for (const r of risks) grid[`${r.probability}-${r.impact}`] = (grid[`${r.probability}-${r.impact}`] || 0) + 1;
    let heat = '<table class="heatmap"><tbody>';
    for (let p = 5; p >= 1; p--) {
      heat += '<tr>';
      heat += `<td style="background:transparent;color:var(--muted)">P${p}</td>`;
      for (let i = 1; i <= 5; i++) {
        const score = p * i;
        const count = grid[`${p}-${i}`] || 0;
        heat += `<td style="background:${scoreColor(score)};opacity:${count ? 1 : 0.25}" title="Probability ${p} × Impact ${i} = ${score}">${count || ''}</td>`;
      }
      heat += '</tr>';
    }
    heat += '<tr><td style="background:transparent"></td>' + [1, 2, 3, 4, 5].map((i) => `<td style="background:transparent;color:var(--muted)">I${i}</td>`).join('') + '</tr>';
    heat += '</tbody></table>';

    const rows = sorted
      .map((r) => {
        const score = r.probability * r.impact;
        return `<tr data-id="${r.id}" style="cursor:pointer">
          <td class="mono">${r.id}</td>
          <td><strong>${utils.escapeHtml(r.title)}</strong><div class="muted" style="font-size:0.8rem">${utils.escapeHtml(r.mitigation || '')}</div></td>
          <td>${utils.escapeHtml(r.category)}</td>
          <td style="text-align:center">${r.probability}×${r.impact}</td>
          <td style="text-align:center"><span class="badge" style="background:${scoreColor(score)};color:#0a0e17;border:none">${score}</span></td>
          <td><span class="badge status-${r.status}">${r.status}</span></td>
          <td>${utils.escapeHtml((r.owner || '').split(' ')[0])}</td>
        </tr>`;
      })
      .join('');

    container.innerHTML = `
      <section class="module-page">
        <header class="page-head">
          <div><h1>Risks &amp; Issues</h1><p class="page-sub">Risk register with automatic score (probability × impact). Click a row to edit.</p></div>
          <button class="btn-primary btn-sm" id="add-risk">+ New Risk</button>
        </header>
        <div class="grid grid-2">
          <div class="card">
            <div class="card-title">Risk Heat Map</div>
            ${heat}
            <p class="muted" style="font-size:0.78rem;margin-top:0.5rem">Rows = probability (1–5), columns = impact (1–5). Number = risks in that cell.</p>
          </div>
          <div class="card">
            <div class="card-title">Summary</div>
            <div class="grid grid-2">
              <div class="stat"><span class="stat-value text-danger">${risks.filter((r) => r.probability * r.impact >= 15).length}</span><span class="stat-label">Critical</span></div>
              <div class="stat"><span class="stat-value text-warn">${risks.filter((r) => { const s = r.probability * r.impact; return s >= 9 && s < 15; }).length}</span><span class="stat-label">High</span></div>
              <div class="stat"><span class="stat-value">${risks.filter((r) => r.status === 'open').length}</span><span class="stat-label">Open</span></div>
              <div class="stat"><span class="stat-value text-ok">${risks.filter((r) => r.status === 'mitigating' || r.status === 'closed').length}</span><span class="stat-label">Mitigating/Closed</span></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Risk Register</div>
          <div class="table-wrap">
            <table><thead><tr><th>ID</th><th>Risk &amp; Mitigation</th><th>Category</th><th>P×I</th><th>Score</th><th>Status</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table>
          </div>
        </div>
      </section>`;

    container.querySelector('#add-risk').onclick = () => openForm();
    container.querySelectorAll('tbody tr[data-id]').forEach((tr) => (tr.onclick = () => openForm(tr.dataset.id)));
  }

  async function openForm(riskId) {
    const risk = riskId ? await store.get('risks', riskId) : { id: utils.uid('RISK'), probability: 3, impact: 3, status: 'open', category: 'Technical' };
    const isNew = !riskId;
    const dlg = document.createElement('div');
    dlg.className = 'modal-overlay';
    dlg.innerHTML = `
      <div class="modal card">
        <div class="row between"><h2 style="margin:0">${isNew ? 'New Risk' : 'Edit Risk'}</h2><button class="btn-icon" id="r-close">✕</button></div>
        <div class="field"><label>Title</label><input id="r-title" value="${utils.escapeHtml(risk.title || '')}"></div>
        <div class="field"><label>Mitigation</label><textarea id="r-mit" rows="2">${utils.escapeHtml(risk.mitigation || '')}</textarea></div>
        <div class="grid grid-3">
          <div class="field"><label>Category</label><input id="r-cat" value="${utils.escapeHtml(risk.category || '')}"></div>
          <div class="field"><label>Probability (1-5)</label><input id="r-prob" type="number" min="1" max="5" value="${risk.probability}"></div>
          <div class="field"><label>Impact (1-5)</label><input id="r-imp" type="number" min="1" max="5" value="${risk.impact}"></div>
          <div class="field"><label>Owner</label><input id="r-owner" value="${utils.escapeHtml(risk.owner || '')}"></div>
          <div class="field"><label>Status</label><select id="r-status">${['open', 'mitigating', 'closed'].map((s) => `<option ${risk.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        </div>
        <div class="row between">
          ${isNew ? '<span></span>' : '<button class="btn-danger btn-sm" id="r-delete">Delete</button>'}
          <div class="row"><button class="btn btn-sm" id="r-cancel">Cancel</button><button class="btn-primary btn-sm" id="r-save">Save</button></div>
        </div>
      </div>`;
    container.append(dlg);
    const close = () => dlg.remove();
    dlg.querySelector('#r-close').onclick = close;
    dlg.querySelector('#r-cancel').onclick = close;
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    const del = dlg.querySelector('#r-delete');
    if (del) del.onclick = async () => { await store.delete('risks', risk.id); await store.log('Risk deleted', risk.id); close(); render(); };
    dlg.querySelector('#r-save').onclick = async () => {
      const updated = {
        ...risk,
        title: dlg.querySelector('#r-title').value.trim() || 'Untitled risk',
        mitigation: dlg.querySelector('#r-mit').value.trim(),
        category: dlg.querySelector('#r-cat').value.trim() || 'General',
        probability: utils.clamp(+dlg.querySelector('#r-prob').value || 1, 1, 5),
        impact: utils.clamp(+dlg.querySelector('#r-imp').value || 1, 1, 5),
        owner: dlg.querySelector('#r-owner').value.trim(),
        status: dlg.querySelector('#r-status').value,
      };
      await store.put('risks', updated);
      await store.log(isNew ? 'Risk created' : 'Risk updated', updated.id);
      close();
      render();
    };
  }

  await render();
}

export function unmount(container) {
  container.innerHTML = '';
}
