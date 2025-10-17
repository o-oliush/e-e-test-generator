(function () {
  const STORAGE_KEY = 'creatio-color-theme';
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    if (toggle) {
      const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);

      const hiddenLabel = toggle.querySelector('.visually-hidden');
      if (hiddenLabel) {
        hiddenLabel.textContent = label;
      }
    }
  }

  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (error) {
      console.warn('Unable to access theme preference from storage', error);
    }
    return null;
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Unable to persist theme preference', error);
    }
  }

  const storedTheme = getStoredTheme();
  const systemPrefersDark = mediaQuery.matches;
  let activeTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');

  applyTheme(activeTheme);

  mediaQuery.addEventListener('change', (event) => {
    const currentStored = getStoredTheme();
    if (currentStored) {
      return;
    }
    const newTheme = event.matches ? 'dark' : 'light';
    activeTheme = newTheme;
    applyTheme(activeTheme);
  });

  if (toggle) {
    toggle.addEventListener('click', () => {
      activeTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(activeTheme);
      setStoredTheme(activeTheme);
    });
  }
})();
