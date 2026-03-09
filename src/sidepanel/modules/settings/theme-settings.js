// Tab Goblin - Theme Settings UI Module
// Handles theme mode and palette selection in Settings panel

const ThemeSettingsUI = (function() {
  /**
   * Initialize theme settings UI
   */
  async function init() {
    await updateUI();
    setupEventListeners();
  }

  /**
   * Set up event listeners for theme controls
   */
  function setupEventListeners() {
    // Theme mode selection
    document.querySelectorAll('input[name="themeMode"]').forEach(radio => {
      radio.addEventListener('change', handleThemeModeChange);
    });

    // Light palette selection
    document.querySelectorAll('#lightPaletteSelector .palette-btn').forEach(btn => {
      btn.addEventListener('click', () => handlePaletteChange(btn.dataset.palette, 'light'));
    });

    // Dark palette selection
    document.querySelectorAll('#darkPaletteSelector .palette-btn').forEach(btn => {
      btn.addEventListener('click', () => handlePaletteChange(btn.dataset.palette, 'dark'));
    });
  }

  /**
   * Update UI from current settings
   */
  async function updateUI() {
    const themeMode = await Settings.getSetting('themeMode') || 'system';
    const lightPalette = await Settings.getSetting('lightPalette') || 'light';
    const darkPalette = await Settings.getSetting('darkPalette') || 'slate-minimal';

    // Set radio button
    const radio = document.querySelector(`input[name="themeMode"][value="${themeMode}"]`);
    if (radio) radio.checked = true;

    // Show/hide palette selectors
    const lightPaletteSelector = document.getElementById('lightPaletteSelector');
    const darkPaletteSelector = document.getElementById('darkPaletteSelector');

    lightPaletteSelector.classList.add('hidden');
    darkPaletteSelector.classList.add('hidden');

    if (themeMode === 'dark') {
      darkPaletteSelector.classList.remove('hidden');
    } else if (themeMode === 'light') {
      lightPaletteSelector.classList.remove('hidden');
    }

    // Set active palettes
    lightPaletteSelector.querySelectorAll('.palette-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.palette === lightPalette);
    });
    darkPaletteSelector.querySelectorAll('.palette-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.palette === darkPalette);
    });
  }

  /**
   * Handle theme mode radio button change
   */
  async function handleThemeModeChange(e) {
    const mode = e.target.value;
    await Settings.updateSetting('themeMode', mode);

    const lightPaletteSelector = document.getElementById('lightPaletteSelector');
    const darkPaletteSelector = document.getElementById('darkPaletteSelector');

    // Hide both selectors first
    lightPaletteSelector.classList.add('hidden');
    darkPaletteSelector.classList.add('hidden');

    if (mode === 'dark') {
      // Show dark palette selector
      darkPaletteSelector.classList.remove('hidden');
      const currentPalette = await Settings.getSetting('darkPalette') || 'slate-minimal';
      Themes.applyTheme(currentPalette);
    } else if (mode === 'light') {
      // Show light palette selector
      lightPaletteSelector.classList.remove('hidden');
      const currentPalette = await Settings.getSetting('lightPalette') || 'light';
      Themes.applyTheme(currentPalette);
    } else {
      // System mode
      Themes.applyTheme(null);
    }
  }

  /**
   * Handle palette button click
   */
  async function handlePaletteChange(palette, paletteType) {
    // Determine which selector contains this palette
    const selectorId = paletteType === 'light' ? 'lightPaletteSelector' : 'darkPaletteSelector';
    const settingKey = paletteType === 'light' ? 'lightPalette' : 'darkPalette';

    // Update active state within that selector only
    const selector = document.getElementById(selectorId);
    selector.querySelectorAll('.palette-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.palette === palette);
    });

    // Save and apply
    await Settings.updateSetting(settingKey, palette);
    Themes.applyTheme(palette);
  }

  // Public API
  return {
    init,
    updateUI
  };
})();
