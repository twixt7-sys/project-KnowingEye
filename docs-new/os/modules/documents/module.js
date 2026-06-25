export const id = 'documents';
export const label = 'Documentation';
export const icon = 'book';

export async function mount(container, ctx) {
  const { store, utils, route } = ctx;
  const index = await store.getSeed('documents-index.json').catch(() => ({ chapters: [] }));
  const chapters = index.chapters || [];

  // flat searchable list
  const flat = [];
  for (const ch of chapters) for (const p of ch.pages) flat.push({ ...p, chapter: ch.title });

  // deep link: #/documents/<chapterId>/<pageIndex>
  let current = flat.find((p) => p.file === 'documentation/index.html') || flat[0];
  if (route?.params?.length) {
    const [chId, idx] = route.params;
    const ch = chapters.find((c) => c.id === chId);
    if (ch && ch.pages[idx]) current = { ...ch.pages[idx], chapter: ch.title };
  }

  function sidebar(filter = '') {
    const f = filter.toLowerCase();
    return chapters
      .map((ch) => {
        const pages = ch.pages.filter((p) => !f || p.title.toLowerCase().includes(f) || ch.title.toLowerCase().includes(f));
        if (!pages.length) return '';
        return `<div class="doc-group"><p class="sidebar-label">${utils.escapeHtml(ch.title)}</p>
          ${pages.map((p) => `<a href="#" class="doc-link ${p.file === current.file ? 'active' : ''}" data-file="${utils.escapeHtml(p.file)}" data-kind="${p.kind || 'html'}">${p.part ? `<span class="badge">${p.part}</span> ` : ''}${utils.escapeHtml(p.title)}</a>`).join('')}
        </div>`;
      })
      .join('');
  }

  container.innerHTML = `
    <section class="module-page" style="max-width:100%">
      <header class="page-head"><div><h1>Documentation</h1><p class="page-sub">Manuscript index, Chapter I &amp; II. Open <strong>Documentation Index</strong> for the full paper outline.</p></div></header>
      <div class="grid" style="grid-template-columns:280px 1fr;gap:1rem;align-items:start">
        <div class="card doc-list" style="position:sticky;top:0">
          <input id="doc-search" placeholder="Search documents…" style="margin-bottom:0.6rem">
          <div id="doc-nav">${sidebar()}</div>
        </div>
        <div class="card" style="padding:0.75rem">
          <div class="row between" style="margin-bottom:0.5rem">
            <strong id="doc-title">${utils.escapeHtml(current.title)}</strong>
            <a class="btn btn-sm" id="doc-open" href="${utils.escapeHtml(current.file)}" target="_blank" rel="noopener">Open in new tab ↗</a>
          </div>
          <iframe class="doc-frame" id="doc-frame" src="${utils.escapeHtml(current.file)}" title="document viewer"></iframe>
        </div>
      </div>
    </section>`;

  function bindNav() {
    container.querySelectorAll('.doc-link').forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        const file = a.dataset.file;
        container.querySelector('#doc-frame').src = file;
        container.querySelector('#doc-open').href = file;
        container.querySelector('#doc-title').textContent = a.textContent.trim();
        container.querySelectorAll('.doc-link').forEach((x) => x.classList.remove('active'));
        a.classList.add('active');
      };
    });
  }
  bindNav();

  container.querySelector('#doc-search').oninput = (e) => {
    container.querySelector('#doc-nav').innerHTML = sidebar(e.target.value);
    bindNav();
  };
}

export function unmount(container) {
  container.innerHTML = '';
}
