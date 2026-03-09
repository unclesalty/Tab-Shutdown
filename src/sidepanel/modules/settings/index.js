// Tab Goblin - Settings Panel Coordinator
// Orchestrates ThemeSettingsUI, ShortcutUI, DataSettingsUI, and PatternsUI modules

const SettingsPanel = (function() {
  let _onVaultChange = null;
  let _subModulesInitialized = false;

  function init(options) {
    _onVaultChange = options?.onVaultChange || null;

    PatternsUI.init();

    DataSettingsUI.init({
      onVaultChange: _onVaultChange
    });
  }

  /**
   * Render the Settings panel.
   * ThemeSettingsUI and ShortcutUI are initialized on first render because
   * their init() also sets up event listeners. The guard prevents duplicate
   * listeners on subsequent renders.
   */
  async function render() {
    await PatternsUI.render();

    if (!_subModulesInitialized) {
      await ThemeSettingsUI.init();
      await ShortcutUI.init();
      _subModulesInitialized = true;
    } else {
      await ThemeSettingsUI.updateUI();
      await ShortcutUI.updateDisplay();
    }
  }

  // Public API
  return {
    init,
    render
  };
})();
