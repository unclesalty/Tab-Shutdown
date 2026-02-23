// Tab Goblin - History Module
// Manages recently closed tabs with 24-hour expiration

const HISTORY_KEY = 'tabHistory';
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * History schema:
 * {
 *   tabs: [
 *     {
 *       id: string,
 *       url: string,
 *       title: string,
 *       favIconUrl: string,
 *       closedAt: number (timestamp)
 *     }
 *   ]
 * }
 */

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

/**
 * Get history from storage, filtering out expired entries
 * @returns {Promise<{tabs: Array}>}
 */
async function getHistory() {
  try {
    const result = await chrome.storage.local.get(HISTORY_KEY);
    const history = result[HISTORY_KEY];

    if (!history || !Array.isArray(history.tabs)) {
      return { tabs: [] };
    }

    // Filter out expired tabs
    const now = Date.now();
    const validTabs = history.tabs.filter(tab => {
      return (now - tab.closedAt) < HISTORY_TTL_MS;
    });

    // If we filtered out some tabs, save the cleaned history
    if (validTabs.length !== history.tabs.length) {
      await saveHistory({ tabs: validTabs });
    }

    return { tabs: validTabs };
  } catch (error) {
    console.error('Error reading history:', error);
    return { tabs: [] };
  }
}

/**
 * Save history to storage
 * @param {Object} history
 * @returns {Promise<void>}
 */
async function saveHistory(history) {
  try {
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  } catch (error) {
    console.error('Error saving history:', error);
    throw error;
  }
}

/**
 * Add a tab to history
 * @param {Object} tab - Tab object {url, title, favIconUrl}
 * @returns {Promise<Object|null>} - The added history entry, or null if duplicate
 */
async function addToHistory(tab) {
  const history = await getHistory();
  const url = tab.url || '';

  // Check for duplicate URL - skip if already exists
  const existingEntry = history.tabs.find(t => t.url === url);
  if (existingEntry) {
    return null; // Skip duplicate
  }

  const now = Date.now();

  const entry = {
    id: generateId(),
    url: url,
    title: tab.title || 'Untitled',
    favIconUrl: tab.favIconUrl || '',
    closedAt: now
  };

  // Add to the beginning (most recent first)
  history.tabs.unshift(entry);

  await saveHistory(history);
  return entry;
}

/**
 * Add multiple tabs to history
 * @param {Array} tabs - Array of tab objects {url, title, favIconUrl}
 * @returns {Promise<Array>} - The added history entries
 */
async function addManyToHistory(tabs) {
  const history = await getHistory();
  const now = Date.now();

  const entries = tabs.map(tab => ({
    id: generateId(),
    url: tab.url || '',
    title: tab.title || 'Untitled',
    favIconUrl: tab.favIconUrl || '',
    closedAt: now
  }));

  // Add to the beginning (most recent first)
  history.tabs.unshift(...entries);

  await saveHistory(history);
  return entries;
}

/**
 * Remove a tab from history by ID
 * @param {string} tabId - History tab ID
 * @returns {Promise<boolean>} - True if removed
 */
async function removeFromHistory(tabId) {
  const history = await getHistory();
  const initialLength = history.tabs.length;
  history.tabs = history.tabs.filter(t => t.id !== tabId);

  if (history.tabs.length < initialLength) {
    await saveHistory(history);
    return true;
  }
  return false;
}

/**
 * Remove multiple tabs from history by IDs
 * @param {Array<string>} tabIds - History tab IDs
 * @returns {Promise<number>} - Number of tabs removed
 */
async function removeManyFromHistory(tabIds) {
  const history = await getHistory();
  const tabIdSet = new Set(tabIds);
  const initialLength = history.tabs.length;
  history.tabs = history.tabs.filter(t => !tabIdSet.has(t.id));

  const removed = initialLength - history.tabs.length;
  if (removed > 0) {
    await saveHistory(history);
  }
  return removed;
}

/**
 * Clear all history
 * @returns {Promise<void>}
 */
async function clearHistory() {
  await saveHistory({ tabs: [] });
}

/**
 * Get time remaining before a tab expires
 * @param {Object} tab - History tab with closedAt timestamp
 * @returns {string} - Human readable time remaining
 */
function getTimeRemaining(tab) {
  const now = Date.now();
  const expiresAt = tab.closedAt + HISTORY_TTL_MS;
  const remaining = expiresAt - now;

  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

// Export for use in other modules
const TabHistory = {
  getHistory,
  addToHistory,
  addManyToHistory,
  removeFromHistory,
  removeManyFromHistory,
  clearHistory,
  getTimeRemaining,
  HISTORY_TTL_MS
};

// Make available globally for both window (popup) and service worker contexts
if (typeof window !== 'undefined') {
  window.TabHistory = TabHistory;
}
if (typeof self !== 'undefined') {
  self.TabHistory = TabHistory;
}
