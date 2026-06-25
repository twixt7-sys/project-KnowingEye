export const id = 'reports';
export const label = 'Reports';
export const icon = 'file-text';

export async function mount(container, ctx) {
  const { store, utils, config } = ctx;
  const [tasks, milestones, risks, wbs] = await Promise.all([
    store.getAll('tasks'),
    store.getAll('milestones'),
    store.getAll('risks'),
    store.getAll('wbs_nodes'),
  ]);
  const project = await store.getProjectInfo().catch(() => ({}));

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head"><div><h1>Reports</h1><p class="page-sub">Generate a status snapshot and export project data.</p></div></header>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Status Report</div>
          <p class="muted">Open a print-friendly status snapshot in a new window.</p>
          <button class="btn-primary btn-sm" id="r-status">Generate Status Report</button>
        </div>
        <div class="card">
          <div class="card-title">Exports</div>
          <div class="grid" style="gap:0.5rem">
            <button class="btn btn-sm" id="r-json">Export Project Summary (JSON)</button>
            <button class="btn btn-sm" id="r-tasks-csv">Export Tasks (CSV)</button>
            <button class="btn btn-sm" id="r-risks-csv">Export Risks (CSV)</button>
            <button class="btn btn-sm" id="r-wbs">Export WBS Outline (TXT)</button>
          </div>
        </div>
      </div>
    </section>`;

  const summary = () => ({
    project: project.title || config.project?.title,
    generated_at: new Date().toISOString(),
    tasks: { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length },
    milestones: { total: milestones.length, completed: milestones.filter((m) => m.status === 'completed').length },
    risks: { total: risks.length, critical: risks.filter((r) => r.probability * r.impact >= 15).length },
  });

  container.querySelector('#r-json').onclick = () => {
    utils.downloadBlob('project-summary.json', JSON.stringify(summary(), null, 2));
    utils.toast('Project summary exported', 'ok');
  };
  container.querySelector('#r-tasks-csv').onclick = () => {
    utils.downloadBlob('tasks.csv', utils.toCsv(tasks, ['id', 'title', 'assignee', 'priority', 'status', 'due_date', 'wbs_ref']), 'text/csv');
  };
  container.querySelector('#r-risks-csv').onclick = () => {
    utils.downloadBlob('risks.csv', utils.toCsv(risks.map((r) => ({ ...r, score: r.probability * r.impact })), ['id', 'title', 'category', 'probability', 'impact', 'score', 'status', 'owner']), 'text/csv');
  };
  container.querySelector('#r-wbs').onclick = () => {
    const byParent = new Map();
    for (const n of wbs) { const p = n.parent_id || 'ROOT'; (byParent.get(p) || byParent.set(p, []).get(p)).push(n); }
    for (const l of byParent.values()) l.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    let out = '';
    (function walk(k, d) { for (const n of byParent.get(k) || []) { out += `${'  '.repeat(d)}${n.code} ${n.title} [${n.status}]\n`; walk(n.id, d + 1); } })('ROOT', 0);
    utils.downloadBlob('wbs-outline.txt', out, 'text/plain');
  };

  container.querySelector('#r-status').onclick = () => {
    const s = summary();
    const win = window.open('', '_blank');
    const taskRows = tasks.map((t) => `<tr><td>${t.id}</td><td>${utils.escapeHtml(t.title)}</td><td>${t.status}</td><td>${utils.escapeHtml(t.assignee || '')}</td></tr>`).join('');
    const msRows = milestones.map((m) => `<tr><td>${utils.escapeHtml(m.title)}</td><td>${m.date}</td><td>${m.status}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Status Report - ${utils.escapeHtml(s.project)}</title>
      <style>body{font-family:system-ui,sans-serif;margin:2rem;color:#111;max-width:900px}h1{margin-bottom:0}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}.stats{display:flex;gap:1.5rem;margin:1rem 0}.stat{border:1px solid #ddd;border-radius:8px;padding:.6rem 1rem}@media print{button{display:none}}</style>
      </head><body>
      <h1>${utils.escapeHtml(s.project)} - Status Report</h1>
      <p style="color:#666">Generated ${new Date().toLocaleString()}</p>
      <div class="stats">
        <div class="stat"><strong>${s.tasks.done}/${s.tasks.total}</strong><br>Tasks done</div>
        <div class="stat"><strong>${s.milestones.completed}/${s.milestones.total}</strong><br>Milestones</div>
        <div class="stat"><strong>${s.risks.critical}</strong><br>Critical risks</div>
      </div>
      <h2>Milestones</h2><table><thead><tr><th>Milestone</th><th>Date</th><th>Status</th></tr></thead><tbody>${msRows}</tbody></table>
      <h2>Tasks</h2><table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Assignee</th></tr></thead><tbody>${taskRows}</tbody></table>
      <button onclick="window.print()">Print</button>
      </body></html>`);
    win.document.close();
  };
}

export function unmount(container) {
  container.innerHTML = '';
}
