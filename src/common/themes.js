// Tab Goblin - Themes Module
// Defines theme configurations for the extension

/**
 * Theme definitions
 * Each theme contains colors for all UI elements
 */
const THEMES = {
  'light': {
    name: 'Light',
    type: 'light',
    colors: {
      bg: '#ffffff',
      bgSurface: '#f9f9f9',
      bgHover: '#f5f5f5',
      primary: '#4A90D9',
      primaryHover: '#3a7bc8',
      accent: '#4A90D9',
      text: '#333333',
      textSecondary: '#666666',
      textOnPrimary: '#ffffff',
      border: '#e0e0e0',
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107'
    }
  },
  'midnight-glass': {
    name: 'Midnight Glass',
    type: 'dark',
    colors: {
      bg: '#0f172a',
      bgSurface: '#1e293b',
      bgHover: '#334155',
      primary: '#0ea5e9',
      primaryHover: '#0284c7',
      accent: '#7dd3fc',
      text: '#e2e8f0',
      textSecondary: '#64748b',
      textOnPrimary: '#ffffff',
      border: '#334155',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  },
  'neon-ember': {
    name: 'Neon Ember',
    type: 'dark',
    colors: {
      bg: '#0c0a09',
      bgSurface: '#292524',
      bgHover: '#44403c',
      primary: '#f97316',
      primaryHover: '#ea580c',
      accent: '#fb923c',
      text: '#fafaf9',
      textSecondary: '#78716c',
      textOnPrimary: '#ffffff',
      border: '#44403c',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  },
  'soft-lavender': {
    name: 'Soft Lavender',
    type: 'dark',
    colors: {
      bg: '#13111f',
      bgSurface: '#2e2a45',
      bgHover: '#3d3760',
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      accent: '#c4b5fd',
      text: '#f5f3ff',
      textSecondary: '#6b6591',
      textOnPrimary: '#ffffff',
      border: '#3d3760',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  },
  'arctic-mint': {
    name: 'Arctic Mint',
    type: 'dark',
    colors: {
      bg: '#091415',
      bgSurface: '#1a2e30',
      bgHover: '#264548',
      primary: '#10b981',
      primaryHover: '#059669',
      accent: '#6ee7b7',
      text: '#ecfdf5',
      textSecondary: '#5e8a7a',
      textOnPrimary: '#ffffff',
      border: '#264548',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  },
  'slate-minimal': {
    name: 'Slate Minimal',
    type: 'dark',
    colors: {
      bg: '#09090b',
      bgSurface: '#27272a',
      bgHover: '#3f3f46',
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      accent: '#a5b4fc',
      text: '#fafafa',
      textSecondary: '#71717a',
      textOnPrimary: '#ffffff',
      border: '#3f3f46',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b'
    }
  }
};

/**
 * Get a theme by key
 * @param {string} themeKey - The theme identifier
 * @returns {Object|null} Theme object or null if not found
 */
function getTheme(themeKey) {
  return THEMES[themeKey] || null;
}

/**
 * Get all theme keys
 * @returns {string[]} Array of theme keys
 */
function getThemeKeys() {
  return Object.keys(THEMES);
}

/**
 * Get all dark themes
 * @returns {Object[]} Array of dark theme objects with keys
 */
function getDarkThemes() {
  return Object.entries(THEMES)
    .filter(([, theme]) => theme.type === 'dark')
    .map(([key, theme]) => ({ key, ...theme }));
}

/**
 * Apply a theme to the document
 * @param {string} themeKey - The theme to apply, or null for system default
 */
function applyTheme(themeKey) {
  if (!themeKey || themeKey === 'system') {
    // Remove data-theme to use CSS media query defaults
    document.documentElement.removeAttribute('data-theme');
    return;
  }

  const theme = getTheme(themeKey);
  if (!theme) {
    document.documentElement.removeAttribute('data-theme');
    return;
  }

  document.documentElement.setAttribute('data-theme', themeKey);
}

// Export for use in other modules
const Themes = {
  THEMES,
  getTheme,
  getThemeKeys,
  getDarkThemes,
  applyTheme
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Themes = Themes;
}
if (typeof self !== 'undefined') {
  self.Themes = Themes;
}
