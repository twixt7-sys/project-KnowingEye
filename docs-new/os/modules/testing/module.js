export const id = 'testing';
export const label = 'Testing';
export const icon = 'flask';

// Real automated backend suite (June 2026): 37 tests, 100% pass.
const SUITES = [
  { module: 'features.authentication', tests: 6, focus: 'JWT login/refresh, register, profile, password change' },
  { module: 'features.exams', tests: 5, focus: 'CRUD, publish, archive, RBAC' },
  { module: 'features.session', tests: 1, focus: 'Start session, submit, auto-scoring' },
  { module: 'features.monitoring', tests: 9, focus: 'Health, frame REST, enroll, WebSocket consumer' },
  { module: 'features.behavior', tests: 4, focus: 'Logs query, alerts list, resolve (admin)' },
  { module: 'features.reports', tests: 6, focus: 'Summary, session list/detail, CSV, timeseries' },
  { module: 'ai.tests', tests: 4, focus: 'Pipeline schema, no-face flag, preprocessing' },
];

const PERF = [
  { op: 'REST login', latency: '50–200 ms', target: '< 2 s', status: 'pass' },
  { op: 'Start exam session', latency: '80–300 ms', target: '< 2 s', status: 'pass' },
  { op: 'Frame analysis (CPU pipeline)', latency: '200–800 ms', target: '< 300 ms', status: 'warn' },
  { op: 'WebSocket round-trip', latency: '250–900 ms', target: '< 300 ms', status: 'warn' },
  { op: 'Reports summary API', latency: '100–500 ms', target: '< 2 s', status: 'pass' },
];

export async function mount(container, ctx) {
  const { utils } = ctx;
  const total = SUITES.reduce((s, r) => s + r.tests, 0);

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head">
        <div><h1>Testing</h1><p class="page-sub">Automated backend suite, performance observations, and requirement traceability.</p></div>
        <a class="btn-primary btn-sm" href="chapter2/04-system-testing.html" target="_blank" rel="noopener">System Testing Chapter ↗</a>
      </header>

      <div class="grid grid-3">
        <div class="stat"><span class="stat-value text-ok">${total}/${total}</span><span class="stat-label">Automated tests passing</span><span class="stat-sub">100% · ~2 min runtime</span></div>
        <div class="stat"><span class="stat-value">${SUITES.length}</span><span class="stat-label">Test modules</span></div>
        <div class="stat"><span class="stat-value">9</span><span class="stat-label">Monitoring tests (incl. WebSocket)</span></div>
      </div>

      <div class="card">
        <div class="card-title">Automated Backend Test Suite (Traceability)</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Module</th><th>Tests</th><th>Key verifications</th><th>Status</th></tr></thead>
            <tbody>${SUITES.map((r) => `<tr><td class="mono">${r.module}</td><td>${r.tests}</td><td>${utils.escapeHtml(r.focus)}</td><td><span class="badge status-pass">PASS</span></td></tr>`).join('')}</tbody>
          </table>
        </div>
        <p class="muted" style="font-size:0.8rem;margin-top:0.5rem">Run via <code>python manage.py test</code> on SQLite (Python 3.12, Django 6). Frontend production build (<code>npm run build</code>) also passing.</p>
      </div>

      <div class="card">
        <div class="card-title">Performance Observations (development environment)</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Operation</th><th>Typical latency</th><th>Target (NFR-1)</th><th>Status</th></tr></thead>
            <tbody>${PERF.map((p) => `<tr><td>${utils.escapeHtml(p.op)}</td><td>${p.latency}</td><td>${p.target}</td><td><span class="badge status-${p.status === 'pass' ? 'pass' : 'warn'}">${p.status === 'pass' ? 'MET' : 'AT 1 FPS'}</span></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Planned AI Evaluation (outstanding UAT)</div>
        <p class="muted">The behavior pipeline uses rule-based threshold scoring rather than a single trained classifier. Formal classification metrics (Accuracy, Recall, Precision, F1-Score) require a labeled held-out set and are scheduled as a UAT activity together with ArcFace identity benchmarking and a UTAUT usability study.</p>
        <div class="row" style="margin-top:0.5rem">
          <a class="btn btn-sm" href="testing/testing(IEEE)/README.md" target="_blank" rel="noopener">IEEE Test Pack ↗</a>
          <a class="btn btn-sm" href="testing/testing(UTAUT)/README.md" target="_blank" rel="noopener">UTAUT Pack ↗</a>
          <a class="btn btn-sm" href="#/documents/chapter2/4">Summary of Findings</a>
        </div>
      </div>
    </section>`;
}

export function unmount(container) {
  container.innerHTML = '';
}
