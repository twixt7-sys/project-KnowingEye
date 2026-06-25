// Plugin registry: dynamic import() of enabled module plugins. Project-agnostic.

export class PluginRegistry {
  constructor({ baseUrl = './' } = {}) {
    this.baseUrl = baseUrl;
    this.modules = new Map(); // id -> module config
    this.loaded = new Map(); // id -> module exports
    this.active = null; // { id, exports, container }
  }

  register(configList) {
    for (const m of configList) {
      if (m.enabled !== false) this.modules.set(m.id, m);
    }
  }

  has(id) {
    return this.modules.has(id);
  }

  list() {
    return [...this.modules.values()];
  }

  async load(id, cacheKey = '') {
    if (this.loaded.has(id)) return this.loaded.get(id);
    const cfg = this.modules.get(id);
    if (!cfg) throw new Error(`Unknown module: ${id}`);
    const q = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : '';
    const path = new URL(cfg.path.replace(/^\.\//, '') + q, new URL(this.baseUrl, location.href)).href;
    const mod = await import(path);
    this.loaded.set(id, mod);
    return mod;
  }

  async mount(id, container, context) {
    if (this.active) await this.unmount();
    const ver = context?.config?.project?.seed_version || '';
    const mod = await this.load(id, ver);
    container.innerHTML = '';
    await mod.mount(container, context);
    this.active = { id, exports: mod, container };
    return mod;
  }

  async unmount() {
    if (!this.active) return;
    const { exports, container } = this.active;
    try {
      if (typeof exports.unmount === 'function') exports.unmount(container);
      else container.innerHTML = '';
    } catch (err) {
      console.warn('[registry] unmount error', err);
    }
    this.active = null;
  }
}
