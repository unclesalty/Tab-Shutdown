// Tab Goblin - Settings Module
// Manages user preferences

const SETTINGS_KEY = 'settings';

// Concurrency lock for read-modify-write operations
let _settingsLock = null;

/**
 * Execute an operation with exclusive access to settings storage
 * Prevents race conditions in read-modify-write operations
 * @param {Function} operation - Async function to execute
 * @returns {Promise} Result of the operation
 */
async function withSettingsLock(operation) {
  // Wait for any existing lock to release
  while (_settingsLock) {
    await _settingsLock;
  }

  // Create a new lock
  let resolve;
  _settingsLock = new Promise(r => { resolve = r; });

  try {
    return await operation();
  } finally {
    resolve();
    _settingsLock = null;
  }
}

const DEFAULT_SETTINGS = {
  skipShutdownAllConfirm: false,
  skipLargeRestoreConfirm: false,
  onboardingComplete: false,
  themeMode: 'system',         // 'system' | 'light' | 'dark'
  lightPalette: 'light',       // Theme key for light mode
  darkPalette: 'slate-minimal', // Theme key for dark mode
  liveTabsView: 'grouped'      // 'grouped' | 'ungrouped'
};

/**
 * Get all settings
 * @returns {Promise<Object>}
 */
async function getSettings() {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  } catch (error) {
    console.error('Error reading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings (internal, no lock)
 * @param {Object} settings
 * @returns {Promise<void>}
 */
async function _saveSettings(settings) {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * Save settings with lock protection
 * @param {Object} settings
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  return withSettingsLock(async () => {
    await _saveSettings(settings);
  });
}

/**
 * Update a single setting
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
async function updateSetting(key, value) {
  return withSettingsLock(async () => {
    const settings = await getSettings();
    settings[key] = value;
    await _saveSettings(settings);
  });
}

/**
 * Get a single setting
 * @param {string} key
 * @returns {Promise<any>}
 */
async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

// Export for use in other modules
const Settings = {
  getSettings,
  saveSettings,
  updateSetting,
  getSetting
};

// Make available globally for both window (popup) and service worker contexts
if (typeof window !== 'undefined') {
  window.Settings = Settings;
}
if (typeof self !== 'undefined') {
  self.Settings = Settings;
}
