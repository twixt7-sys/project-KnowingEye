export const id = 'architecture';
export const label = 'Architecture';
export const icon = 'layers';

const PAGES = [
  { file: 'architecture/01-high-level-architecture.html', title: 'High-Level Architecture' },
  { file: 'architecture/02-system-components.html', title: 'System Components' },
  { file: 'architecture/03-communication-protocols.html', title: 'Communication Protocols' },
  { file: 'architecture/04-database-design.html', title: 'Database Design' },
  { file: 'architecture/05-ai-pipeline.html', title: 'AI Pipeline' },
  { file: 'architecture/06-deployment.html', title: 'Deployment' },
  { file: 'architecture/07-workflows-diagrams.html', title: 'Workflows & Diagrams' },
];

export async function mount(container, ctx) {
  const { store, utils } = ctx;
  let graphs = [];
  try {
    const manifest = await utils.fetchJson('architecture/graphs/manifest.json');
    graphs = manifest.graphs || [];
  } catch {
    graphs = [];
  }

  container.innerHTML = `
    <section class="module-page">
      <header class="page-head">
        <div><h1>Architecture</h1><p class="page-sub">Technical reference pages and diagram gallery. Diagrams render in the standalone graph viewer.</p></div>
        <a class="btn-primary btn-sm" href="architecture/graph-viewer.html" target="_blank" rel="noopener">Open Graph Viewer ↗</a>
      </header>

      <div class="card">
        <div class="card-title">Reference Pages</div>
        <div class="grid grid-3">
          ${PAGES.map((p) => `<a class="btn" style="justify-content:flex-start;text-align:left" href="${p.file}" target="_blank" rel="noopener">${utils.escapeHtml(p.title)} ↗</a>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Diagram Gallery (${graphs.length})</div>
        ${graphs.length
          ? `<div class="grid grid-3">${graphs
              .map(
                (g) => `<a class="card" style="text-decoration:none;display:block" href="architecture/graph-viewer.html#${utils.escapeHtml(g.id)}" target="_blank" rel="noopener">
                  <span class="badge pill-${g.kind || 'rest'}">${utils.escapeHtml(g.diagram_id || g.format || 'graph')}</span>
                  <strong style="display:block;margin-top:0.4rem">${utils.escapeHtml(g.title || g.id)}</strong>
                  <span class="muted" style="font-size:0.8rem">${utils.escapeHtml(g.description || '')}</span>
                </a>`
              )
              .join('')}</div>`
          : '<p class="muted">No diagram manifest found. Add <code>architecture/graphs/manifest.json</code>.</p>'}
      </div>
    </section>`;
}

export function unmount(container) {
  container.innerHTML = '';
}
