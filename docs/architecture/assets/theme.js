/**
 * Light / dark theme for architecture docs.
 * Persists to localStorage; respects prefers-color-scheme on first visit.
 */
(function () {
  const STORAGE_KEY = 'knowing-eye-arch-theme';

  function systemTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || systemTheme();
  }

  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    updateToggleLabel(next);
    window.dispatchEvent(new CustomEvent('knowing-eye-theme-change', { detail: { theme: next } }));
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  }

  function updateToggleLabel(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isLight = theme === 'light';
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
    btn.innerHTML = isLight
      ? '<span class="theme-toggle-icon" aria-hidden="true">🌙</span><span class="theme-toggle-text">Dark</span>'
      : '<span class="theme-toggle-icon" aria-hidden="true">☀️</span><span class="theme-toggle-text">Light</span>';
  }

  function injectToggle() {
    const nav = document.querySelector('.site-nav');
    if (!nav || document.getElementById('theme-toggle')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.addEventListener('click', toggleTheme);
    nav.appendChild(btn);
    updateToggleLabel(getTheme());
  }

  applyTheme(getTheme());

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) applyTheme(e.matches ? 'light' : 'dark');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }

  window.KnowingEyeTheme = { getTheme, applyTheme, toggleTheme };
})();
