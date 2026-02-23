// Tab Goblin - Themes Module
// Defines theme configurations for the extension
// Note: Actual colors are defined in CSS via [data-theme="..."] selectors.
// This module only tracks theme metadata for the UI.

/**
 * Theme definitions
 * Colors are defined in CSS (sidepanel.css), not here.
 */
const THEMES = {
  // Default light theme
  'light': {
    name: 'Light',
    type: 'light'
  },
  // Light theme palettes
  'sunrise-citrus': {
    name: 'Sunrise Citrus',
    type: 'light'
  },
  'ocean-breeze': {
    name: 'Ocean Breeze',
    type: 'light'
  },
  'forest-moss': {
    name: 'Forest Moss',
    type: 'light'
  },
  'lavender-mist': {
    name: 'Lavender Mist',
    type: 'light'
  },
  'warm-slate': {
    name: 'Warm Slate',
    type: 'light'
  },
  // Dark theme palettes
  'midnight-glass': {
    name: 'Midnight Glass',
    type: 'dark'
  },
  'neon-ember': {
    name: 'Neon Ember',
    type: 'dark'
  },
  'soft-lavender': {
    name: 'Soft Lavender',
    type: 'dark'
  },
  'arctic-mint': {
    name: 'Arctic Mint',
    type: 'dark'
  },
  'slate-minimal': {
    name: 'Slate Minimal',
    type: 'dark'
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
 * Get all light themes (excluding default 'light')
 * @returns {Object[]} Array of light theme palette objects with keys
 */
function getLightThemes() {
  return Object.entries(THEMES)
    .filter(([key, theme]) => theme.type === 'light' && key !== 'light')
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
  getLightThemes,
  applyTheme
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Themes = Themes;
}
if (typeof self !== 'undefined') {
  self.Themes = Themes;
}
