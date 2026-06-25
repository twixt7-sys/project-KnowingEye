import { gauge } from '../../assets/charts/svg-charts.js';
import { finishLine } from '../../assets/charts/finish-line.js';
import { orgChartHtml } from '../../assets/template-images.js';
import { buildWbsMaps, rollupProgress } from '../../core/schedule.js';

export const id = 'dashboard';
export const label = 'Dashboard';
export const icon = 'grid';

export async function mount(container, ctx) {
  const { store, utils, config } = ctx;
  const [milestones, wbs, members] = await Promise.all([
    store.getAll('milestones'),
    store.getAll('wbs_nodes'),
    store.getAll('team'),
  ]);
  const teamInfo = await store.getTeamInfo().catch(() => ({}));
  const project = await store.getProjectInfo().catch(() => ({}));
  const { byParent } = buildWbsMaps(wbs);

  const roots = (byParent.get('ROOT') || []);
  const wbsProgress = roots.length
    ? roots.reduce((s, n) => s + rollupProgress(n, byParent), 0) / roots.length
    : 0;

  const upcoming = milestones
    .filter((m) => m.status !== 'completed')
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const countdown = upcoming ? utils.daysFromToday(upcoming.date) : null;
  const msDone = milestones.filter((m) => m.status === 'completed').length;

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p class="page-sub">${utils.escapeHtml(project.full_title || config.project?.full_title || '')}</p>
        </div>
      </header>

      <div class="grid grid-3">
        <div class="card" style="align-items:center;text-align:center">
          <div class="card-title">WBS Progress</div>
          ${gauge(wbsProgress, { label: 'overall' })}
        </div>
        <div class="stat"><span class="stat-value">${countdown == null ? '-' : countdown}</span><span class="stat-label">Days to next milestone</span><span class="stat-sub">${upcoming ? utils.escapeHtml(upcoming.title) : '-'}</span></div>
        <div class="stat"><span class="stat-value">${msDone}/${milestones.length}</span><span class="stat-label">Milestones cleared</span><span class="stat-sub">${wbs.length} WBS tasks</span></div>
      </div>

      <div class="card">
        <div class="card-title">Capstone finish line</div>
        ${finishLine(milestones, { start: project.dates?.started || '2026-04-16', end: project.dates?.target || '2026-07-04', uid: 'dash' })}
      </div>

      <div class="card">
        <div class="card-title">Project organization</div>
        <p class="muted" style="font-size:0.82rem;margin:0 0 0.75rem">Photo templates: <code>os/assets/people/adviser.png</code>, <code>tm-1.png</code> … <code>tm-4.png</code></p>
        ${orgChartHtml(teamInfo.advisor, members, utils.escapeHtml)}
      </div>
    </section>`;
}

export function unmount(container) {
  container.innerHTML = '';
}
