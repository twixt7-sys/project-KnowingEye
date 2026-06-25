import { barChart, gauge, donutChart, legend } from '../../assets/charts/svg-charts.js';

export const id = 'dashboard';
export const label = 'Dashboard';
export const icon = 'grid';

export async function mount(container, ctx) {
  const { store, utils, config, router } = ctx;
  const [tasks, milestones, risks, wbs, members] = await Promise.all([
    store.getAll('tasks'),
    store.getAll('milestones'),
    store.getAll('risks'),
    store.getAll('wbs_nodes'),
    store.getAll('team'),
  ]);
  const project = await store.getProjectInfo().catch(() => ({}));
  const team = { members };

  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => ['in_progress', 'review'].includes(t.status)).length;
  const todo = tasks.length - done - inProgress;

  // health score: weighted tasks-done, milestones-on-track, low open-risk
  const taskScore = tasks.length ? done / tasks.length : 0;
  const msDone = milestones.filter((m) => m.status === 'completed').length;
  const msScore = milestones.length ? msDone / milestones.length : 0;
  const openHigh = risks.filter((r) => r.status === 'open' && r.probability * r.impact >= 12).length;
  const riskScore = Math.max(0, 1 - openHigh / Math.max(1, risks.length));
  const health = taskScore * 0.45 + msScore * 0.35 + riskScore * 0.2;

  // next milestone countdown
  const upcoming = milestones
    .filter((m) => m.status !== 'completed')
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const countdown = upcoming ? utils.daysFromToday(upcoming.date) : null;

  // workload per member
  const workload = (team.members || []).map((m) => ({
    label: m.name.split(' ')[0],
    value: tasks.filter((t) => t.assignee === m.name && t.status !== 'done').length,
  }));

  const impl = project.implementation_status || {};
  const implRows = Object.entries(impl)
    .map(
      ([k, v]) =>
        `<div class="field" style="margin:0"><div class="row between"><span style="text-transform:capitalize">${k.replace('_', ' ')}</span><span class="muted">${utils.pct(v.completion)} · ${v.status}</span></div><div class="progress"><span style="width:${utils.pct(v.completion)}"></span></div></div>`
    )
    .join('');

  const activity = await store.recentActivity(6);

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p class="page-sub">${utils.escapeHtml(project.full_title || config.project?.full_title || '')}</p>
        </div>
      </header>

      <div class="grid grid-4">
        <div class="card" style="align-items:center;text-align:center">
          <div class="card-title">Project Health</div>
          ${gauge(health, { label: 'health' })}
        </div>
        <div class="stat"><span class="stat-value">${countdown == null ? '—' : countdown}</span><span class="stat-label">Days to next milestone</span><span class="stat-sub">${upcoming ? utils.escapeHtml(upcoming.title) : ''}</span></div>
        <div class="stat"><span class="stat-value">${done}/${tasks.length}</span><span class="stat-label">Tasks done</span><span class="stat-sub">${inProgress} in progress · ${todo} pending</span></div>
        <div class="stat"><span class="stat-value">${risks.filter((r) => r.status !== 'closed').length}</span><span class="stat-label">Active risks</span><span class="stat-sub text-warn">${openHigh} high severity</span></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Team Workload (open tasks)</div>
          ${workload.length ? barChart(workload, { height: 200, color: 'var(--accent)' }) : '<p class="muted">No team data</p>'}
        </div>
        <div class="card">
          <div class="card-title">Task Status</div>
          <div class="row" style="gap:1.5rem;align-items:center">
            ${donutChart([
              { label: 'Done', value: done, color: '#34d399' },
              { label: 'In progress', value: inProgress, color: '#5b8def' },
              { label: 'Pending', value: todo, color: '#8b95a8' },
            ])}
            ${legend([
              { label: 'Done', color: '#34d399' },
              { label: 'In progress', color: '#5b8def' },
              { label: 'Pending', color: '#8b95a8' },
            ])}
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Implementation Status</div>
          <div class="grid" style="gap:0.75rem">${implRows || '<p class="muted">No status data</p>'}</div>
        </div>
        <div class="card">
          <div class="card-title">Recent Activity</div>
          ${activity.length ? `<ul style="margin:0;padding-left:1.1rem;font-size:0.88rem">${activity.map((a) => `<li><span class="muted">${utils.fmtDate(a.ts, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span> — ${utils.escapeHtml(a.action)} ${utils.escapeHtml(a.detail || '')}</li>`).join('')}</ul>` : '<p class="muted">No recorded activity yet. Edits in Tasks, WBS, Risks, and Gantt appear here.</p>'}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Quick Links</div>
        <div class="row" id="dash-links">
          ${(project.quick_links || []).map((l) => `<a class="btn btn-sm" href="${utils.escapeHtml(l.href)}" ${l.href.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${utils.escapeHtml(l.label)}</a>`).join('')}
          <a class="btn btn-sm" href="#/gantt">Open Gantt</a>
          <a class="btn btn-sm" href="#/wbs">Open WBS</a>
        </div>
      </div>
    </section>`;
}

export function unmount(container) {
  container.innerHTML = '';
}
