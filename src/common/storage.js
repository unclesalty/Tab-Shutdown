// Tab Goblin - Storage Module
// Manages vault data persistence using chrome.storage.local

/**
 * Vault schema:
 * {
 *   groups: [
 *     {
 *       id: string,
 *       name: string,
 *       createdAt: number (timestamp),
 *       tabs: [
 *         {
 *           id: string,
 *           url: string,
 *           title: string,
 *           favIconUrl: string,
 *           vaultedAt: number (timestamp)
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

const VAULT_KEY = 'vault';

// Concurrency lock for read-modify-write operations
let _storageLock = null;

/**
 * Execute an operation with exclusive access to storage
 * Prevents race conditions in read-modify-write operations
 * @param {Function} operation - Async function to execute
 * @returns {Promise} Result of the operation
 */
async function withLock(operation) {
  // Wait for any existing lock to release
  while (_storageLock) {
    await _storageLock;
  }

  // Create a new lock
  let resolve;
  _storageLock = new Promise(r => { resolve = r; });

  try {
    return await operation();
  } finally {
    resolve();
    _storageLock = null;
  }
}

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

/**
 * Get the full vault object from storage
 * @returns {Promise<{groups: Array}>}
 */
async function getVault() {
  try {
    const result = await chrome.storage.local.get(VAULT_KEY);
    if (result[VAULT_KEY] && typeof result[VAULT_KEY] === 'object' && Array.isArray(result[VAULT_KEY].groups)) {
      return result[VAULT_KEY];
    }
    return { groups: [] };
  } catch (error) {
    console.error('Error reading vault:', error);
    return { groups: [] };
  }
}

/**
 * Save the full vault object to storage
 * @param {Object} vault
 * @returns {Promise<void>}
 */
async function saveVault(vault) {
  try {
    await chrome.storage.local.set({ [VAULT_KEY]: vault });
  } catch (error) {
    console.error('Error saving vault:', error);
    throw error;
  }
}

/**
 * Create a new group with tabs
 * @param {string} name - Group name
 * @param {Array} tabs - Array of tab objects {url, title, favIconUrl}
 * @returns {Promise<Object>} - The created group
 */
async function addGroup(name, tabs = []) {
  return withLock(async () => {
    const vault = await getVault();
    const now = Date.now();

    const group = {
      id: generateId(),
      name: name,
      createdAt: now,
      tabs: tabs.map(tab => ({
        id: generateId(),
        url: tab.url || '',
        title: tab.title || 'Untitled',
        favIconUrl: tab.favIconUrl || '',
        vaultedAt: now
      }))
    };

    vault.groups.push(group);
    await saveVault(vault);
    return group;
  });
}

/**
 * Remove a group by ID
 * @param {string} groupId
 * @returns {Promise<boolean>} - True if removed
 */
async function removeGroup(groupId) {
  return withLock(async () => {
    const vault = await getVault();
    const initialLength = vault.groups.length;
    vault.groups = vault.groups.filter(g => g.id !== groupId);

    if (vault.groups.length < initialLength) {
      await saveVault(vault);
      return true;
    }
    return false;
  });
}

/**
 * Add tabs to an existing group
 * @param {string} groupId
 * @param {Array} tabs - Array of tab objects {url, title, favIconUrl}
 * @returns {Promise<Object|null>} - The updated group or null if not found
 */
async function addTabsToGroup(groupId, tabs) {
  return withLock(async () => {
    const vault = await getVault();
    const group = vault.groups.find(g => g.id === groupId);

    if (!group) {
      return null;
    }

    const now = Date.now();
    const newTabs = tabs.map(tab => ({
      id: generateId(),
      url: tab.url || '',
      title: tab.title || 'Untitled',
      favIconUrl: tab.favIconUrl || '',
      vaultedAt: now
    }));

    group.tabs.push(...newTabs);
    await saveVault(vault);
    return group;
  });
}

/**
 * Remove specific tabs from a group
 * @param {string} groupId
 * @param {Array<string>} tabIds - Array of tab IDs to remove
 * @returns {Promise<Object|null>} - The updated group or null if not found
 */
async function removeTabsFromGroup(groupId, tabIds) {
  return withLock(async () => {
    const vault = await getVault();
    const group = vault.groups.find(g => g.id === groupId);

    if (!group) {
      return null;
    }

    const tabIdSet = new Set(tabIds);
    group.tabs = group.tabs.filter(t => !tabIdSet.has(t.id));
    await saveVault(vault);
    return group;
  });
}

/**
 * Get a specific group by ID
 * @param {string} groupId
 * @returns {Promise<Object|null>}
 */
async function getGroup(groupId) {
  const vault = await getVault();
  return vault.groups.find(g => g.id === groupId) || null;
}

/**
 * Update a group's properties
 * @param {string} groupId
 * @param {Object} updates - Properties to update (name, etc.)
 * @returns {Promise<Object|null>}
 */
async function updateGroup(groupId, updates) {
  return withLock(async () => {
    const vault = await getVault();
    const group = vault.groups.find(g => g.id === groupId);

    if (!group) {
      return null;
    }

    if (updates.name !== undefined) {
      group.name = updates.name;
    }

    await saveVault(vault);
    return group;
  });
}

/**
 * Reorder groups by moving a group from one index to another
 * @param {number} fromIndex - Current index of the group
 * @param {number} toIndex - Target index for the group
 * @returns {Promise<boolean>} - True if reordered
 */
async function reorderGroups(fromIndex, toIndex) {
  return withLock(async () => {
    const vault = await getVault();

    if (fromIndex < 0 || fromIndex >= vault.groups.length ||
        toIndex < 0 || toIndex >= vault.groups.length) {
      return false;
    }

    const [group] = vault.groups.splice(fromIndex, 1);
    vault.groups.splice(toIndex, 0, group);
    await saveVault(vault);
    return true;
  });
}

// Export for use in other modules
const VaultStorage = {
  getVault,
  saveVault,
  addGroup,
  removeGroup,
  addTabsToGroup,
  removeTabsFromGroup,
  getGroup,
  updateGroup,
  reorderGroups
};

// Make available globally for both window (popup) and service worker contexts
if (typeof window !== 'undefined') {
  window.VaultStorage = VaultStorage;
}
if (typeof self !== 'undefined') {
  self.VaultStorage = VaultStorage;
}
