// Tab Vault - Storage Module
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
}

/**
 * Remove a group by ID
 * @param {string} groupId
 * @returns {Promise<boolean>} - True if removed
 */
async function removeGroup(groupId) {
  const vault = await getVault();
  const initialLength = vault.groups.length;
  vault.groups = vault.groups.filter(g => g.id !== groupId);

  if (vault.groups.length < initialLength) {
    await saveVault(vault);
    return true;
  }
  return false;
}

/**
 * Add tabs to an existing group
 * @param {string} groupId
 * @param {Array} tabs - Array of tab objects {url, title, favIconUrl}
 * @returns {Promise<Object|null>} - The updated group or null if not found
 */
async function addTabsToGroup(groupId, tabs) {
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
}

/**
 * Remove specific tabs from a group
 * @param {string} groupId
 * @param {Array<string>} tabIds - Array of tab IDs to remove
 * @returns {Promise<Object|null>} - The updated group or null if not found
 */
async function removeTabsFromGroup(groupId, tabIds) {
  const vault = await getVault();
  const group = vault.groups.find(g => g.id === groupId);

  if (!group) {
    return null;
  }

  const tabIdSet = new Set(tabIds);
  group.tabs = group.tabs.filter(t => !tabIdSet.has(t.id));
  await saveVault(vault);
  return group;
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
  updateGroup
};

// Make available globally for both window (popup) and service worker contexts
if (typeof window !== 'undefined') {
  window.VaultStorage = VaultStorage;
}
if (typeof self !== 'undefined') {
  self.VaultStorage = VaultStorage;
}
