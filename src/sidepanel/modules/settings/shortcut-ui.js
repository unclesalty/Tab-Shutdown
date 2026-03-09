// Tab Goblin - Shortcut UI Module
// Handles keyboard shortcut display in Settings panel

const ShortcutUI = (function() {
  /**
   * Initialize shortcut UI
   */
  async function init() {
    await updateDisplay();
    setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    document.getElementById('configureShortcutBtn').addEventListener('click', openConfig);
  }

  /**
   * Detect if running on macOS
   */
  function isMacOS() {
    return /mac/i.test(navigator.platform);
  }

  /**
   * Format a shortcut string for OS-appropriate display
   */
  function formatShortcutForOS(shortcut) {
    if (!shortcut) return null;

    if (isMacOS()) {
      return shortcut.replace(/Ctrl|Command/gi, 'Cmd');
    }
    return shortcut.replace(/Command/gi, 'Ctrl');
  }

  /**
   * Get the current configured shortcut
   */
  async function getCurrentShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
      return actionCommand?.shortcut || null;
    } catch {
      return null;
    }
  }

  /**
   * Update the shortcut display in settings
   */
  async function updateDisplay() {
    const shortcutKeysEl = document.getElementById('shortcutKeys');
    if (!shortcutKeysEl) return;

    // Clear existing content
    UIHelpers.clearContainer(shortcutKeysEl);

    const shortcut = await getCurrentShortcut();

    if (!shortcut) {
      const notSetSpan = document.createElement('span');
      notSetSpan.className = 'shortcut-not-set';
      notSetSpan.textContent = 'Not set';
      shortcutKeysEl.appendChild(notSetSpan);
      return;
    }

    const formatted = formatShortcutForOS(shortcut);
    const keys = formatted.split('+');

    // Create key elements using safe DOM methods
    keys.forEach((key, index) => {
      if (index > 0) {
        const plusSpan = document.createElement('span');
        plusSpan.className = 'shortcut-plus';
        plusSpan.textContent = '+';
        shortcutKeysEl.appendChild(plusSpan);
      }

      const keySpan = document.createElement('span');
      keySpan.className = 'shortcut-key';
      keySpan.textContent = key;
      shortcutKeysEl.appendChild(keySpan);
    });
  }

  /**
   * Open Chrome's keyboard shortcut configuration page
   */
  async function openConfig() {
    try {
      await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } catch (error) {
      UIHelpers.showToast('Could not open shortcut settings', 'error');
    }
  }

  // Public API
  return {
    init,
    updateDisplay,
    isMacOS,
    formatShortcutForOS,
    getCurrentShortcut,
    openConfig
  };
})();
