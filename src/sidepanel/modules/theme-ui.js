// Tab Goblin - Theme UI Module
// Handles theme initialization and system theme changes

const ThemeUI = (function() {
  /**
   * Initialize theme from settings
   */
  async function init() {
    try {
      const themeMode = await Settings.getSetting('themeMode');
      const lightPalette = await Settings.getSetting('lightPalette');
      const darkPalette = await Settings.getSetting('darkPalette');

      applyThemeFromSettings(themeMode, lightPalette, darkPalette);

      // Listen for system preference changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
    } catch (error) {
      // Default to system theme on error
      Themes.applyTheme(null);
    }
  }

  /**
   * Apply theme based on mode and palette settings
   */
  function applyThemeFromSettings(themeMode, lightPalette, darkPalette) {
    switch (themeMode) {
      case 'light':
        Themes.applyTheme(lightPalette || 'light');
        break;
      case 'dark':
      case 'custom':
        Themes.applyTheme(darkPalette || 'slate-minimal');
        break;
      case 'system':
      default:
        Themes.applyTheme(null); // Let CSS media query handle it
        break;
    }
  }

  /**
   * Handle system theme preference change
   */
  async function handleSystemThemeChange() {
    const themeMode = await Settings.getSetting('themeMode');
    if (themeMode === 'system') {
      // Re-apply to trigger any necessary updates
      Themes.applyTheme(null);
    }
  }

  // Public API
  return {
    init,
    applyThemeFromSettings,
    handleSystemThemeChange
  };
})();
