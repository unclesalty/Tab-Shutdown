// Tab Goblin - Background Service Worker
// Handles shutdown and restore operations

importScripts('../common/url-utils.js', '../common/storage.js', '../common/home-tabs.js', '../common/history.js');

// Track tabs being closed by our extension (to distinguish from manual closes)
const tabsBeingClosedByExtension = new Set();

// Configure side panel to open on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting side panel behavior:', error));

// Helper: Extract tab data for storage
function extractTabData(tab) {
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl || ''
  };
}

/**
 * Navigate to the first tab in an array and focus its window
 * @param {Object|null} tab - Chrome tab object (or null to skip)
 */
async function navigateToFirstTab(tab) {
  if (!tab) return;
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

/**
 * Open multiple tabs from URL list
 * @param {Array} tabs - Array of tab objects with url property
 * @returns {Promise<Object|null>} - First opened tab or null
 */
async function openTabs(tabs) {
  let firstTab = null;
  for (const tab of tabs) {
    // Validate URL before opening (prevent javascript:, data:, file: injection)
    if (!UrlUtils.isValidUrlForOpening(tab.url)) continue;
    const newTab = await chrome.tabs.create({ url: tab.url, active: false });
    if (!firstTab) firstTab = newTab;
  }
  return firstTab;
}

// Handle extension install/update - preserve vault data
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const vault = await VaultStorage.getVault();
    if (!vault || !vault.groups) {
      await VaultStorage.saveVault({ groups: [] });
    }
  }
});

// Cache of tab info for saving to history when manually closed
const tabInfoCache = new Map();

// Promise that resolves when cache is initialized
let cacheInitPromise = null;

// Initialize cache with all existing tabs (needed after service worker restart)
async function initTabCache() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && !UrlUtils.isSkippableUrl(tab.url)) {
        tabInfoCache.set(tab.id, extractTabData(tab));
      }
    }
  } catch (error) {
    console.error('Error initializing tab cache:', error);
  }
}

// Initialize cache on service worker startup
cacheInitPromise = initTabCache();

// Keep tab info cached so we can save it when tabs are closed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && !UrlUtils.isSkippableUrl(tab.url)) {
    tabInfoCache.set(tabId, extractTabData(tab));
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && !UrlUtils.isSkippableUrl(tab.url)) {
    tabInfoCache.set(tab.id, extractTabData(tab));
  }
});

// Listen for tabs being closed - auto-save non-home tabs to history
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Ensure cache is initialized before checking
  if (cacheInitPromise) {
    await cacheInitPromise;
  }

  const tabInfo = tabInfoCache.get(tabId);
  tabInfoCache.delete(tabId);

  // If closed by extension, don't save to history
  if (tabsBeingClosedByExtension.has(tabId)) {
    tabsBeingClosedByExtension.delete(tabId);
    return;
  }

  // No cached info (might be a chrome:// tab or extension page)
  if (!tabInfo || !tabInfo.url) {
    return;
  }

  // Check if it's a home tab - home tabs don't go to history
  const homePatterns = await HomeTabs.getHomePatterns();
  if (HomeTabs.isHomeTabSync(tabInfo.url, homePatterns)) {
    return;
  }

  // Check if this URL already exists in the vault - don't add to history
  const vault = await VaultStorage.getVault();
  const urlInVault = vault.groups.some(group =>
    group.tabs.some(tab => tab.url === tabInfo.url)
  );
  if (urlInVault) {
    return;
  }

  // Save to history
  await TabHistory.addToHistory(tabInfo);
});

/**
 * Close tabs while marking them as extension-closed (won't go to history)
 * @param {number[]} tabIds - Chrome tab IDs to close
 */
async function closeTabsByExtension(tabIds) {
  // Mark all tabs as being closed by extension
  for (const tabId of tabIds) {
    tabsBeingClosedByExtension.add(tabId);
  }
  await chrome.tabs.remove(tabIds);
}

// Get domains for shutdown by domain feature
async function getDomainGroups() {
  const allTabs = await chrome.tabs.query({});
  const domainMap = new Map();

  for (const tab of allTabs) {
    if (UrlUtils.isSkippableUrl(tab.url)) continue;

    const domain = UrlUtils.getDomainFromUrl(tab.url);
    if (!domain) continue;

    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain).push(tab);
  }

  return Array.from(domainMap.entries()).map(([domain, tabs]) => ({
    domain,
    count: tabs.length,
    tabs
  }));
}

/**
 * Add tabs grouped by domain - appends to existing domain groups or creates new ones
 * @param {Array} tabs - Array of chrome tab objects
 */
async function addTabsByDomain(tabs) {
  const vault = await VaultStorage.getVault();

  const domainMap = new Map();
  for (const tab of tabs) {
    const domain = UrlUtils.getDomainFromUrl(tab.url);
    if (!domain) continue;

    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain).push(extractTabData(tab));
  }

  for (const [domain, tabData] of domainMap) {
    const existingGroup = vault.groups.find(g => g.name === domain);

    if (existingGroup) {
      await VaultStorage.addTabsToGroup(existingGroup.id, tabData);
    } else {
      await VaultStorage.addGroup(domain, tabData);
    }
  }
}

/**
 * Shutdown selected tabs grouped by domain
 * @param {number[]} tabIds - Chrome tab IDs
 */
async function shutdownTabsByDomain(tabIds) {
  try {
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return { success: false, error: 'Invalid tab IDs' };
    }

    const { tabsToVault } = await getVaultableTabs(tabIds);

    if (tabsToVault.length === 0) {
      return { success: true, count: 0, message: 'All selected tabs are home tabs' };
    }

    await addTabsByDomain(tabsToVault);
    await closeTabsByExtension(tabsToVault.map(t => t.id));

    return { success: true, count: tabsToVault.length };
  } catch (error) {
    console.error('Error in shutdownTabsByDomain:', error);
    return { success: false, error: error.message };
  }
}

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'shutdown-current-tab') {
    await shutdownCurrentTab();
  } else if (command === 'shutdown-all-tabs') {
    await shutdownAll();
  }
});

/**
 * Shutdown the current active tab via keyboard shortcut
 * Appends to existing "Quick Vault - {date}" group if one exists for today
 */
async function shutdownCurrentTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || UrlUtils.isSkippableUrl(activeTab.url)) return;

    const homePatterns = await HomeTabs.getHomePatterns();
    if (HomeTabs.isHomeTabSync(activeTab.url, homePatterns)) return;

    const groupName = `Quick Vault - ${new Date().toLocaleDateString()}`;
    const tabData = [extractTabData(activeTab)];

    // Check for existing group with today's name and append, otherwise create new
    const vault = await VaultStorage.getVault();
    const existingGroup = vault.groups.find(g => g.name === groupName);

    if (existingGroup) {
      await VaultStorage.addTabsToGroup(existingGroup.id, tabData);
    } else {
      await VaultStorage.addGroup(groupName, tabData);
    }

    await closeTabsByExtension([activeTab.id]);
  } catch (error) {
    console.error('Error in shutdownCurrentTab:', error);
  }
}

// Message handler for popup/content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(error => {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  });
  return true; // Keep message channel open for async response
});

async function handleMessage(message) {
  switch (message.action) {
    case 'shutdown-tabs':
      return await shutdownTabs(message.tabIds, message.groupName);

    case 'shutdown-all':
      return await shutdownAll(message.groupName, message.autoGroupByDomain);

    case 'shutdown-tabs-by-domain':
      return await shutdownTabsByDomain(message.tabIds);

    case 'shutdown-domain':
      return await shutdownByDomain(message.domain, message.groupName);

    case 'restore-group':
      return await restoreGroup(message.groupId);

    case 'restore-tabs':
      return await restoreTabs(message.groupId, message.tabIds);

    case 'duplicate-group':
      return await duplicateTabs(message.groupId, null, message.navigate);

    case 'duplicate-tabs':
      return await duplicateTabs(message.groupId, message.tabIds, message.navigate);

    case 'get-domain-groups':
      return { success: true, domains: await getDomainGroups() };

    case 'navigate-to-tab':
      return await navigateToTab(message.tabId);

    case 'find-open-tab-by-url':
      return await findOpenTabByUrl(message.url);

    case 'close-to-history':
      return await closeTabToHistory(message.tabId);

    case 'close-tabs-to-history':
      return await closeTabsToHistory(message.tabIds);

    case 'get-history':
      return { success: true, history: await TabHistory.getHistory() };

    case 'restore-from-history':
      return await restoreFromHistory(message.tabIds);

    case 'remove-from-history':
      return await removeFromHistoryHandler(message.tabIds);

    case 'clear-history':
      await TabHistory.clearHistory();
      return { success: true };

    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Close a tab and save it to history
 * @param {number} tabId - Chrome tab ID
 */
async function closeTabToHistory(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      return { success: false, error: 'Tab not found' };
    }

    // Save to history first
    await TabHistory.addToHistory(extractTabData(tab));

    // Close the tab (mark as extension-closed so onRemoved doesn't double-save)
    await closeTabsByExtension([tabId]);

    return { success: true };
  } catch (error) {
    console.error('Error in closeTabToHistory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Close multiple tabs and save them to history
 * @param {number[]} tabIds - Chrome tab IDs
 */
async function closeTabsToHistory(tabIds) {
  try {
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return { success: false, error: 'Invalid tab IDs' };
    }

    const tabs = await Promise.all(
      tabIds.map(id => chrome.tabs.get(id).catch(() => null))
    );
    const validTabs = tabs.filter(t => t !== null);

    if (validTabs.length === 0) {
      return { success: false, error: 'No valid tabs found' };
    }

    // Save all to history first
    for (const tab of validTabs) {
      await TabHistory.addToHistory(extractTabData(tab));
    }

    // Close the tabs (mark as extension-closed so onRemoved doesn't double-save)
    await closeTabsByExtension(validTabs.map(t => t.id));

    return { success: true, count: validTabs.length };
  } catch (error) {
    console.error('Error in closeTabsToHistory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore tabs from history (opens them and removes from history)
 * @param {string[]} tabIds - History tab IDs to restore
 */
async function restoreFromHistory(tabIds) {
  try {
    const history = await TabHistory.getHistory();
    const tabIdSet = new Set(tabIds);
    const tabsToRestore = history.tabs.filter(t => tabIdSet.has(t.id));

    const firstTab = await openTabs(tabsToRestore);

    // Remove from history
    await TabHistory.removeManyFromHistory(tabIds);

    await navigateToFirstTab(firstTab);

    return { success: true, count: tabsToRestore.length };
  } catch (error) {
    console.error('Error in restoreFromHistory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove tabs from history without restoring
 * @param {string[]} tabIds - History tab IDs to remove
 */
async function removeFromHistoryHandler(tabIds) {
  try {
    const count = await TabHistory.removeManyFromHistory(tabIds);
    return { success: true, count };
  } catch (error) {
    console.error('Error in removeFromHistoryHandler:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Navigate to a specific tab and focus its window
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<{success: boolean}>}
 */
async function navigateToTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Find an open tab by URL
 * @param {string} url - URL to search for
 * @returns {Promise<{success: boolean, tabId?: number}>}
 */
async function findOpenTabByUrl(url) {
  try {
    const tabs = await chrome.tabs.query({});
    const matchingTab = tabs.find(tab => UrlUtils.normalizeUrl(tab.url) === UrlUtils.normalizeUrl(url));
    if (matchingTab) {
      return { success: true, tabId: matchingTab.id, windowId: matchingTab.windowId };
    }
    return { success: false, error: 'Tab not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get valid tabs from IDs, filtering out home tabs
 * @param {number[]} tabIds - Chrome tab IDs
 * @returns {Promise<{validTabs: Array, tabsToVault: Array}>}
 */
async function getVaultableTabs(tabIds) {
  const tabs = await Promise.all(
    tabIds.map(id => chrome.tabs.get(id).catch(() => null))
  );
  const validTabs = tabs.filter(t => t !== null);

  const homePatterns = await HomeTabs.getHomePatterns();
  const tabsToVault = validTabs.filter(
    tab => !HomeTabs.isHomeTabSync(tab.url, homePatterns)
  );

  return { validTabs, tabsToVault };
}

/**
 * Shutdown specific tabs by ID
 * @param {number[]} tabIds - Chrome tab IDs
 * @param {string} groupName - Name for the vault group
 */
async function shutdownTabs(tabIds, groupName) {
  try {
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return { success: false, error: 'Invalid tab IDs' };
    }

    const { tabsToVault } = await getVaultableTabs(tabIds);

    if (tabsToVault.length === 0) {
      return { success: true, count: 0, message: 'All selected tabs are home tabs' };
    }

    await VaultStorage.addGroup(groupName || 'Vaulted Tabs', tabsToVault.map(extractTabData));
    await closeTabsByExtension(tabsToVault.map(t => t.id));

    return { success: true, count: tabsToVault.length };
  } catch (error) {
    console.error('Error in shutdownTabs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Shutdown all tabs except home tabs
 * @param {string} groupName - Name for the vault group
 * @param {boolean} autoGroupByDomain - If true, group tabs by domain
 */
async function shutdownAll(groupName, autoGroupByDomain = false) {
  try {
    const allTabs = await chrome.tabs.query({});

    const homePatterns = await HomeTabs.getHomePatterns();
    const tabsToVault = allTabs.filter(tab => {
      if (UrlUtils.isSkippableUrl(tab.url)) return false;
      return !HomeTabs.isHomeTabSync(tab.url, homePatterns);
    });

    if (tabsToVault.length === 0) {
      return { success: true, count: 0, message: 'No tabs to vault' };
    }

    if (autoGroupByDomain) {
      await addTabsByDomain(tabsToVault);
    } else {
      const name = groupName || `All Tabs - ${new Date().toLocaleDateString()}`;
      await VaultStorage.addGroup(name, tabsToVault.map(extractTabData));
    }

    await closeTabsByExtension(tabsToVault.map(t => t.id));

    return { success: true, count: tabsToVault.length };
  } catch (error) {
    console.error('Error in shutdownAll:', error);
    return { success: false, error: error.message };
  }
}


/**
 * Shutdown all tabs matching a domain
 * @param {string} domain - Domain to match (e.g., 'github.com')
 * @param {string} groupName - Name for the vault group
 */
async function shutdownByDomain(domain, groupName) {
  try {
    const allTabs = await chrome.tabs.query({});

    const homePatterns = await HomeTabs.getHomePatterns();
    const tabsToVault = allTabs.filter(tab => {
      if (!UrlUtils.tabMatchesDomain(tab.url, domain)) return false;
      return !HomeTabs.isHomeTabSync(tab.url, homePatterns);
    });

    if (tabsToVault.length === 0) {
      return { success: true, count: 0, message: 'No matching tabs found' };
    }

    await VaultStorage.addGroup(groupName || domain, tabsToVault.map(extractTabData));
    await closeTabsByExtension(tabsToVault.map(t => t.id));

    return { success: true, count: tabsToVault.length };
  } catch (error) {
    console.error('Error in shutdownByDomain:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore all tabs in a group (opens tabs and removes group from vault)
 * @param {string} groupId
 */
async function restoreGroup(groupId) {
  try {
    const group = await VaultStorage.getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    const firstTab = await openTabs(group.tabs);
    await VaultStorage.removeGroup(groupId);
    await navigateToFirstTab(firstTab);

    return { success: true, count: group.tabs.length, navigatedTabId: firstTab?.id };
  } catch (error) {
    console.error('Error in restoreGroup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore specific tabs from a group
 * @param {string} groupId
 * @param {string[]} tabIds - Vault tab IDs to restore
 */
async function restoreTabs(groupId, tabIds) {
  try {
    const group = await VaultStorage.getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    const tabIdSet = new Set(tabIds);
    const tabsToRestore = group.tabs.filter(t => tabIdSet.has(t.id));
    const firstTab = await openTabs(tabsToRestore);

    await VaultStorage.removeTabsFromGroup(groupId, tabIds);
    await navigateToFirstTab(firstTab);

    // Check if group is now empty and remove it
    const updatedGroup = await VaultStorage.getGroup(groupId);
    if (updatedGroup && updatedGroup.tabs.length === 0) {
      await VaultStorage.removeGroup(groupId);
    }

    return { success: true, count: tabsToRestore.length };
  } catch (error) {
    console.error('Error in restoreTabs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Open tabs from a group WITHOUT removing from vault
 * @param {string} groupId
 * @param {string[]} [tabIds] - Optional: specific tab IDs to open (all if omitted)
 * @param {boolean} [navigate] - If true, navigate to the first opened tab
 */
async function duplicateTabs(groupId, tabIds = null, navigate = false) {
  try {
    const group = await VaultStorage.getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    const tabIdSet = tabIds ? new Set(tabIds) : null;
    const tabsToOpen = tabIdSet
      ? group.tabs.filter(t => tabIdSet.has(t.id))
      : group.tabs;

    const firstTab = await openTabs(tabsToOpen);

    if (navigate) {
      await navigateToFirstTab(firstTab);
    }

    return { success: true, count: tabsToOpen.length };
  } catch (error) {
    console.error('Error in duplicateTabs:', error);
    return { success: false, error: error.message };
  }
}

