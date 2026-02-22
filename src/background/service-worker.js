// Tab Vault - Background Service Worker
// Handles shutdown and restore operations

importScripts('../common/storage.js', '../common/home-tabs.js');

// Configure side panel to open on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting side panel behavior:', error));

// Helper: Check if URL should be skipped (chrome:// or extension pages)
function isSkippableUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
}

// Helper: Extract tab data for storage
function extractTabData(tab) {
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl || ''
  };
}

// Helper: Get domain from URL
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
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

// Get domains for shutdown by domain feature
async function getDomainGroups() {
  const allTabs = await chrome.tabs.query({});
  const domainMap = new Map();

  for (const tab of allTabs) {
    if (isSkippableUrl(tab.url)) continue;

    const domain = getDomainFromUrl(tab.url);
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
    const domain = getDomainFromUrl(tab.url);
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
    await chrome.tabs.remove(tabsToVault.map(t => t.id));

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
 */
async function shutdownCurrentTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || isSkippableUrl(activeTab.url)) return;

    const homePatterns = await HomeTabs.getHomePatterns();
    if (HomeTabs.isHomeTabSync(activeTab.url, homePatterns)) return;

    const groupName = `Quick Vault - ${new Date().toLocaleDateString()}`;
    await VaultStorage.addGroup(groupName, [extractTabData(activeTab)]);
    await chrome.tabs.remove(activeTab.id);
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
      return await duplicateGroup(message.groupId);

    case 'duplicate-tabs':
      return await duplicateTabs(message.groupId, message.tabIds);

    case 'get-domain-groups':
      return { success: true, domains: await getDomainGroups() };

    default:
      return { success: false, error: 'Unknown action' };
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

    const safeName = (groupName || 'Vaulted Tabs').substring(0, 200);
    await VaultStorage.addGroup(safeName, tabsToVault.map(extractTabData));
    await chrome.tabs.remove(tabsToVault.map(t => t.id));

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
      if (isSkippableUrl(tab.url)) return false;
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

    await chrome.tabs.remove(tabsToVault.map(t => t.id));

    return { success: true, count: tabsToVault.length };
  } catch (error) {
    console.error('Error in shutdownAll:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a tab's URL matches a domain
 * @param {string} tabUrl - Tab URL to check
 * @param {string} domain - Domain to match
 * @returns {boolean}
 */
function tabMatchesDomain(tabUrl, domain) {
  const hostname = getDomainFromUrl(tabUrl);
  if (!hostname) return false;
  return hostname === domain || hostname.endsWith('.' + domain);
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
      if (!tabMatchesDomain(tab.url, domain)) return false;
      return !HomeTabs.isHomeTabSync(tab.url, homePatterns);
    });

    if (tabsToVault.length === 0) {
      return { success: true, count: 0, message: 'No matching tabs found' };
    }

    await VaultStorage.addGroup(groupName || domain, tabsToVault.map(extractTabData));
    await chrome.tabs.remove(tabsToVault.map(t => t.id));

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

    // Open all tabs
    for (const tab of group.tabs) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }

    // Remove group from vault
    await VaultStorage.removeGroup(groupId);

    return { success: true, count: group.tabs.length };
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

    // Open the tabs
    for (const tab of tabsToRestore) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }

    // Remove tabs from group
    await VaultStorage.removeTabsFromGroup(groupId, tabIds);

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
 * Open tabs from a group WITHOUT removing from vault (duplicate)
 * @param {string} groupId
 */
async function duplicateGroup(groupId) {
  try {
    const group = await VaultStorage.getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    // Open all tabs without removing from vault
    for (const tab of group.tabs) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }

    return { success: true, count: group.tabs.length };
  } catch (error) {
    console.error('Error in duplicateGroup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Open specific tabs from a group WITHOUT removing from vault (duplicate)
 * @param {string} groupId
 * @param {string[]} tabIds - Vault tab IDs to duplicate
 */
async function duplicateTabs(groupId, tabIds) {
  try {
    const group = await VaultStorage.getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    const tabIdSet = new Set(tabIds);
    const tabsToDuplicate = group.tabs.filter(t => tabIdSet.has(t.id));

    // Open the tabs without removing
    for (const tab of tabsToDuplicate) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }

    return { success: true, count: tabsToDuplicate.length };
  } catch (error) {
    console.error('Error in duplicateTabs:', error);
    return { success: false, error: error.message };
  }
}
