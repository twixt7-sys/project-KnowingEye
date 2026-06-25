// Theme manager: persists light/dark to localStorage, applies data-theme on <html>.
let SLUG = 'project-os';

export function initTheme(slug, fallback = 'dark') {
  SLUG = slug || SLUG;
  const saved = localStorage.getItem(`${SLUG}:theme`);
  applyTheme(saved || fallback);
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem(`${SLUG}:theme`, theme);
}
