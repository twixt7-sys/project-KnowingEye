import { buildFullHtml, pageTitleFromHtml, renderMermaidIn } from '../../core/doc-content.js';

export const id = 'documents';
export const label = 'Documentation';
export const icon = 'book';

export async function mount(container, ctx) {
  const { store, utils, route } = ctx;
  const index = await store.getSeed('documents-index.json').catch(() => ({ chapters: [] }));
  const chapters = index.chapters || [];

  const flat = [];
  for (const ch of chapters) for (const p of ch.pages) flat.push({ ...p, chapter: ch.title });

  let current = flat.find((p) => p.file === 'documentation/index.html') || flat[0];
  if (route?.params?.length) {
    const [chId, idx] = route.params;
    const ch = chapters.find((c) => c.id === chId);
    if (ch && ch.pages[idx]) current = { ...ch.pages[idx], chapter: ch.title };
  }

  let editing = false;
  let dirty = false;
  let savedHtml = '';

  function sidebar(filter = '') {
    const f = filter.toLowerCase();
    return chapters
      .map((ch) => {
        const pages = ch.pages.filter((p) => !f || p.title.toLowerCase().includes(f) || ch.title.toLowerCase().includes(f));
        if (!pages.length) return '';
        return `<div class="doc-group"><p class="sidebar-label">${utils.escapeHtml(ch.title)}</p>
          ${pages.map((p) => `<a href="#" class="doc-link ${p.file === current.file ? 'active' : ''}" data-file="${utils.escapeHtml(p.file)}" data-title="${utils.escapeHtml(p.title)}">${p.part ? `<span class="badge">${p.part}</span> ` : ''}${utils.escapeHtml(p.title)}</a>`).join('')}
        </div>`;
      })
      .join('');
  }

  function toolbarHtml() {
    return `
      <div class="doc-toolbar row between" style="flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem">
        <div class="row" style="gap:0.35rem;flex-wrap:wrap">
          <button type="button" class="btn btn-sm" id="doc-edit">${editing ? 'Preview' : 'Edit'}</button>
          <button type="button" class="btn-primary btn-sm" id="doc-save" ${editing ? '' : 'hidden'}>Save</button>
          <button type="button" class="btn btn-sm" id="doc-revert" ${editing ? '' : 'hidden'}>Revert to file</button>
          <span id="doc-dirty" class="badge" style="display:${dirty ? 'inline' : 'none'};background:var(--warn-soft);color:var(--warn)">Unsaved</span>
          <span id="doc-edited" class="badge" style="display:none">Edited locally</span>
        </div>
        <div class="row" style="gap:0.35rem">
          <button type="button" class="btn btn-sm" id="doc-fmt-b" title="Bold" hidden><strong>B</strong></button>
          <button type="button" class="btn btn-sm" id="doc-fmt-i" title="Italic" hidden><em>I</em></button>
          <button type="button" class="btn btn-sm" id="doc-fmt-h2" title="Heading 2" hidden>H2</button>
          <button type="button" class="btn btn-sm" id="doc-download">Download HTML</button>
          <a class="btn btn-sm" id="doc-open" href="${utils.escapeHtml(current.file)}" target="_blank" rel="noopener">Static file ↗</a>
        </div>
      </div>`;
  }

  container.innerHTML = `
    <section class="module-page doc-module" style="max-width:100%">
      <header class="page-head">
        <div>
          <h1>Documentation</h1>
          <p class="page-sub">Edit manuscript pages in place - changes save to your browser (IndexedDB). Use <strong>Download HTML</strong> to export; static files in the repo are unchanged until you replace them.</p>
        </div>
      </header>
      <div class="grid doc-layout">
        <div class="card doc-list">
          <input id="doc-search" placeholder="Search documents…" style="margin-bottom:0.6rem">
          <div id="doc-nav">${sidebar()}</div>
        </div>
        <div class="card doc-panel" style="padding:0.75rem">
          <div class="row between" style="margin-bottom:0.35rem;flex-wrap:wrap;gap:0.5rem">
            <strong id="doc-title">${utils.escapeHtml(current.title)}</strong>
            <div class="row" style="gap:0.35rem">
              <button type="button" class="btn btn-sm doc-nav-toggle" id="doc-nav-toggle">Browse docs</button>
              <span class="muted" id="doc-meta" style="font-size:0.78rem"></span>
            </div>
          </div>
          <div id="doc-toolbar-wrap">${toolbarHtml()}</div>
          <div class="doc-viewer-shell">
            <div class="doc-viewer-pane doc-wrap" id="doc-body" aria-label="Document content"></div>
          </div>
        </div>
      </div>
    </section>`;

  const bodyEl = container.querySelector('#doc-body');
  const metaEl = container.querySelector('#doc-meta');

  function setFmtVisible(show) {
    ['doc-fmt-b', 'doc-fmt-i', 'doc-fmt-h2'].forEach((id) => {
      const el = container.querySelector(`#${id}`);
      if (el) el.hidden = !show;
    });
  }

  function updateToolbar() {
    const wrap = container.querySelector('#doc-toolbar-wrap');
    if (wrap) wrap.innerHTML = toolbarHtml();
    bindToolbar();
    setFmtVisible(editing);
  }

  async function renderPage(file, title) {
    bodyEl.innerHTML = '<p class="muted" style="padding:1rem">Loading…</p>';
    try {
      const row = await store.getDocPage(file);
      savedHtml = row.html;
      dirty = false;
      bodyEl.innerHTML = row.html;
      bodyEl.contentEditable = editing ? 'true' : 'false';
      metaEl.textContent = row.source === 'edited'
        ? `Last saved ${new Date(row.updated_at).toLocaleString()}`
        : 'Loaded from repository file';
      const editedBadge = container.querySelector('#doc-edited');
      if (editedBadge) editedBadge.style.display = row.source === 'edited' ? 'inline' : 'none';
      if (!editing) await renderMermaidIn(bodyEl);
    } catch (err) {
      bodyEl.innerHTML = `<p class="empty-state">Failed to load: ${utils.escapeHtml(err.message)}</p>`;
    }
    container.querySelector('#doc-open').href = file;
    container.querySelector('#doc-title').textContent = title || pageTitleFromHtml(savedHtml, file);
    updateDirtyBadge();
  }

  function updateDirtyBadge() {
    const badge = container.querySelector('#doc-dirty');
    if (badge) badge.style.display = dirty ? 'inline' : 'none';
  }

  async function selectPage(file, title) {
    if (dirty && !confirm('Discard unsaved changes on this page?')) return;
    current = flat.find((p) => p.file === file) || { file, title };
    editing = false;
    container.querySelectorAll('.doc-link').forEach((x) => x.classList.toggle('active', x.dataset.file === file));
    const section = container.querySelector('.doc-module');
    const navToggle = container.querySelector('#doc-nav-toggle');
    if (section && window.matchMedia('(max-width: 900px)').matches) {
      section.classList.add('doc-nav-hidden');
      if (navToggle) navToggle.textContent = 'Browse docs';
    }
    updateToolbar();
    await renderPage(file, title);
  }

  function bindNav() {
    container.querySelectorAll('.doc-link').forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        selectPage(a.dataset.file, a.dataset.title || a.textContent.trim());
      };
    });
  }

  function bindToolbar() {
    const editBtn = container.querySelector('#doc-edit');
    const saveBtn = container.querySelector('#doc-save');
    const revertBtn = container.querySelector('#doc-revert');
    const downloadBtn = container.querySelector('#doc-download');

    if (editBtn) {
      editBtn.onclick = async () => {
        editing = !editing;
        bodyEl.contentEditable = editing ? 'true' : 'false';
        updateToolbar();
        if (editing) {
          bodyEl.focus();
        } else {
          await renderMermaidIn(bodyEl);
        }
      };
    }

    if (saveBtn) {
      saveBtn.onclick = async () => {
        const html = bodyEl.innerHTML;
        const row = await store.saveDocPage(current.file, html);
        savedHtml = html;
        dirty = false;
        editing = false;
        bodyEl.contentEditable = 'false';
        await store.log('Documentation saved', current.file);
        utils.toast('Page saved locally', 'ok');
        metaEl.textContent = `Last saved ${new Date(row.updated_at).toLocaleString()}`;
        const editedBadge = container.querySelector('#doc-edited');
        if (editedBadge) editedBadge.style.display = 'inline';
        updateToolbar();
        await renderMermaidIn(bodyEl);
      };
    }

    if (revertBtn) {
      revertBtn.onclick = async () => {
        if (!confirm('Revert this page to the committed HTML file? Local edits will be lost.')) return;
        const row = await store.resetDocPage(current.file);
        savedHtml = row.html;
        dirty = false;
        editing = false;
        bodyEl.contentEditable = 'false';
        bodyEl.innerHTML = row.html;
        metaEl.textContent = 'Loaded from repository file';
        const editedBadge = container.querySelector('#doc-edited');
        if (editedBadge) editedBadge.style.display = 'none';
        await store.log('Documentation reverted', current.file);
        utils.toast('Reverted to file default', 'ok');
        updateToolbar();
        await renderMermaidIn(bodyEl);
      };
    }

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const title = container.querySelector('#doc-title')?.textContent || 'Document';
        const html = buildFullHtml(current.file, bodyEl.innerHTML, title);
        const name = current.file.split('/').pop() || 'page.html';
        utils.downloadBlob(name, html, 'text/html');
        utils.toast('HTML downloaded', 'ok');
      };
    }

    container.querySelector('#doc-fmt-b')?.addEventListener('click', () => document.execCommand('bold'));
    container.querySelector('#doc-fmt-i')?.addEventListener('click', () => document.execCommand('italic'));
    container.querySelector('#doc-fmt-h2')?.addEventListener('click', () => document.execCommand('formatBlock', false, 'h2'));
  }

  bodyEl.addEventListener('input', () => {
    if (!editing) return;
    dirty = bodyEl.innerHTML !== savedHtml;
    updateDirtyBadge();
  });

  bindNav();
  bindToolbar();
  container.querySelector('#doc-search').oninput = (e) => {
    container.querySelector('#doc-nav').innerHTML = sidebar(e.target.value);
    bindNav();
  };

  const section = container.querySelector('.doc-module');
  const navToggle = container.querySelector('#doc-nav-toggle');
  if (navToggle && section) {
    navToggle.onclick = () => {
      section.classList.toggle('doc-nav-hidden');
      navToggle.textContent = section.classList.contains('doc-nav-hidden') ? 'Browse docs' : 'Hide list';
    };
    if (window.matchMedia('(max-width: 900px)').matches) {
      section.classList.add('doc-nav-hidden');
    }
  }

  await renderPage(current.file, current.title);
}

export function unmount(container) {
  container.innerHTML = '';
}
