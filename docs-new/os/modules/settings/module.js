import { setTheme, currentTheme } from '../../assets/theme.js';

export const id = 'settings';
export const label = 'Settings';
export const icon = 'gear';

export async function mount(container, ctx) {
  const { store, utils, config } = ctx;
  const seedVersion = store.getPref('seed_version', String(store.seedVersion));
  const project = await store.getProjectInfo().catch(() => ({}));
  const teamInfo = await store.getTeamInfo().catch(() => ({ advisor: {} }));

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head"><div><h1>Settings</h1><p class="page-sub">Project info, theme, data management, and deployment info.</p></div></header>

      <div class="card">
        <div class="row between"><div class="card-title" style="margin:0">Project Info (editable)</div><button class="btn-primary btn-sm" id="p-save">Save project info</button></div>
        <div class="grid grid-2" style="margin-top:0.6rem">
          <div class="field"><label>Project title</label><input id="p-title" value="${utils.escapeHtml(project.title || '')}"></div>
          <div class="field"><label>Subject</label><input id="p-subject" value="${utils.escapeHtml(project.subject || '')}"></div>
          <div class="field"><label>Team name (blank if none)</label><input id="p-team" value="${utils.escapeHtml(teamInfo.team_name || '')}"></div>
          <div class="field"><label>Adviser</label><input id="p-adviser" value="${utils.escapeHtml(teamInfo.advisor?.name || '')}"></div>
          <div class="field"><label>Start date</label><input id="p-start" type="date" value="${(project.dates?.started || '').slice(0, 10)}"></div>
          <div class="field"><label>Target date</label><input id="p-target" type="date" value="${(project.dates?.target || '').slice(0, 10)}"></div>
        </div>
        <div class="field"><label>Full title</label><input id="p-full" value="${utils.escapeHtml(project.full_title || '')}"></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Appearance</div>
          <div class="row between">
            <span>Theme</span>
            <button class="btn btn-sm" id="s-theme">${currentTheme() === 'dark' ? '🌙 Dark' : '☀️ Light'}</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Data</div>
          <p class="muted" style="font-size:0.85rem">Seed version: <code>${utils.escapeHtml(seedVersion)}</code> · DB: <code>${utils.escapeHtml(store.dbName)}</code></p>
          <div class="grid" style="gap:0.5rem">
            <button class="btn btn-sm" id="s-export">Export all data (JSON backup)</button>
            <label class="btn btn-sm" style="text-align:center;cursor:pointer">Import JSON backup<input type="file" id="s-import" accept="application/json" hidden></label>
            <button class="btn-danger btn-sm" id="s-reset">Reset to seed defaults</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Deployment</div>
        <table>
          <tbody>
            <tr><th>Hosting target</th><td>${utils.escapeHtml(config.deployment?.hosting || 'github-pages')}</td></tr>
            <tr><th>Base path</th><td><code>${utils.escapeHtml(config.deployment?.base_path || '(root)')}</code></td></tr>
            <tr><th>Default branch</th><td>${utils.escapeHtml(config.deployment?.default_branch || 'main')}</td></tr>
            <tr><th>Publish flow</th><td>Push to <code>main</code> → GitHub Actions → live site</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">About Project OS</div>
        <p class="muted">A self-contained, zero-backend static project operating system: documentation, dashboard, Gantt, WBS, team, tasks, milestones, and risks — all driven by committed JSON seeds with local IndexedDB edits.</p>
        <p class="muted" style="font-size:0.82rem">Version: ${utils.escapeHtml(config.version_label || '')}</p>
      </div>
    </section>`;

  container.querySelector('#p-save').onclick = async () => {
    await store.saveProjectInfo({
      title: container.querySelector('#p-title').value.trim(),
      subject: container.querySelector('#p-subject').value.trim(),
      full_title: container.querySelector('#p-full').value.trim(),
      dates: { started: container.querySelector('#p-start').value, target: container.querySelector('#p-target').value },
    });
    await store.saveTeamInfo({
      team_name: container.querySelector('#p-team').value.trim(),
      advisor: { name: container.querySelector('#p-adviser').value.trim(), title: teamInfo.advisor?.title || 'Project Adviser' },
    });
    await store.log('Project info updated');
    utils.toast('Project info saved', 'ok');
  };

  container.querySelector('#s-theme').onclick = (e) => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    e.target.textContent = next === 'dark' ? '🌙 Dark' : '☀️ Light';
    ctx.events.emit('theme:change', next);
  };

  container.querySelector('#s-export').onclick = async () => {
    const dump = await store.exportAll();
    utils.downloadBlob(`${store.slug}-backup.json`, JSON.stringify(dump, null, 2));
    utils.toast('Backup downloaded', 'ok');
  };

  container.querySelector('#s-import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dump = JSON.parse(await file.text());
      await store.importBackup(dump);
      await store.log('Imported backup', file.name);
      utils.toast('Backup imported', 'ok');
    } catch (err) {
      utils.toast('Import failed: ' + err.message, 'error');
    }
  };

  container.querySelector('#s-reset').onclick = async () => {
    if (!confirm('Reset all local data to committed seed defaults? This discards local edits.')) return;
    await store.resetToSeed();
    utils.toast('Reset to seed defaults', 'ok');
    location.hash = '#/dashboard';
  };
}

export function unmount(container) {
  container.innerHTML = '';
}
