// Load manuscript HTML from static files; build export documents.

export async function fetchDocMainHtml(file) {
  const res = await fetch(file, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const main = doc.querySelector('main.doc-wrap');
  if (!main) throw new Error(`No <main class="doc-wrap"> in ${file}`);
  return main.innerHTML;
}

export function manuscriptCssHref(file) {
  if (file.includes('documentation/chapter2/')) return 'documentation/chapter2/assets/manuscript.css';
  return 'documentation/chapter2/assets/manuscript.css';
}

export function pageTitleFromHtml(html, fallback = 'Document') {
  const h1 = new DOMParser().parseFromString(html, 'text/html').querySelector('h1');
  return h1?.textContent?.trim() || fallback;
}

export function buildFullHtml(file, bodyHtml, title) {
  let msCss = 'documentation/chapter2/assets/manuscript.css';
  let osCss = 'os/assets/styles.css';
  let mermaidJs = 'documentation/chapter2/assets/mermaid-init.js';
  if (file.includes('documentation/chapter2/')) {
    msCss = 'assets/manuscript.css';
    osCss = '../../os/assets/styles.css';
    mermaidJs = 'assets/mermaid-init.js';
  } else if (file.includes('documentation/chapter1/')) {
    msCss = '../chapter2/assets/manuscript.css';
    osCss = '../../os/assets/styles.css';
    mermaidJs = '../chapter2/assets/mermaid-init.js';
  } else if (file === 'documentation/index.html') {
    msCss = 'chapter2/assets/manuscript.css';
    osCss = '../os/assets/styles.css';
    mermaidJs = 'chapter2/assets/mermaid-init.js';
  }
  const safeTitle = String(title || 'Knowing Eye').replace(/</g, '&lt;');
  const mermaid = bodyHtml.includes('class="mermaid"') || bodyHtml.includes("class='mermaid")
    ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
       <script defer src="${mermaidJs}"><\/script>`
    : '';
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${osCss}" />
  <link rel="stylesheet" href="${msCss}" />
  ${mermaid}
</head>
<body>
  <main class="doc-wrap">
${bodyHtml}
  </main>
</body>
</html>`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Script failed: ${src}`));
    document.head.append(s);
  });
}

export async function renderMermaidIn(root) {
  const blocks = root.querySelectorAll('.mermaid');
  if (!blocks.length) return;
  await loadScript('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js');
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'neutral' : 'dark';
  window.mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'loose',
    flowchart: { curve: 'basis', htmlLabels: true },
  });
  blocks.forEach((el) => el.removeAttribute('data-processed'));
  await window.mermaid.run({ nodes: blocks });
}
