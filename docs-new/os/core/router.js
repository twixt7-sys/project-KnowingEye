// Hash router: #/module, #/documents/section/page. Project-agnostic.

export class Router {
  constructor({ fallback = 'dashboard', onRoute } = {}) {
    this.fallback = fallback;
    this.onRoute = onRoute;
    this._handler = () => this._resolve();
  }

  start() {
    window.addEventListener('hashchange', this._handler);
    this._resolve();
  }

  stop() {
    window.removeEventListener('hashchange', this._handler);
  }

  parse(hash) {
    const raw = (hash || location.hash || '').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    const moduleId = parts[0] || this.fallback;
    return { moduleId, params: parts.slice(1), raw };
  }

  current() {
    return this.parse(location.hash);
  }

  navigate(moduleId, ...params) {
    location.hash = `#/${[moduleId, ...params].join('/')}`;
  }

  _resolve() {
    const route = this.parse(location.hash);
    if (this.onRoute) this.onRoute(route);
  }
}
