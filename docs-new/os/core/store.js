// DataStore: IndexedDB for editable entities + seed JSON import + localStorage prefs.
// Project-agnostic. Configure entirely through the constructor options.

import { fetchJson } from './utils.js';
import { fetchDocMainHtml } from './doc-content.js';

// Maps an IndexedDB object store -> seed file + the array property holding rows.
const SEED_MAP = {
  tasks: { file: 'tasks.json', prop: 'tasks' },
  wbs_nodes: { file: 'wbs.json', prop: 'nodes' },
  gantt_tasks: { file: 'gantt.json', prop: 'tasks' },
  milestones: { file: 'milestones.json', prop: 'milestones' },
  risks: { file: 'risks.json', prop: 'risks' },
  team: { file: 'team.json', prop: 'members' },
};

const STORES = [
  'tasks',
  'wbs_nodes',
  'gantt_tasks',
  'milestones',
  'risks',
  'team',
  'doc_pages',
  'activity_log',
  'meta',
];

const DB_VERSION = 2;

export class DataStore {
  constructor({ slug, seedVersion = 1, seedBase = 'os/data/seed/' } = {}) {
    this.slug = slug || 'project-os';
    this.dbName = `${this.slug}-project-os`;
    this.seedVersion = seedVersion;
    this.seedBase = seedBase;
    this.db = null;
    this._seedCache = new Map();
  }

  // ---------- localStorage prefs ----------
  key(name) {
    return `${this.slug}:${name}`;
  }
  getPref(name, fallback = null) {
    const v = localStorage.getItem(this.key(name));
    return v === null ? fallback : v;
  }
  setPref(name, value) {
    localStorage.setItem(this.key(name), value);
  }

  // ---------- IndexedDB ----------
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            const keyPath = name === 'activity_log' ? 'seq' : name === 'meta' ? 'key' : 'id';
            const opts = name === 'activity_log' ? { keyPath, autoIncrement: true } : { keyPath };
            db.createObjectStore(name, opts);
          }
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  _tx(store, mode = 'readonly') {
    return this.db.transaction(store, mode).objectStore(store);
  }

  getAll(store) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  get(store, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  put(store, obj) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').put(obj);
      req.onsuccess = () => resolve(obj);
      req.onerror = () => reject(req.error);
    });
  }

  bulkPut(store, rows) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      for (const r of rows) os.put(r);
      tx.oncomplete = () => resolve(rows.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  delete(store, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  clear(store) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- seed ----------
  async getSeed(file) {
    if (this._seedCache.has(file)) return this._seedCache.get(file);
    const data = await fetchJson(this.seedBase + file);
    this._seedCache.set(file, data);
    return data;
  }

  async _metaGet(key) {
    return (await this.get('meta', key))?.value;
  }
  async _metaSet(key, value) {
    return this.put('meta', { key, value });
  }

  // Public meta accessors (editable project-level info that overrides seed).
  async getMeta(key, fallback = null) {
    const v = await this._metaGet(key);
    return v === undefined ? fallback : v;
  }
  async setMeta(key, value) {
    await this._metaSet(key, value);
    return value;
  }

  // Editable project info: seed defaults from project.json, overridable in IndexedDB.
  async getProjectInfo() {
    const seed = await this.getSeed('project.json').catch(() => ({}));
    const override = (await this._metaGet('project_info')) || {};
    return { ...seed, ...override };
  }
  async saveProjectInfo(patch) {
    const current = (await this._metaGet('project_info')) || {};
    const merged = { ...current, ...patch };
    await this._metaSet('project_info', merged);
    return merged;
  }

  // Editable team-level info (advisor, team_name).
  async getTeamInfo() {
    const seed = await this.getSeed('team.json').catch(() => ({}));
    const override = (await this._metaGet('team_info')) || {};
    return {
      team_name: override.team_name ?? seed.team_name ?? '',
      advisor: { ...(seed.advisor || {}), ...(override.advisor || {}) },
    };
  }
  async saveTeamInfo(patch) {
    const current = (await this._metaGet('team_info')) || {};
    const merged = { ...current, ...patch };
    await this._metaSet('team_info', merged);
    return merged;
  }

  async importSeedIfNeeded() {
    const prior = await this._metaGet('seed_version');
    if (prior === this.seedVersion) return { imported: false };
    // First load (no prior version) → merge by id. Version bump → full reseed of
    // seed-owned stores (intentional dataset update; local edits in those stores
    // are replaced - use Settings → Export beforehand to keep them).
    const firstLoad = prior === undefined;
    for (const [store, { file, prop }] of Object.entries(SEED_MAP)) {
      let seed;
      try {
        seed = await this.getSeed(file);
      } catch (err) {
        console.warn(`[store] could not load seed ${file}`, err);
        continue;
      }
      const rows = seed[prop] || [];
      if (firstLoad) {
        const existing = await this.getAll(store);
        const have = new Set(existing.map((r) => r.id));
        const toAdd = rows.filter((r) => !have.has(r.id));
        if (toAdd.length) await this.bulkPut(store, toAdd);
      } else {
        await this.clear(store);
        if (rows.length) await this.bulkPut(store, rows);
      }
    }
    if (!firstLoad) {
      // Refresh editable project/team info from the new seed on reseed.
      await this.delete('meta', 'project_info');
      await this.delete('meta', 'team_info');
    }
    await this._metaSet('seed_version', this.seedVersion);
    this.setPref('seed_version', String(this.seedVersion));
    return { imported: true };
  }

  async resetToSeed() {
    for (const store of Object.keys(SEED_MAP)) await this.clear(store);
    await this.clear('doc_pages');
    await this.delete('meta', 'seed_version');
    await this.delete('meta', 'project_info');
    await this.delete('meta', 'team_info');
    this._seedCache.clear();
    await this.importSeedIfNeeded();
    return true;
  }

  // ---------- editable documentation ----------
  async getDocPage(file) {
    const row = await this.get('doc_pages', file);
    if (row?.html) return row;
    return this.bootstrapDocPage(file);
  }

  async bootstrapDocPage(file) {
    const html = await fetchDocMainHtml(file);
    const row = {
      id: file,
      file,
      html,
      source: 'static',
      updated_at: new Date().toISOString(),
    };
    await this.put('doc_pages', row);
    return row;
  }

  async saveDocPage(file, html) {
    const row = {
      id: file,
      file,
      html,
      source: 'edited',
      updated_at: new Date().toISOString(),
    };
    await this.put('doc_pages', row);
    return row;
  }

  async resetDocPage(file) {
    await this.delete('doc_pages', file);
    return this.bootstrapDocPage(file);
  }

  // ---------- activity ----------
  async log(action, detail = '') {
    try {
      await this.put('activity_log', { ts: new Date().toISOString(), action, detail });
    } catch {
      /* activity log is best-effort */
    }
  }
  async recentActivity(limit = 12) {
    const all = await this.getAll('activity_log');
    return all.sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, limit);
  }

  // ---------- backup ----------
  async exportAll() {
    const dump = { dbName: this.dbName, exported_at: new Date().toISOString(), seed_version: this.seedVersion, stores: {} };
    for (const store of STORES) {
      if (store === 'meta') continue;
      dump.stores[store] = await this.getAll(store);
    }
    return dump;
  }

  async importBackup(dump) {
    if (!dump || !dump.stores) throw new Error('Invalid backup file');
    for (const [store, rows] of Object.entries(dump.stores)) {
      if (!STORES.includes(store)) continue;
      if (store === 'activity_log') continue;
      await this.clear(store);
      if (rows.length) await this.bulkPut(store, rows);
    }
    return true;
  }
}
