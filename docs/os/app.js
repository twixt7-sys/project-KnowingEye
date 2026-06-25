// Project OS bootstrap: load config, init store/router/registry, render shell chrome.
import { DataStore } from './core/store.js?v=6';
import { Router } from './core/router.js?v=6';
import { PluginRegistry } from './core/plugin-registry.js?v=6';
import { createEventBus } from './core/events.js?v=6';
import * as utils from './core/utils.js?v=6';
import { initTheme, setTheme, currentTheme } from './assets/theme.js?v=6';

const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  'check-square': 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  timeline: 'M3 5h12M3 12h18M3 19h8M17 9l3 3-3 3',
  tree: 'M5 3v6m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 4v8m0 0h6m8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 2v3a2 2 0 0 1-2 2h-4',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  flask: 'M9 2v6L4 18a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 18L15 8V2M8 2h8M7 14h10',
  'file-text': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

function iconSvg(name) {
  const path = ICONS[name] || ICONS.grid;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

const app = {
  async start() {
    let config;
    try {
      config = await utils.fetchJson('os/config/project.json');
    } catch (err) {
      // deploy.bat may open the browser before the server is listening
      await new Promise((r) => setTimeout(r, 600));
      try {
        config = await utils.fetchJson('os/config/project.json');
      } catch (err2) {
        this.fatal('Could not load os/config/project.json', err2);
        return;
      }
    }

    const slug = config.project?.slug || 'project-os';
    const events = createEventBus();
    const store = new DataStore({ slug, seedVersion: config.project?.seed_version || 1 });

    initTheme(slug, config.theme?.default || 'dark');

    try {
      await store.open();
      const res = await store.importSeedIfNeeded();
      this.setSync(res.imported ? 'Synced from repo' : 'Local data', 'ok');
    } catch (err) {
      console.warn('Store init failed', err);
      this.setSync('Storage unavailable', 'warn');
    }

    const enabled = (config.modules || []).filter((m) => m.enabled !== false);
    const registry = new PluginRegistry({ baseUrl: 'os/' });
    registry.register(enabled);

    const router = new Router({
      fallback: config.modules?.[0]?.id || 'dashboard',
      onRoute: (route) => this.handleRoute(route),
    });

    this.ctx = { store, router, config, events, utils, registry, icon: iconSvg };
    this.renderSidebar(enabled, config);
    this.bindChrome();
    this.renderFooter(config);

    router.start();
  },

  renderSidebar(modules, config) {
    const nav = document.getElementById('module-nav');
    nav.innerHTML = '';
    for (const m of modules) {
      const a = utils.el('a', {
        href: `#/${m.id}`,
        class: 'nav-item',
        'data-module': m.id,
      });
      a.innerHTML = `<span class="nav-icon">${iconSvg(m.icon)}</span><span class="nav-label">${utils.escapeHtml(m.label)}</span>`;
      nav.append(a);
    }
    nav.addEventListener('click', (e) => {
      if (e.target.closest('.nav-item')) this.closeSidebar();
    });
    document.querySelector('.sidebar-docs')?.addEventListener('click', (e) => {
      if (e.target.closest('a')) this.closeSidebar();
    });
    const brand = document.querySelector('.sidebar-brand strong');
    if (brand) brand.textContent = config.project?.title || 'Project OS';
  },

  closeSidebar() {
    const shell = document.getElementById('app');
    if (!shell?.classList.contains('sidebar-open')) return;
    shell.classList.remove('sidebar-open');
    document.getElementById('sidebar-backdrop')?.setAttribute('aria-hidden', 'true');
    document.getElementById('btn-sidebar')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-open-body');
  },

  openSidebar() {
    const shell = document.getElementById('app');
    shell?.classList.add('sidebar-open');
    document.getElementById('sidebar-backdrop')?.setAttribute('aria-hidden', 'false');
    document.getElementById('btn-sidebar')?.setAttribute('aria-expanded', 'true');
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('sidebar-open-body');
    }
  },

  toggleSidebar() {
    const shell = document.getElementById('app');
    if (shell?.classList.contains('sidebar-open')) this.closeSidebar();
    else this.openSidebar();
  },

  bindChrome() {
    const { store } = this.ctx;

    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const dump = await store.exportAll();
        utils.downloadBlob(`${store.slug}-backup.json`, JSON.stringify(dump, null, 2));
        utils.toast('Exported all local data', 'ok');
      });
    }

    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        setTheme(next);
        this.ctx.events.emit('theme:change', next);
      });
    }

    const toggle = document.getElementById('btn-sidebar');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSidebar();
      });
    }

    const closeBtn = document.getElementById('btn-sidebar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSidebar();
      });
    }

    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeSidebar());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeSidebar();
    });

    window.matchMedia('(max-width: 900px)').addEventListener('change', (e) => {
      if (!e.matches) this.closeSidebar();
    });

    // restore last route
    const last = store.getPref('last_route');
    if (last && !location.hash) location.hash = last;
  },

  async handleRoute(route) {
    this.closeSidebar();
    const { registry, router, store } = this.ctx;
    const viewport = document.getElementById('module-viewport');
    let id = route.moduleId;
    if (!registry.has(id)) id = router.fallback;

    // active state in sidebar
    utils.$$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.module === id));
    this.setBreadcrumb(id, route.params);
    store.setPref('last_route', `#/${route.raw || id}`);

    try {
      await registry.mount(id, viewport, { ...this.ctx, route });
    } catch (err) {
      console.error(err);
      viewport.innerHTML = `<section class="module-page"><div class="empty-state"><h2>Module failed to load</h2><p>${utils.escapeHtml(id)} - ${utils.escapeHtml(err.message)}</p></div></section>`;
    }
  },

  setBreadcrumb(id, params) {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    const mod = this.ctx.registry.modules.get(id);
    const parts = [`<span class="crumb-root">Project OS</span>`, `<span class="crumb">${utils.escapeHtml(mod?.label || id)}</span>`];
    if (params?.length) parts.push(`<span class="crumb crumb-sub">${utils.escapeHtml(params.join(' / '))}</span>`);
    bc.innerHTML = parts.join('<span class="crumb-sep">›</span>');
  },

  setSync(text, kind = 'ok') {
    const badge = document.getElementById('sync-status');
    if (!badge) return;
    badge.textContent = text;
    badge.className = `sync-badge sync-${kind}`;
  },

  renderFooter(config) {
    const info = document.getElementById('deploy-info');
    if (info) {
      const host = config.deployment?.hosting || 'static';
      info.textContent = `${config.version_label || ''} · ${host}`;
    }
    const ver = document.querySelector('.shell-footer .footer-version');
    if (ver) ver.textContent = config.version_label || '';
  },

  fatal(msg, err) {
    const viewport = document.getElementById('module-viewport');
    if (viewport) {
      viewport.innerHTML = `<section class="module-page"><div class="empty-state"><h2>${utils.escapeHtml(msg)}</h2><p>${utils.escapeHtml(err?.message || '')}</p><p class="muted">Serve this folder over HTTP (e.g. <code>./deploy.sh</code>) - opening index.html via file:// blocks module imports and fetch.</p></div></section>`;
    }
    console.error(msg, err);
  },
};

window.addEventListener('DOMContentLoaded', () => app.start());
