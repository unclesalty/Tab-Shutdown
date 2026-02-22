// Tab Goblin - Settings Module
// Manages user preferences

const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS = {
  skipShutdownAllConfirm: false,
  skipLargeRestoreConfirm: false,
  onboardingComplete: false,
  themeMode: 'system',      // 'system' | 'light' | 'dark' | 'custom'
  themePalette: 'slate-minimal'  // Theme key for dark/custom modes
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
 * Save settings
 * @param {Object} settings
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * Update a single setting
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
async function updateSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await saveSettings(settings);
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
