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

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle light and dark mode');
    btn.addEventListener('click', toggleTheme);
    return btn;
  }

  function updateToggleLabel(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isLight = theme === 'light';
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
    btn.innerHTML = isLight
      ? `<span class="theme-toggle-icon" aria-hidden="true">${iconMoon()}</span><span class="theme-toggle-text">Dark mode</span>`
      : `<span class="theme-toggle-icon" aria-hidden="true">${iconSun()}</span><span class="theme-toggle-text">Light mode</span>`;
  }

  function iconSun() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  }

  function iconMoon() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  function injectToggle() {
    if (document.getElementById('theme-toggle')) return;

    const nav = document.querySelector('.site-nav');
    const btn = createToggleButton();

    if (nav) {
      nav.appendChild(btn);
    } else {
      btn.classList.add('theme-toggle-floating');
      document.body.appendChild(btn);
    }

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
