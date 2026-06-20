/**
 * Knowing Eye architecture graph viewer
 * Renders JSON/DBML graph sources with Mermaid + vis-network
 */

const TIER_COLORS_DARK = {
  client: { background: '#1e3a5f', border: '#5b8def' },
  edge: { background: '#1a3344', border: '#38bdf8' },
  application: { background: '#1f2937', border: '#94a3b8' },
  ai: { background: '#3b1f3a', border: '#f472b6' },
  infrastructure: { background: '#1a2e2a', border: '#34d399' },
  data: { background: '#3d2a14', border: '#fb923c' },
  external: { background: '#2d2d3d', border: '#a78bfa' },
  static: { background: '#252530', border: '#cbd5e1' },
  compute: { background: '#1e293b', border: '#64748b' },
  cache: { background: '#3f1d1d', border: '#f87171' },
  database: { background: '#3d2a14', border: '#fb923c' },
  storage: { background: '#2a2a35', border: '#94a3b8' },
  default: { background: '#1a2234', border: '#5b8def' },
};

const TIER_COLORS_LIGHT = {
  client: { background: '#dbeafe', border: '#2563eb' },
  edge: { background: '#e0f2fe', border: '#0284c7' },
  application: { background: '#f1f5f9', border: '#64748b' },
  ai: { background: '#fce7f3', border: '#db2777' },
  infrastructure: { background: '#d1fae5', border: '#059669' },
  data: { background: '#ffedd5', border: '#ea580c' },
  external: { background: '#ede9fe', border: '#7c3aed' },
  static: { background: '#f8fafc', border: '#94a3b8' },
  compute: { background: '#e2e8f0', border: '#475569' },
  cache: { background: '#fee2e2', border: '#dc2626' },
  database: { background: '#ffedd5', border: '#ea580c' },
  storage: { background: '#f1f5f9', border: '#64748b' },
  default: { background: '#eef2f9', border: '#2563eb' },
};

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function getTierColors() {
  return isLightTheme() ? TIER_COLORS_LIGHT : TIER_COLORS_DARK;
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const DIAGRAMS = [
  { id: 'Fig-2.1', file: 'system-architecture.json', title: 'High-Level System Architecture' },
  { id: 'Fig-2.2', file: 'backend-layers.json', title: 'Backend Layered Architecture' },
  { id: 'Fig-2.3', file: 'ai-pipeline-component.json', title: 'AI Pipeline Components' },
  { id: 'Fig-2.4', file: 'deployment-topology.json', title: 'Deployment Topology' },
  { id: 'Fig-2.5', file: 'frontend-component.json', title: 'Frontend Components' },
  { id: 'Fig-3.1', file: 'sequence-exam-flow.json', title: 'Exam Session Sequence' },
  { id: 'Fig-3.2', file: 'data-flow-monitoring.json', title: 'Monitoring Data Flow' },
  { id: 'Fig-3.3', file: 'rest-api-catalog.json', title: 'REST API Catalog' },
  { id: 'Fig-4.1', file: 'database-erd.dbml', title: 'Database ERD' },
];

let visNetwork = null;
let currentDiagram = null;

function esc(s) {
  return String(s ?? '').replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' }[c]));
}

function sid(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeMermaidLabel(s) {
  return String(s ?? '')
    .replace(/[^a-zA-Z0-9 _-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 36);
}

function extractDbmlTables(dbml) {
  const tables = [];
  const re = /Table\s+(\w+)\s*\{/g;
  let match;
  while ((match = re.exec(dbml)) !== null) {
    const name = match[1];
    let depth = 1;
    let i = match.index + match[0].length;
    let body = '';
    while (i < dbml.length && depth > 0) {
      const ch = dbml[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      if (depth > 0) body += ch;
      i += 1;
    }
    tables.push({ name, body });
  }
  return tables;
}

function setCanvasScrollMode(mode) {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  canvas.classList.remove('scroll-vis', 'scroll-mermaid', 'scroll-catalog');
  if (mode) canvas.classList.add(mode);
}

function resizeVisContainer(container, network) {
  const fitAndResize = () => {
    network.fit({ animation: false });
    try {
      const box = network.getBoundingBox();
      const h = Math.max(560, Math.ceil(box.bottom - box.top + 160));
      container.style.height = `${h}px`;
      container.style.minHeight = `${h}px`;
      network.redraw();
      network.fit({ animation: false });
    } catch {
      container.style.minHeight = '560px';
    }
  };
  network.once('stabilized', fitAndResize);
  setTimeout(fitAndResize, 120);
}

async function loadGraph(filename) {
  if (window.KNOWING_EYE_GRAPHS?.[filename]) {
    return window.KNOWING_EYE_GRAPHS[filename];
  }
  const res = await fetch(`graphs/${filename}`);
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  return res.json();
}

async function loadDbml() {
  if (window.KNOWING_EYE_DBML) return window.KNOWING_EYE_DBML;
  const res = await fetch('graphs/database-erd.dbml');
  if (!res.ok) throw new Error('Failed to load DBML');
  return res.text();
}

function destroyVis() {
  if (visNetwork) {
    visNetwork.destroy();
    visNetwork = null;
  }
}

function renderVisNetwork(container, data, options = {}) {
  destroyVis();
  container.classList.add('vis-graph');
  const nodes = new vis.DataSet(data.nodes);
  const edges = new vis.DataSet(data.edges);
  const opts = {
    layout: options.layout || { hierarchical: { enabled: true, direction: 'UD', sortMethod: 'directed', levelSeparation: 120, nodeSpacing: 160 } },
    physics: options.physics ?? false,
    interaction: {
      hover: true,
      navigationButtons: true,
      keyboard: true,
      dragView: true,
      zoomView: true,
      dragNodes: true,
    },
    nodes: {
      shape: 'box',
      margin: 10,
      font: { color: cssVar('--vis-node-text', '#e8ecf4'), face: 'DM Sans', size: 13 },
      borderWidth: 2,
      shadow: true,
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 0.7 } },
      color: { color: cssVar('--vis-edge', '#5b8def'), highlight: cssVar('--vis-edge-highlight', '#7c5cff') },
      font: { color: cssVar('--muted', '#8b95a8'), size: 11, align: 'middle', strokeWidth: 0 },
      smooth: { type: 'cubicBezier', forceDirection: 'vertical' },
    },
  };
  visNetwork = new vis.Network(container, { nodes, edges }, opts);
  setCanvasScrollMode('scroll-vis');
  resizeVisContainer(container, visNetwork);
}

function nodeColor(meta = {}) {
  const key = meta.tier || meta.type || 'default';
  const palette = getTierColors();
  return palette[key] || palette.default;
}

function buildVisFromGraph(json) {
  const nodes = json.nodes.map((n) => {
    const c = nodeColor(n);
    const sub = n.technology || n.path || (n.responsibilities ? n.responsibilities.slice(0, 2).join(', ') : '') || '';
    return {
      id: n.id,
      label: `${n.label}${sub ? `\n${sub}` : ''}`,
      color: { background: c.background, border: c.border, highlight: { background: c.background, border: '#fff' } },
      group: n.tier || n.type,
    };
  });

  const edges = json.edges.map((e, i) => ({
    id: `e${i}`,
    from: e.from,
    to: e.to,
    label: e.label || e.protocol || '',
  }));

  if (json.layers) {
    json.layers.forEach((layer, li) => {
      layer.nodes.forEach((nid) => {
        const node = nodes.find((x) => x.id === nid);
        if (node) node.level = li;
      });
    });
  }

  return { nodes, edges };
}

function buildVisDeployment(json) {
  return buildVisFromGraph(json);
}

function buildVisAiPipeline(json) {
  const palette = getTierColors();
  const nodes = json.nodes.map((n) => {
    const c = n.id === 'adapter' ? palette.application : n.id === 'config' ? palette.edge : palette.ai;
    const extra = n.path || (n.modules ? n.modules.join(', ') : n.role || '');
    return {
      id: n.id,
      label: `${n.label}\n${extra}`,
      color: { background: c.background, border: c.border },
    };
  });
  const edges = json.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to, label: e.label }));
  return { nodes, edges };
}

function toMermaidSequence(json) {
  const parts = json.participants.map((p) => `  participant ${sid(p.id)} as ${p.label.replace(/"/g, "'")}`);
  const lines = ['sequenceDiagram', ...parts];

  json.messages.forEach((m) => {
    const a = sid(m.from);
    const b = sid(m.to);
    let label = m.label || m.path || m.method || m.type;
    if (m.method && m.path) label = `${m.method} ${m.path}`;
    label = label.replace(/"/g, "'").replace(/\n/g, ' ');
    const arrow = m.type === 'response' || m.type === 'event' ? '-->>' : '->>';
    lines.push(`  ${a}${arrow}${b}: ${label}`);
  });

  if (json.parallel_region) {
    lines.push('  par Monitoring loop');
    json.parallel_region.messages.forEach((m) => {
      lines.push(`    ${sid(m.from)}->>${sid(m.to)}: ${m.label.replace(/"/g, "'")}`);
    });
    lines.push('  end');
  }

  return lines.join('\n');
}

function toMermaidBackendLayers(json) {
  const lines = ['flowchart TB'];
  json.layers.forEach((layer, i) => {
    const gid = `L${i}`;
    lines.push(`  subgraph ${gid}["${layer.name}"]`);
    lines.push(`    direction TB`);
    if (layer.modules) {
      layer.modules.forEach((m) => {
        const id = sid(`${gid}_${m.name}`);
        const label = `${m.name}\\n${m.api_prefix || m.models?.join(', ') || ''}`.replace(/"/g, "'");
        lines.push(`    ${id}["${label}"]`);
      });
    } else if (layer.responsibilities) {
      const id = sid(`${gid}_core`);
      lines.push(`    ${id}["${layer.path}\\n${layer.responsibilities[0]}"]`);
    }
    lines.push('  end');
    if (i > 0) lines.push(`  L${i - 1} --> L${i}`);
  });

  if (json.request_flow) {
    lines.push('  subgraph RF["Request Flow"]');
    json.request_flow.forEach((step, i) => {
      const id = sid(`rf${i}`);
      lines.push(`    ${id}["${step.replace(/"/g, "'")}"]`);
      if (i > 0) lines.push(`    ${sid(`rf${i - 1}`)} --> ${id}`);
    });
    lines.push('  end');
  }

  return lines.join('\n');
}

function toMermaidFrontend(json) {
  const lines = ['flowchart TB'];
  json.layers.forEach((layer, i) => {
    const gid = `F${i}`;
    lines.push(`  subgraph ${gid}["${layer.name}"]`);
    if (layer.modules && Array.isArray(layer.modules) && layer.modules[0]?.name) {
      layer.modules.forEach((m) => {
        lines.push(`    ${sid(m.name)}["${m.name}\\n${m.role || m.api || ''}"]`);
      });
    } else if (layer.public) {
      lines.push(`    ${gid}_pub["public: ${layer.public.slice(0, 3).join(', ')}..."]`);
    } else if (Array.isArray(layer.modules)) {
      lines.push(`    ${gid}_sh["${layer.modules.slice(0, 2).join('\\n')}"]`);
    }
    lines.push('  end');
    if (i > 0) lines.push(`  F${i - 1} --> F${i}`);
  });
  return lines.join('\n');
}

function toMermaidDataFlow(json) {
  const level = json.levels?.find((l) => l.level === 1) || json.levels?.[1];
  if (!level) return 'flowchart TB\n  empty[No data]';

  const lines = ['flowchart TB'];
  const ext = new Set();
  level.data_flows.forEach((f) => {
    if (!/^P\d/.test(f.from)) ext.add(f.from);
    if (!/^P\d/.test(f.to) && f.to !== 'Session DB') ext.add(f.to);
  });

  ext.forEach((e) => {
    lines.push(`  ${sid(e)}["${sanitizeMermaidLabel(e)}"]`);
  });
  lines.push('  SessionDB[("Session DB")]');
  level.processes.forEach((p) => {
    lines.push(`  ${p.id}["${sanitizeMermaidLabel(p.label)}\\n${sanitizeMermaidLabel(p.component)}"]`);
  });

  level.data_flows.forEach((f) => {
    if (f.optional) return;
    const from = /^P\d/.test(f.from) ? f.from : sid(f.from);
    const to = /^P\d/.test(f.to) ? f.to : f.to === 'Session DB' ? 'SessionDB' : sid(f.to);
    const label = sanitizeMermaidLabel(f.protocol || f.data || '');
    if (label) {
      lines.push(`  ${from} -->|"${label}"| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  });

  return lines.join('\n');
}

function toMermaidApiCatalog(json) {
  const lines = ['flowchart TB'];
  json.modules.forEach((mod) => {
    const gid = sid(`mod_${mod.name}`);
    lines.push(`  subgraph ${gid}["${sanitizeMermaidLabel(mod.name)}"]`);
    lines.push('    direction TB');
    const root = sid(`${gid}_root`);
    lines.push(`    ${root}["${sanitizeMermaidLabel(mod.base)}"]`);
    mod.endpoints.slice(0, 4).forEach((ep, ei) => {
      const id = sid(`${gid}_ep${ei}`);
      lines.push(`    ${id}["${sanitizeMermaidLabel(`${ep.method} ${ep.path}`)}"]`);
      lines.push(`    ${root} --> ${id}`);
    });
    if (mod.websocket) {
      mod.websocket.forEach((ws, wi) => {
        const id = sid(`${gid}_ws${wi}`);
        lines.push(`    ${id}["${sanitizeMermaidLabel(`WS ${ws.path}`)}"]`);
        lines.push(`    ${root} --> ${id}`);
      });
    }
    lines.push('  end');
  });
  return lines.join('\n');
}

function parseDbmlToMermaidEr(dbml) {
  const tables = [];
  const refs = [];
  const seenRefs = new Set();

  extractDbmlTables(dbml).forEach(({ name, body }) => {
    const cols = [];
    let inIndexes = false;
    body.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;
      if (/^indexes\s*\{/.test(trimmed)) {
        inIndexes = true;
        return;
      }
      if (inIndexes) {
        if (trimmed === '}') inIndexes = false;
        return;
      }
      if (trimmed.startsWith('Note:')) return;

      const colMatch = trimmed.match(/^(\w+)\s+(\w+)/);
      if (colMatch) {
        const [, col, type] = colMatch;
        const isPk = /\[pk/i.test(trimmed);
        cols.push(isPk ? `${type} ${col} PK` : `${type} ${col}`);
      }
      const refMatch = trimmed.match(/ref:\s*([->\-]+)\s+(\w+)\.(\w+)/);
      if (refMatch) {
        const [, arrow, toTable] = refMatch;
        const key = `${name}->${toTable}`;
        if (!seenRefs.has(key)) {
          seenRefs.add(key);
          refs.push({ from: name, to: toTable, oneToOne: arrow.includes('-') });
        }
      }
    });
    if (cols.length) tables.push({ name, cols: cols.slice(0, 8) });
  });

  const lines = ['erDiagram'];
  tables.forEach((t) => {
    lines.push(`  ${t.name} {`);
    t.cols.forEach((c) => {
      const safe = c.replace(/[^a-zA-Z0-9_ ]/g, ' ').trim();
      if (safe) lines.push(`    ${safe}`);
    });
    lines.push('  }');
  });
  refs.forEach((r) => {
    const rel = r.oneToOne ? '||--||' : '||--o{';
    lines.push(`  ${r.to} ${rel} ${r.from} : ref`);
  });
  return lines.join('\n');
}

async function renderMermaid(container, code) {
  destroyVis();
  setCanvasScrollMode('scroll-mermaid');
  container.classList.remove('vis-graph');
  container.innerHTML = `<pre class="mermaid">${esc(code)}</pre>`;
  try {
    const { svg } = await mermaid.render(`mmd-${Date.now()}`, code);
    container.innerHTML = `<div class="mermaid-output">${svg}</div>`;
  } catch (err) {
    container.innerHTML = `<p class="error">Mermaid parse error: ${esc(err.message)}</p><details class="graph-source" open><summary>Diagram source</summary><pre>${esc(code)}</pre></details>`;
  }
}

function renderApiTable(container, json) {
  destroyVis();
  let html = '<div class="api-table-wrap">';
  json.modules.forEach((mod) => {
    html += `<h4>${esc(mod.name)} <code>${esc(mod.base)}</code></h4><table class="api-mini"><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>`;
    mod.endpoints.forEach((ep) => {
      html += `<tr><td>${esc(ep.method)}</td><td><code>${esc(ep.path)}</code></td><td>${esc(ep.description)}</td></tr>`;
    });
    if (mod.websocket) {
      mod.websocket.forEach((ws) => {
        html += `<tr><td>WS</td><td><code>${esc(ws.path)}</code></td><td>${esc(ws.description || ws.auth || '')}</td></tr>`;
      });
    }
    html += '</tbody></table>';
  });
  html += '</div>';
  container.innerHTML = html;
}

async function renderDiagram(diagramMeta) {
  const canvas = document.getElementById('graph-canvas');
  const titleEl = document.getElementById('viewer-title');
  const descEl = document.getElementById('viewer-desc');
  const metaEl = document.getElementById('viewer-meta');
  const linkSource = document.getElementById('link-source');

  currentDiagram = diagramMeta;
  titleEl.textContent = `${diagramMeta.id} — ${diagramMeta.title}`;
  if (linkSource) linkSource.href = `graphs/${diagramMeta.file}`;
  canvas.innerHTML = '<p class="loading">Rendering…</p>';
  setCanvasScrollMode(null);

  try {
    if (diagramMeta.file.endsWith('.dbml')) {
      const dbml = await loadDbml();
      descEl.textContent = 'Entity-relationship diagram parsed from DBML';
      metaEl.textContent = 'Renderer: Mermaid erDiagram · scroll vertically to see all tables';
      const er = parseDbmlToMermaidEr(dbml);
      canvas.innerHTML = '';
      const inner = document.createElement('div');
      inner.className = 'render-target mermaid-target';
      canvas.appendChild(inner);
      await renderMermaid(inner, er);
      return;
    }

    const json = await loadGraph(diagramMeta.file);
    descEl.textContent = json.description || '';
    metaEl.textContent = `Format: ${json.format || 'graph'} · Source: graphs/${diagramMeta.file}`;

    canvas.innerHTML = '';
    const inner = document.createElement('div');
    const isVis = ['directed_graph', 'deployment_topology'].includes(json.format)
      || (json.format === 'component_diagram' && json.nodes);
    const isMermaid = ['sequence_diagram', 'layered_component', 'data_flow_diagram'].includes(json.format)
      || (json.format === 'component_diagram' && json.layers && !json.nodes);

    if (json.format !== 'api_catalog') {
      inner.className = 'render-target' + (isVis ? ' vis-graph' : isMermaid ? ' mermaid-target' : '');
      canvas.appendChild(inner);
    }

    switch (json.format) {
      case 'directed_graph':
      case 'deployment_topology': {
        metaEl.textContent += ' · Renderer: vis-network (hierarchical) · drag to pan, scroll vertically';
        const visData = json.format === 'deployment_topology' ? buildVisDeployment(json) : buildVisFromGraph(json);
        if (json.render_hints?.mermaid_template && json.format === 'directed_graph') {
          // Also offer mermaid for cleaner tier view - use vis for interactivity
        }
        renderVisNetwork(inner, visData, {
          layout: { hierarchical: { enabled: true, direction: 'UD', sortMethod: 'directed', levelSeparation: 100, nodeSpacing: 140 } },
        });
        break;
      }
      case 'component_diagram':
        if (json.nodes) {
          metaEl.textContent += ' · Renderer: vis-network';
          renderVisNetwork(inner, buildVisAiPipeline(json), {
            layout: { hierarchical: { enabled: true, direction: 'UD', levelSeparation: 90 } },
          });
        } else if (json.layers) {
          metaEl.textContent += ' · Renderer: Mermaid flowchart';
          await renderMermaid(inner, toMermaidFrontend(json));
        }
        break;
      case 'sequence_diagram':
        metaEl.textContent += ' · Renderer: Mermaid sequenceDiagram';
        await renderMermaid(inner, json.mermaid_placeholder || toMermaidSequence(json));
        break;
      case 'layered_component':
        metaEl.textContent += ' · Renderer: Mermaid flowchart';
        await renderMermaid(inner, toMermaidBackendLayers(json));
        break;
      case 'data_flow_diagram':
        metaEl.textContent += ' · Renderer: Mermaid flowchart · scroll vertically if needed';
        await renderMermaid(inner, toMermaidDataFlow(json));
        break;
      case 'api_catalog':
        metaEl.textContent += ' · Renderer: endpoint tables + module overview diagram';
        setCanvasScrollMode('scroll-catalog');
        canvas.innerHTML = '';
        const stack = document.createElement('div');
        stack.className = 'catalog-stack';

        const tableSection = document.createElement('div');
        tableSection.className = 'catalog-section catalog-tables';
        renderApiTable(tableSection, json);
        stack.appendChild(tableSection);

        const diagramSection = document.createElement('div');
        diagramSection.className = 'catalog-section catalog-diagram';
        const diagramLabel = document.createElement('h4');
        diagramLabel.className = 'catalog-diagram-title';
        diagramLabel.textContent = 'Module overview';
        diagramSection.appendChild(diagramLabel);
        const mermaidHost = document.createElement('div');
        mermaidHost.className = 'mermaid-host';
        diagramSection.appendChild(mermaidHost);
        stack.appendChild(diagramSection);

        canvas.appendChild(stack);
        await renderMermaid(mermaidHost, toMermaidApiCatalog(json));
        break;
      default:
        if (json.nodes && json.edges) {
          renderVisNetwork(inner, buildVisFromGraph(json));
        } else if (json.layers && json.layers[0]?.modules?.[0]?.name === 'router') {
          await renderMermaid(inner, toMermaidFrontend(json));
        } else if (json.layers) {
          await renderMermaid(inner, toMermaidBackendLayers(json));
        } else {
          inner.innerHTML = `<pre>${esc(JSON.stringify(json, null, 2))}</pre>`;
        }
    }
  } catch (err) {
    canvas.innerHTML = `<p class="error">Could not render: ${esc(err.message)}. Open via local server or ensure assets/graph-manifest.js is loaded.</p>`;
  }
}

function buildSidebar() {
  const nav = document.getElementById('diagram-nav');
  nav.innerHTML = '';
  DIAGRAMS.forEach((d) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diagram-btn';
    btn.dataset.id = d.id;
    btn.innerHTML = `<span class="did">${d.id}</span>${d.title}`;
    btn.addEventListener('click', () => selectDiagram(d.id));
    nav.appendChild(btn);
  });
}

function selectDiagram(id) {
  const d = DIAGRAMS.find((x) => x.id === id);
  if (!d) return;
  document.querySelectorAll('.diagram-btn').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  history.replaceState(null, '', `#${id}`);
  renderDiagram(d);
}

function initMermaid() {
  const light = isLightTheme();
  mermaid.initialize({
    startOnLoad: false,
    theme: light ? 'default' : 'dark',
    themeVariables: light
      ? {
          primaryColor: '#eef2f9',
          primaryTextColor: '#0f172a',
          primaryBorderColor: '#2563eb',
          lineColor: '#2563eb',
          secondaryColor: '#ffffff',
          tertiaryColor: '#f4f6fb',
        }
      : {
          primaryColor: '#1a2234',
          primaryTextColor: '#e8ecf4',
          primaryBorderColor: '#5b8def',
          lineColor: '#5b8def',
          secondaryColor: '#121826',
          tertiaryColor: '#0a0e17',
        },
    sequence: { actorMargin: 40, messageMargin: 35 },
    flowchart: { curve: 'basis', padding: 16 },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMermaid();
  buildSidebar();
  document.getElementById('btn-fit')?.addEventListener('click', () => {
    if (visNetwork) {
      visNetwork.fit({ animation: true });
      const target = document.querySelector('.render-target.vis-graph');
      if (target) resizeVisContainer(target, visNetwork);
    }
  });
  const hash = location.hash.replace('#', '');
  const initial = DIAGRAMS.find((d) => d.id === hash) || DIAGRAMS[0];
  selectDiagram(initial.id);
});

window.addEventListener('knowing-eye-theme-change', () => {
  initMermaid();
  if (currentDiagram) renderDiagram(currentDiagram);
});

window.addEventListener('resize', () => visNetwork?.redraw());
