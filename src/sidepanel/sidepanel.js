// Tab Goblin - Side Panel Script

document.addEventListener('DOMContentLoaded', init);

// Track selected tabs for shutdown
let selectedTabIds = new Set();

// Track expanded state for accordions (persists across re-renders)
let expandedDomainGroups = new Set(); // For Live Tabs panel
let expandedVaultGroups = new Set();  // For Vault panel
let homeTabsCollapsed = false;        // For Home Tabs section

// Debounce timer for search
let searchDebounceTimer = null;

// Current search query (shared across panels)
let currentSearchQuery = '';

// Current active tab
let currentTab = 'live';

// Helper aliases for commonly used UIHelpers functions
const pluralizeTabs = UIHelpers.pluralizeTabs.bind(UIHelpers);
const clearContainer = UIHelpers.clearContainer.bind(UIHelpers);
const showToast = UIHelpers.showToast.bind(UIHelpers);
const setLoading = UIHelpers.setLoading.bind(UIHelpers);

async function init() {
  await initTheme();
  await updateOpenTabsCache();
  await loadActiveTab();
  await updateLiveTabCount();
  await renderCurrentPanel();
  setupEventListeners();
  setupTabListeners();
  await checkOnboarding();
}

// Set up listeners for tab changes to update active indicators
function setupTabListeners() {
  // Update cache and re-render vault when tabs change
  const handleTabChange = async () => {
    await updateOpenTabsCache();
    await updateLiveTabCount();
    // Re-render current panel to reflect tab changes
    if (currentTab === 'vault') {
      await renderHistorySection();
      if (currentSearchQuery) {
        await renderSearchResults();
      } else {
        await renderVaultGroups();
      }
    } else if (currentTab === 'live') {
      await renderLiveTabsPanel();
      updateSelectedCount();
    }
  };

  chrome.tabs.onCreated.addListener(handleTabChange);
  chrome.tabs.onRemoved.addListener(handleTabChange);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // Only re-render if URL changed
    if (changeInfo.url) {
      handleTabChange();
    }
  });
}

// Initialize theme from settings
async function initTheme() {
  try {
    const themeMode = await Settings.getSetting('themeMode');
    const themePalette = await Settings.getSetting('themePalette');

    applyThemeFromSettings(themeMode, themePalette);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
  } catch (error) {
    // Default to system theme on error
    Themes.applyTheme(null);
  }
}

// Apply theme based on mode and palette settings
function applyThemeFromSettings(themeMode, themePalette) {
  switch (themeMode) {
    case 'light':
      Themes.applyTheme('light');
      break;
    case 'dark':
    case 'custom':
      Themes.applyTheme(themePalette || 'slate-minimal');
      break;
    case 'system':
    default:
      Themes.applyTheme(null); // Let CSS media query handle it
      break;
  }
}

// Handle system theme preference change
async function handleSystemThemeChange() {
  const themeMode = await Settings.getSetting('themeMode');
  if (themeMode === 'system') {
    // Re-apply to trigger any necessary updates
    Themes.applyTheme(null);
  }
}

// Handle theme mode radio button change
async function handleThemeModeChange(e) {
  const mode = e.target.value;
  await Settings.updateSetting('themeMode', mode);

  const paletteSelector = document.getElementById('darkPaletteSelector');

  if (mode === 'dark') {
    // Show palette selector for dark mode
    paletteSelector.classList.remove('hidden');
    const currentPalette = await Settings.getSetting('themePalette') || 'slate-minimal';
    Themes.applyTheme(currentPalette);
  } else {
    // Hide palette selector
    paletteSelector.classList.add('hidden');

    if (mode === 'light') {
      Themes.applyTheme('light');
    } else {
      // System mode
      Themes.applyTheme(null);
    }
  }
}

// Handle palette button click
async function handlePaletteChange(palette) {
  // Update active state
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.palette === palette);
  });

  // Save and apply
  await Settings.updateSetting('themePalette', palette);
  Themes.applyTheme(palette);
}

// Initialize theme selector UI from settings
async function initThemeSelector() {
  const themeMode = await Settings.getSetting('themeMode') || 'system';
  const themePalette = await Settings.getSetting('themePalette') || 'slate-minimal';

  // Set radio button
  const radio = document.querySelector(`input[name="themeMode"][value="${themeMode}"]`);
  if (radio) radio.checked = true;

  // Show/hide palette selector
  const paletteSelector = document.getElementById('darkPaletteSelector');
  if (themeMode === 'dark') {
    paletteSelector.classList.remove('hidden');
  } else {
    paletteSelector.classList.add('hidden');
  }

  // Set active palette
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.palette === themePalette);
  });
}

// Cache of open tabs for active status checking
let openTabsCache = [];

// Update cache of open tabs
async function updateOpenTabsCache() {
  try {
    openTabsCache = await chrome.tabs.query({});
  } catch (error) {
    openTabsCache = [];
  }
}

// Check if a URL matches any open tab and return the tab if found
function findOpenTabByUrl(url) {
  if (!url || !openTabsCache.length) return null;
  const normalizedUrl = UrlUtils.normalizeUrl(url);
  return openTabsCache.find(tab => UrlUtils.normalizeUrl(tab.url) === normalizedUrl);
}

// Navigate to a specific tab
async function navigateToTab(tabId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'navigate-to-tab',
      tabId: tabId
    });
    return response.success;
  } catch (error) {
    return false;
  }
}

// Load persisted active tab from settings
async function loadActiveTab() {
  try {
    const activeTab = await Settings.getSetting('activeTab');
    if (activeTab && ['vault', 'live', 'settings'].includes(activeTab)) {
      currentTab = activeTab;
    }
  } catch (error) {
    currentTab = 'live';
  }
  updateTabBarUI();
  showPanel(currentTab);
  updateSearchUI(currentTab);
}

// Save active tab to settings
async function saveActiveTab(tabName) {
  try {
    await Settings.updateSetting('activeTab', tabName);
  } catch (error) {
    // Silently fail - non-critical
  }
}

// Update tab bar visual state
function updateTabBarUI() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === currentTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

// Show panel and hide others
function showPanel(tabName) {
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.add('hidden');
  });
  const panelId = tabName + 'Panel';
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.classList.remove('hidden');
  }
}

// Switch to a tab
async function switchToTab(tabName) {
  if (currentTab === tabName) return;

  currentTab = tabName;
  updateTabBarUI();
  showPanel(tabName);
  updateSearchUI(tabName);
  await saveActiveTab(tabName);
  await renderCurrentPanel();
}

// Update search UI based on active panel
function updateSearchUI(tabName) {
  const searchContainer = document.getElementById('searchContainer');
  const searchInput = document.getElementById('globalSearchInput');

  // Clear search when switching tabs
  currentSearchQuery = '';
  searchInput.value = '';

  // Hide search on settings, show on others
  if (tabName === 'settings') {
    searchContainer.classList.add('hidden');
  } else {
    searchContainer.classList.remove('hidden');
    // Update placeholder based on panel
    searchInput.placeholder = tabName === 'live' ? 'Search open tabs...' : 'Search vaulted tabs...';
  }
}

// Render content for current panel
async function renderCurrentPanel() {
  switch (currentTab) {
    case 'vault':
      await renderHistorySection();
      await renderVaultGroups();
      break;
    case 'live':
      selectedTabIds.clear();
      await renderLiveTabsPanel();
      updateSelectedCount();
      break;
    case 'settings':
      await renderHomePatterns();
      await initThemeSelector();
      break;
  }
}

// Render the entire Live Tabs panel (home section + open tabs)
async function renderLiveTabsPanel() {
  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();
  const searchQuery = currentSearchQuery.toLowerCase();

  // Build a map of open tabs by URL for quick lookup
  const openTabsByUrl = new Map();
  const regularTabs = [];

  for (const tab of tabs) {
    if (UrlUtils.isSkippableUrl(tab.url)) continue;

    if (HomeTabs.isHomeTabSync(tab.url, homePatterns)) {
      // Track this as a home tab instance (stores in chrome.storage)
      await HomeTabs.trackHomeInstance({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      });
      openTabsByUrl.set(tab.url, tab);
    } else {
      // Filter regular tabs by search query if present
      if (searchQuery) {
        const titleMatch = (tab.title || '').toLowerCase().includes(searchQuery);
        const urlMatch = (tab.url || '').toLowerCase().includes(searchQuery);
        if (!titleMatch && !urlMatch) continue;
      }
      regularTabs.push(tab);
    }
  }

  // Get all saved home tab instances (includes closed tabs)
  const homeInstances = await HomeTabs.getHomeInstances();

  // Filter instances by search query if present
  let filteredInstances = homeInstances;
  if (searchQuery) {
    filteredInstances = homeInstances.filter(instance => {
      const titleMatch = (instance.title || '').toLowerCase().includes(searchQuery);
      const urlMatch = (instance.url || '').toLowerCase().includes(searchQuery);
      return titleMatch || urlMatch;
    });
  }

  // Render home tabs section with instances and open tab info
  renderHomeTabsSection(filteredInstances, openTabsByUrl, homePatterns);

  // Render regular tabs
  renderOpenTabsList(regularTabs);
}

// Render the Home Tabs section
// instances: saved home tab instances (may be open or closed)
// openTabsByUrl: Map of URL -> open tab object
function renderHomeTabsSection(instances, openTabsByUrl, homePatterns) {
  const section = document.getElementById('homeTabsSection');
  const header = document.getElementById('homeTabsHeader');
  const container = document.getElementById('homeTabsList');
  const countEl = document.getElementById('homeTabsCount');

  // Restore collapsed state
  if (homeTabsCollapsed) {
    section.classList.add('collapsed');
    header.setAttribute('aria-expanded', 'false');
  } else {
    section.classList.remove('collapsed');
    header.setAttribute('aria-expanded', 'true');
  }

  clearContainer(container);
  countEl.textContent = instances.length;

  if (instances.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'home-tabs-empty';
    emptyState.textContent = 'No protected tabs';
    container.appendChild(emptyState);
    return;
  }

  // Sort instances: open tabs first, then by lastSeen
  const sortedInstances = [...instances].sort((a, b) => {
    const aOpen = openTabsByUrl.has(a.url);
    const bOpen = openTabsByUrl.has(b.url);
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return b.lastSeen - a.lastSeen;
  });

  for (const instance of sortedInstances) {
    const openTab = openTabsByUrl.get(instance.url);
    container.appendChild(createHomeTabItem(instance, openTab, homePatterns));
  }
}

// Create a home tab item
// instance: saved home tab instance data
// openTab: the open chrome tab (if currently open) or null
function createHomeTabItem(instance, openTab, homePatterns) {
  const isOpen = !!openTab;

  const item = document.createElement('div');
  item.className = 'home-tab-item' + (isOpen ? ' active' : ' closed');
  item.dataset.url = instance.url;
  if (openTab) {
    item.dataset.tabId = openTab.id;
  }

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  // Use openTab data if available (more current), fallback to instance
  favicon.src = (openTab?.favIconUrl || instance.favIconUrl) || getDefaultFavicon();
  favicon.alt = '';
  favicon.onerror = () => {
    favicon.src = getDefaultFavicon();
  };

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = (openTab?.title || instance.title) || 'Untitled';

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = truncateUrl(instance.url);

  info.appendChild(title);
  info.appendChild(url);

  // Status indicator
  const status = document.createElement('span');
  status.className = 'home-tab-status';
  if (isOpen) {
    status.textContent = 'Active';
    status.classList.add('status-active');
  } else {
    status.textContent = 'Closed';
    status.classList.add('status-closed');
  }

  const unprotectBtn = document.createElement('button');
  unprotectBtn.className = 'unprotect-btn';
  unprotectBtn.textContent = '\u2716'; // X mark
  unprotectBtn.title = 'Remove from Home Tabs';
  unprotectBtn.setAttribute('aria-label', 'Remove from Home Tabs');
  unprotectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const currentPatterns = await HomeTabs.getHomePatterns();
    await removeTabFromHome(instance.url, currentPatterns);
    // Also remove the instance
    await HomeTabs.removeHomeInstance(instance.url);
  });

  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(status);
  item.appendChild(unprotectBtn);

  // Click on row: navigate if open, open if closed
  item.addEventListener('click', async (e) => {
    if (e.target.closest('button')) return;

    if (isOpen && openTab) {
      // Tab is open - navigate to it
      await navigateToTab(openTab.id);
    } else {
      // Tab is closed - open it
      const newTab = await chrome.tabs.create({ url: instance.url, active: true });
      // Track the new tab as an instance
      await HomeTabs.trackHomeInstance({
        url: instance.url,
        title: instance.title,
        favIconUrl: instance.favIconUrl
      });
      // Navigate to the new tab
      await chrome.windows.update(newTab.windowId, { focused: true });
      // Re-render to show updated state
      await renderLiveTabsPanel();
    }
  });

  return item;
}

// Remove a tab from home protection
async function removeTabFromHome(tabUrl, patterns) {
  // Find matching pattern(s) for this URL
  const matchingPattern = patterns.find(pattern => {
    try {
      return HomeTabs.patternToRegex(pattern).test(tabUrl);
    } catch {
      return false;
    }
  });

  if (matchingPattern) {
    await HomeTabs.removeHomePattern(matchingPattern);
    // Clean up any instances that no longer match patterns
    await HomeTabs.cleanupOrphanedInstances();
    showToast('Tab unprotected', 'success');
    await renderLiveTabsPanel();
    updateSelectedCount();
  }
}

// Render the Open Tabs grouped by domain
function renderOpenTabsList(tabs) {
  const container = document.getElementById('domainGroupsList');
  const countEl = document.getElementById('openTabsCount');

  clearContainer(container);
  countEl.textContent = tabs.length;
  selectedTabIds.clear();

  if (tabs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'All open tabs are protected';
    container.appendChild(emptyState);
    return;
  }

  // Group tabs by domain
  const domainGroups = UrlUtils.groupTabsByDomain(tabs);

  // Sort domains by tab count (descending)
  const sortedDomains = Object.keys(domainGroups).sort((a, b) =>
    domainGroups[b].length - domainGroups[a].length
  );

  // Create domain group cards
  for (const domain of sortedDomains) {
    const domainTabs = domainGroups[domain];
    container.appendChild(createDomainGroupCard(domain, domainTabs));
    // Tabs start unselected - user must explicitly select them
  }
}


// Create a domain group card (accordion style)
function createDomainGroupCard(domain, tabs) {
  const card = document.createElement('div');
  card.className = 'domain-group-card';
  card.dataset.domain = domain;

  // Restore expanded state if previously expanded OR if searching (to show matching results)
  const shouldExpand = expandedDomainGroups.has(domain) || currentSearchQuery;
  if (shouldExpand) {
    card.classList.add('expanded');
  }

  // Group header (acts as button for accordion)
  const header = document.createElement('div');
  header.className = 'domain-group-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
  header.setAttribute('aria-label', `${domain}, ${tabs.length} ${pluralizeTabs(tabs.length)}`);

  const expand = document.createElement('span');
  expand.className = 'domain-group-expand';
  expand.textContent = '\u25B6'; // Right triangle
  expand.setAttribute('aria-hidden', 'true');

  const groupCheckbox = document.createElement('input');
  groupCheckbox.type = 'checkbox';
  groupCheckbox.className = 'domain-group-checkbox';
  groupCheckbox.checked = false;
  groupCheckbox.title = 'Select all tabs in this domain';
  groupCheckbox.addEventListener('click', (e) => e.stopPropagation());
  groupCheckbox.addEventListener('change', (e) => {
    const tabCheckboxes = card.querySelectorAll('.domain-tab-checkbox');
    tabCheckboxes.forEach(cb => {
      cb.checked = groupCheckbox.checked;
      cb.dispatchEvent(new Event('change'));
    });
    updateDomainGroupCheckbox(card);
  });

  const info = document.createElement('div');
  info.className = 'domain-group-info';

  const name = document.createElement('div');
  name.className = 'domain-group-name';
  name.textContent = domain;

  const count = document.createElement('div');
  count.className = 'domain-group-count';
  count.textContent = `${tabs.length} ${pluralizeTabs(tabs.length)}`;

  info.appendChild(name);
  info.appendChild(count);

  const actions = document.createElement('div');
  actions.className = 'domain-group-actions';

  const vaultBtn = document.createElement('button');
  vaultBtn.className = 'btn btn-primary btn-small';
  vaultBtn.textContent = 'Vault';
  vaultBtn.title = 'Vault all tabs from this domain';
  vaultBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await vaultDomainTabs(domain, tabs);
  });

  actions.appendChild(vaultBtn);

  header.appendChild(expand);
  header.appendChild(groupCheckbox);
  header.appendChild(info);
  header.appendChild(actions);

  const toggleExpand = (e) => {
    if (e.target.closest('.domain-group-actions') || e.target.closest('.domain-group-checkbox')) return;
    card.classList.toggle('expanded');
    const isExpanded = card.classList.contains('expanded');
    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    // Track expanded state
    if (isExpanded) {
      expandedDomainGroups.add(domain);
    } else {
      expandedDomainGroups.delete(domain);
    }
  };

  header.addEventListener('click', toggleExpand);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpand(e);
    }
  });

  // Group tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'domain-group-tabs';

  tabs.forEach(tab => {
    const tabItem = createDomainTabItem(tab, card);
    tabsContainer.appendChild(tabItem);
  });

  card.appendChild(header);
  card.appendChild(tabsContainer);

  return card;
}

// Create a tab item within a domain group
function createDomainTabItem(tab, groupCard) {
  const item = document.createElement('div');
  item.className = 'domain-tab-item';
  item.dataset.tabId = tab.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'domain-tab-checkbox';
  checkbox.checked = false;

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      selectedTabIds.add(tab.id);
    } else {
      selectedTabIds.delete(tab.id);
    }
    updateSelectedCount();
    updateDomainGroupCheckbox(groupCard);
  });

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || getDefaultFavicon();
  favicon.alt = '';
  favicon.onerror = () => {
    favicon.src = getDefaultFavicon();
  };

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = truncateUrl(tab.url);

  info.appendChild(title);
  info.appendChild(url);

  // Action buttons container
  const actions = document.createElement('div');
  actions.className = 'tab-item-actions';

  // Vault button - save tab to vault and close it
  const vaultBtn = document.createElement('button');
  vaultBtn.className = 'tab-action-btn vault-btn';
  vaultBtn.textContent = '\u{1F4E5}'; // Inbox tray icon
  vaultBtn.title = 'Vault this tab (save and close)';
  vaultBtn.setAttribute('aria-label', 'Vault this tab');
  vaultBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await vaultSingleTab(tab);
  });

  // Close button - close tab to history
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-action-btn close-btn';
  closeBtn.textContent = '\u{2715}'; // X mark
  closeBtn.title = 'Close tab to history';
  closeBtn.setAttribute('aria-label', 'Close tab to history');
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await closeTabToHistory(tab.id);
  });

  // Protect button - add to home tabs
  const protectBtn = document.createElement('button');
  protectBtn.className = 'tab-action-btn protect-btn-icon';
  protectBtn.textContent = '\u{1F6E1}'; // Shield icon
  protectBtn.title = 'Protect from shutdown (add to Home Tabs)';
  protectBtn.setAttribute('aria-label', 'Add to Home Tabs');
  protectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    // Re-fetch the tab's current URL to ensure we're using the latest
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab && currentTab.url) {
        await addTabToHome(currentTab.url);
      } else {
        showToast('Error: Tab no longer exists', 'error');
      }
    } catch (err) {
      // Tab may have been closed
      showToast('Error: Tab no longer exists', 'error');
    }
  });

  actions.appendChild(vaultBtn);
  actions.appendChild(closeBtn);
  actions.appendChild(protectBtn);

  item.appendChild(checkbox);
  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(actions);

  // Click on row navigates to tab (except on checkbox or buttons)
  item.addEventListener('click', async (e) => {
    if (e.target === checkbox || e.target.closest('button')) return;
    await navigateToTab(tab.id);
  });

  return item;
}

// Update domain group checkbox based on individual tab checkboxes
function updateDomainGroupCheckbox(groupCard) {
  const tabCheckboxes = groupCard.querySelectorAll('.domain-tab-checkbox');
  const groupCheckbox = groupCard.querySelector('.domain-group-checkbox');

  const allChecked = Array.from(tabCheckboxes).every(cb => cb.checked);
  const someChecked = Array.from(tabCheckboxes).some(cb => cb.checked);

  groupCheckbox.checked = allChecked;
  groupCheckbox.indeterminate = someChecked && !allChecked;
}

// Vault all tabs from a specific domain
async function vaultDomainTabs(domain, tabs) {
  const tabIds = tabs.map(t => t.id).filter(id => selectedTabIds.has(id));

  if (tabIds.length === 0) {
    showToast('No tabs selected from this domain', 'info');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    action: 'shutdown-tabs',
    tabIds: tabIds,
    groupName: domain
  });

  if (response.success) {
    showToast(`Vaulted ${response.count} ${pluralizeTabs(response.count)} from ${domain}`, 'success');
    await updateLiveTabCount();
    await renderLiveTabsPanel();
    updateSelectedCount();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Add a tab to home protection
async function addTabToHome(tabUrl) {
  if (!tabUrl) {
    showToast('Error: Invalid tab URL', 'error');
    return;
  }

  const result = await HomeTabs.addHomePattern(tabUrl);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  // If pattern already existed, still show success and ensure tab is visible
  if (!result.added) {
    // Pattern already exists - verify it actually matches
    const savedPatterns = await HomeTabs.getHomePatterns();
    if (!savedPatterns.includes(tabUrl)) {
      showToast('Error: Failed to save pattern', 'error');
      return;
    }
    showToast('Tab already protected', 'info');
  } else {
    // Verify the pattern was actually saved
    const savedPatterns = await HomeTabs.getHomePatterns();
    if (!savedPatterns.includes(tabUrl)) {
      showToast('Error: Failed to save pattern', 'error');
      return;
    }
    showToast('Added to Home Tabs', 'success');
  }

  // Clear search query to ensure the protected tab is visible
  if (currentSearchQuery) {
    currentSearchQuery = '';
    document.getElementById('globalSearchInput').value = '';
  }

  // Expand home tabs section so the user can see the protected tab
  homeTabsCollapsed = false;

  await renderLiveTabsPanel();
  updateSelectedCount();
}

// Vault a single tab (save to vault and close)
async function vaultSingleTab(tab) {
  const domain = UrlUtils.getDomainFromUrl(tab.url) || 'Other';
  const response = await chrome.runtime.sendMessage({
    action: 'shutdown-tabs',
    tabIds: [tab.id],
    groupName: domain
  });

  if (response.success) {
    showToast('Tab vaulted', 'success');
    await updateLiveTabCount();
    await renderLiveTabsPanel();
    updateSelectedCount();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Close a single tab and save to history
async function closeTabToHistory(tabId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'close-to-history',
      tabId: tabId
    });

    if (response.success) {
      showToast('Tab closed to history', 'info');
      await updateLiveTabCount();
      await renderLiveTabsPanel();
      updateSelectedCount();
    } else {
      showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Error closing tab', 'error');
  }
}

// Check and show onboarding tips
async function checkOnboarding() {
  const onboardingComplete = await Settings.getSetting('onboardingComplete');
  if (!onboardingComplete) {
    showOnboardingTip();
    await Settings.updateSetting('onboardingComplete', true);
  }
}

// Show onboarding tip
function showOnboardingTip() {
  const tip = document.createElement('div');
  tip.className = 'onboarding-tip';

  const content = document.createElement('div');
  content.className = 'onboarding-content';

  const title = document.createElement('div');
  title.className = 'onboarding-title';
  title.textContent = 'Welcome to Tab Goblin!';

  const text = document.createElement('div');
  text.className = 'onboarding-text';
  text.textContent = 'Close tabs to save RAM while keeping them organized. Use "Shutdown All" to vault all tabs, or go to "Live Tabs" to pick specific ones.';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-primary btn-small';
  closeBtn.textContent = 'Got it!';
  closeBtn.addEventListener('click', () => tip.remove());

  content.appendChild(title);
  content.appendChild(text);
  content.appendChild(closeBtn);
  tip.appendChild(content);

  document.querySelector('.main-content').prepend(tip);
}

// Update the live tab count in the status bar
async function updateLiveTabCount() {
  const tabs = await chrome.tabs.query({});
  document.getElementById('liveTabCount').textContent = tabs.length;
}

// Render vault groups in the vault panel
async function renderVaultGroups() {
  const vault = await VaultStorage.getVault();
  const container = document.getElementById('vaultGroups');

  clearContainer(container);

  if (vault.groups.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Your vault is empty. Shutdown some tabs to get started!';
    container.appendChild(emptyState);
    return;
  }

  vault.groups.forEach(group => {
    container.appendChild(createGroupCard(group));
  });
}

// Track collapsed state for history section
let historyCollapsed = false;

// Render the history section in the vault panel
async function renderHistorySection() {
  const section = document.getElementById('historySection');
  const header = document.getElementById('historyHeader');
  const container = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');
  const emptyEl = document.getElementById('historyEmpty');
  const footerEl = document.getElementById('historyFooter');

  // Restore collapsed state
  if (historyCollapsed) {
    section.classList.add('collapsed');
    header.setAttribute('aria-expanded', 'false');
  } else {
    section.classList.remove('collapsed');
    header.setAttribute('aria-expanded', 'true');
  }

  // Set up header click handler (only once)
  if (!header.dataset.initialized) {
    header.dataset.initialized = 'true';
    header.addEventListener('click', () => {
      historyCollapsed = !historyCollapsed;
      section.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', !historyCollapsed);
    });
  }

  // Get history from service worker
  const response = await chrome.runtime.sendMessage({ action: 'get-history' });
  const history = response.success ? response.history : { tabs: [] };

  clearContainer(container);
  countEl.textContent = history.tabs.length;

  if (history.tabs.length === 0) {
    emptyEl.classList.remove('hidden');
    footerEl.classList.add('hidden');
    section.classList.add('empty');
    return;
  }

  emptyEl.classList.add('hidden');
  footerEl.classList.remove('hidden');
  section.classList.remove('empty');

  // Render history items
  for (const tab of history.tabs) {
    container.appendChild(createHistoryItem(tab));
  }

  // Set up clear history button (only once)
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (!clearBtn.dataset.initialized) {
    clearBtn.dataset.initialized = 'true';
    clearBtn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'clear-history' });
      showToast('History cleared', 'success');
      await renderHistorySection();
    });
  }
}

// Create a history item element
function createHistoryItem(tab) {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.dataset.tabId = tab.id;

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || getDefaultFavicon();
  favicon.alt = '';
  favicon.onerror = () => {
    favicon.src = getDefaultFavicon();
  };

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';

  const urlEl = document.createElement('div');
  urlEl.className = 'tab-url';
  urlEl.textContent = truncateUrl(tab.url);

  const timeEl = document.createElement('div');
  timeEl.className = 'history-time';
  timeEl.textContent = TabHistory.getTimeRemaining(tab);

  info.appendChild(title);
  info.appendChild(urlEl);

  const actions = document.createElement('div');
  actions.className = 'history-item-actions';

  // Restore button
  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'tab-action-btn restore-btn';
  restoreBtn.textContent = '\u21B3'; // Arrow
  restoreBtn.title = 'Restore tab';
  restoreBtn.setAttribute('aria-label', 'Restore tab');
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreFromHistory([tab.id]);
  });

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'tab-action-btn close-btn';
  removeBtn.textContent = '\u{2715}'; // X mark
  removeBtn.title = 'Remove from history';
  removeBtn.setAttribute('aria-label', 'Remove from history');
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeFromHistory([tab.id]);
  });

  actions.appendChild(timeEl);
  actions.appendChild(restoreBtn);
  actions.appendChild(removeBtn);

  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(actions);

  // Click on row restores the tab
  item.addEventListener('click', async () => {
    await restoreFromHistory([tab.id]);
  });

  return item;
}

// Restore tabs from history
async function restoreFromHistory(tabIds) {
  const response = await chrome.runtime.sendMessage({
    action: 'restore-from-history',
    tabIds: tabIds
  });

  if (response.success) {
    showToast(`Restored ${response.count} ${pluralizeTabs(response.count)}`, 'success');
    await renderHistorySection();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Remove tabs from history without restoring
async function removeFromHistory(tabIds) {
  const response = await chrome.runtime.sendMessage({
    action: 'remove-from-history',
    tabIds: tabIds
  });

  if (response.success) {
    showToast('Removed from history', 'info');
    await renderHistorySection();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Create a group card element
function createGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'group-card';
  card.dataset.groupId = group.id;

  // Restore expanded state if previously expanded
  if (expandedVaultGroups.has(group.id)) {
    card.classList.add('expanded');
  }

  // Make the group draggable for reordering
  card.draggable = true;
  card.addEventListener('dragstart', handleGroupReorderDragStart);
  card.addEventListener('dragend', handleGroupReorderDragEnd);

  // Make the group a drop target for drag-and-drop (both tabs and groups)
  card.addEventListener('dragover', handleGroupDragOver);
  card.addEventListener('dragleave', handleGroupDragLeave);
  card.addEventListener('drop', handleGroupDrop);

  // Group header
  const header = document.createElement('div');
  header.className = 'group-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', expandedVaultGroups.has(group.id) ? 'true' : 'false');
  header.setAttribute('aria-label', `${group.name}, ${group.tabs.length} ${pluralizeTabs(group.tabs.length)}`);

  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.className = 'group-drag-handle';
  dragHandle.textContent = '\u2630'; // Hamburger menu icon
  dragHandle.title = 'Drag to reorder';
  dragHandle.setAttribute('aria-hidden', 'true');

  const expand = document.createElement('span');
  expand.className = 'group-expand';
  expand.textContent = '\u25B6'; // Right triangle
  expand.setAttribute('aria-hidden', 'true');

  const info = document.createElement('div');
  info.className = 'group-info';

  const name = document.createElement('div');
  name.className = 'group-name';
  name.textContent = group.name;

  const count = document.createElement('div');
  count.className = 'group-count';
  count.textContent = `${group.tabs.length} ${pluralizeTabs(group.tabs.length)}`;

  info.appendChild(name);
  info.appendChild(count);

  const actions = document.createElement('div');
  actions.className = 'group-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn btn-primary btn-small restore-group-btn';
  restoreBtn.textContent = 'Restore';
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreGroup(group.id);
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary btn-small copy-group-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.title = 'Open tabs without removing from vault';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await duplicateGroup(group.id);
  });

  // Menu button with rename/delete options
  const menuBtn = document.createElement('button');
  menuBtn.className = 'btn btn-secondary btn-small group-menu-btn';
  menuBtn.textContent = '\u22EE'; // Vertical ellipsis
  menuBtn.setAttribute('aria-haspopup', 'menu');
  menuBtn.setAttribute('aria-label', 'Group options');
  menuBtn.title = 'Group options';
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showGroupMenu(group, menuBtn);
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(menuBtn);

  header.appendChild(dragHandle);
  header.appendChild(expand);
  header.appendChild(info);
  header.appendChild(actions);

  const toggleVaultExpand = (e) => {
    if (e.target.closest('.group-actions') || e.target.closest('.group-drag-handle')) return;
    card.classList.toggle('expanded');
    const isExpanded = card.classList.contains('expanded');
    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    // Track expanded state
    if (isExpanded) {
      expandedVaultGroups.add(group.id);
    } else {
      expandedVaultGroups.delete(group.id);
    }
  };

  header.addEventListener('click', toggleVaultExpand);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleVaultExpand(e);
    }
  });

  // Group tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'group-tabs';

  group.tabs.forEach(tab => {
    const tabItem = createTabItem(tab, group.id);
    tabsContainer.appendChild(tabItem);
  });

  card.appendChild(header);
  card.appendChild(tabsContainer);

  return card;
}

// Create a tab item element
function createTabItem(tab, groupId) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  item.dataset.tabId = tab.id;
  item.dataset.groupId = groupId;

  // Check if this tab is currently open
  const openTab = findOpenTabByUrl(tab.url);
  const isActive = !!openTab;

  if (isActive) {
    item.classList.add('active-tab');
    item.dataset.openTabId = openTab.id;
    item.title = 'Click to navigate to this tab';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `Navigate to ${tab.title || 'tab'}`);
    item.addEventListener('click', async (e) => {
      // Don't navigate if clicking on buttons
      if (e.target.closest('button')) return;
      await navigateToTab(openTab.id);
    });
    // Keyboard support for navigation
    item.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        await navigateToTab(openTab.id);
      }
    });
  } else {
    // Inactive tab - not clickable, show tooltip explaining why
    item.classList.add('inactive-tab');
    item.title = 'Tab not open \u2014 use Restore to open';
    item.setAttribute('aria-label', `${tab.title || 'Tab'} (not open)`);
  }

  // Drag-and-drop attributes for vault tabs
  item.draggable = true;
  item.addEventListener('dragstart', handleDragStart);
  item.addEventListener('dragend', handleDragEnd);
  item.addEventListener('dragover', handleDragOver);
  item.addEventListener('drop', handleDrop);

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || getDefaultFavicon();
  favicon.alt = '';
  favicon.onerror = () => {
    favicon.src = getDefaultFavicon();
  };

  const info = document.createElement('div');
  info.className = 'tab-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'tab-title-row';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';

  titleRow.appendChild(title);

  // Add active badge if tab is open
  if (isActive) {
    const activeBadge = document.createElement('span');
    activeBadge.className = 'active-badge';
    activeBadge.textContent = 'Active';
    titleRow.appendChild(activeBadge);
  }

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = truncateUrl(tab.url);

  info.appendChild(titleRow);
  info.appendChild(url);

  const actions = document.createElement('div');
  actions.className = 'tab-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn btn-secondary btn-small restore-tab-btn';
  restoreBtn.textContent = 'Restore';
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreTab(groupId, tab.id);
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary btn-small copy-tab-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.title = 'Open without removing from vault';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await duplicateTab(groupId, tab.id);
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(copyBtn);

  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(actions);

  return item;
}

// Setup event listeners for main actions
function setupEventListeners() {
  // Tab bar navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchToTab(btn.dataset.tab);
    });
  });

  // Shutdown all button
  document.getElementById('vaultAllBtn').addEventListener('click', shutdownAll);

  // Confirmation dialog buttons
  document.getElementById('confirmCancelBtn').addEventListener('click', hideConfirmDialog);
  document.getElementById('confirmVaultBtn').addEventListener('click', onConfirmShutdown);
  document.querySelector('.confirm-dialog-backdrop').addEventListener('click', hideConfirmDialog);

  // Live Tabs panel
  document.getElementById('vaultSelectedBtn').addEventListener('click', vaultSelectedTabs);

  // Home tabs section toggle
  document.getElementById('homeTabsHeader').addEventListener('click', toggleHomeTabsSection);

  // Edit patterns button (switches to Settings tab)
  document.getElementById('editPatternsBtn').addEventListener('click', () => {
    switchToTab('settings');
  });

  // Select All / Deselect All
  document.getElementById('selectAllBtn').addEventListener('click', selectAllTabs);
  document.getElementById('deselectAllBtn').addEventListener('click', deselectAllTabs);

  // Settings panel
  document.getElementById('addPatternBtn').addEventListener('click', addNewPattern);
  document.getElementById('addCurrentTabBtn').addEventListener('click', addCurrentTabAsPattern);
  document.getElementById('newPatternInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewPattern();
  });

  // Theme mode selection
  document.querySelectorAll('input[name="themeMode"]').forEach(radio => {
    radio.addEventListener('change', handleThemeModeChange);
  });

  // Palette selection
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePaletteChange(btn.dataset.palette));
  });

  // Unified search functionality
  document.getElementById('globalSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      handleGlobalSearch(e.target.value);
    }, 200);
  });

  // Keyboard navigation for tab bar
  document.querySelector('.tab-bar').addEventListener('keydown', handleTabBarKeydown);

  // Escape key closes dropdown menus
  document.addEventListener('keydown', handleGlobalKeydown);
}

// Toggle home tabs section collapse
function toggleHomeTabsSection() {
  const section = document.getElementById('homeTabsSection');
  const header = document.getElementById('homeTabsHeader');
  section.classList.toggle('collapsed');

  // Track collapsed state
  homeTabsCollapsed = section.classList.contains('collapsed');

  // Update ARIA expanded state
  const isExpanded = !homeTabsCollapsed;
  header.setAttribute('aria-expanded', isExpanded);
}

// Global keyboard handler
function handleGlobalKeydown(e) {
  // Escape key closes menus and dialogs
  if (e.key === 'Escape') {
    // Close dropdown menus
    const menu = document.querySelector('.group-menu-dropdown');
    if (menu) {
      menu.remove();
      return;
    }

    // Close confirmation dialog
    const dialog = document.getElementById('confirmDialog');
    if (!dialog.classList.contains('hidden')) {
      hideConfirmDialog();
      return;
    }
  }
}

// Handle keyboard navigation in tab bar
function handleTabBarKeydown(e) {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const currentIndex = tabs.findIndex(t => t.classList.contains('active'));

  let newIndex = currentIndex;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    newIndex = (currentIndex + 1) % tabs.length;
    e.preventDefault();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    e.preventDefault();
  } else if (e.key === 'Home') {
    newIndex = 0;
    e.preventDefault();
  } else if (e.key === 'End') {
    newIndex = tabs.length - 1;
    e.preventDefault();
  }

  if (newIndex !== currentIndex) {
    tabs[newIndex].focus();
    switchToTab(tabs[newIndex].dataset.tab);
  }
}

// Update selected count display
function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = `${selectedTabIds.size} selected`;
}

// Select all open tabs
function selectAllTabs() {
  const checkboxes = document.querySelectorAll('.domain-tab-checkbox');
  checkboxes.forEach(cb => {
    if (!cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change'));
    }
  });
}

// Deselect all open tabs
function deselectAllTabs() {
  const checkboxes = document.querySelectorAll('.domain-tab-checkbox');
  checkboxes.forEach(cb => {
    if (cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change'));
    }
  });
}

// Vault selected tabs (renamed from shutdownSelectedTabs)
async function vaultSelectedTabs() {
  if (selectedTabIds.size === 0) {
    showToast('Please select at least one tab to vault.', 'error');
    return;
  }

  const tabCount = selectedTabIds.size;

  // Show confirmation dialog
  const confirmed = await showModalConfirm(
    'Vault Selected Tabs',
    `Vault ${tabCount} selected ${pluralizeTabs(tabCount)}? They will be closed and saved to your vault.`,
    'Vault'
  );

  if (!confirmed) return;

  // Always group by domain for selected tabs
  const response = await chrome.runtime.sendMessage({
    action: 'shutdown-tabs-by-domain',
    tabIds: Array.from(selectedTabIds)
  });

  if (response.success) {
    showToast(`Vaulted ${response.count} ${pluralizeTabs(response.count)}`, 'success');
    await updateLiveTabCount();
    // Refresh live tabs panel
    selectedTabIds.clear();
    await renderLiveTabsPanel();
    updateSelectedCount();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Render home tab patterns list
async function renderHomePatterns() {
  const patterns = await HomeTabs.getHomePatterns();
  const container = document.getElementById('homePatternsContainer');

  clearContainer(container);

  if (patterns.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-patterns';
    emptyState.textContent = 'No home tab patterns set. Home tabs are protected from shutdown.';
    container.appendChild(emptyState);
    return;
  }

  for (const pattern of patterns) {
    const item = document.createElement('div');
    item.className = 'pattern-item';

    const text = document.createElement('span');
    text.className = 'pattern-text';
    text.textContent = pattern;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-pattern-btn';
    deleteBtn.textContent = '\u00D7';
    deleteBtn.setAttribute('aria-label', 'Delete pattern');
    deleteBtn.addEventListener('click', async () => {
      await HomeTabs.removeHomePattern(pattern);
      await renderHomePatterns();
      showToast('Pattern removed', 'success');
    });

    item.appendChild(text);
    item.appendChild(deleteBtn);
    container.appendChild(item);
  }
}

// Add a new pattern
async function addNewPattern() {
  const input = document.getElementById('newPatternInput');
  const pattern = input.value.trim();

  if (!pattern) {
    showToast('Please enter a URL pattern.', 'error');
    return;
  }

  if (pattern.length > 2000) {
    showToast('Pattern is too long (max 2000 characters).', 'error');
    return;
  }

  const result = await HomeTabs.addHomePattern(pattern);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }
  input.value = '';
  await renderHomePatterns();
  showToast('Pattern added', 'success');
}

// Add current tab URL as pattern
async function addCurrentTabAsPattern() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const result = await HomeTabs.addHomePattern(tab.url);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      await renderHomePatterns();
      showToast('Current tab added as home tab', 'success');
    }
  } catch (error) {
    showToast('Could not add current tab', 'error');
  }
}

// Handle global search input (works for both Live and Vault panels)
async function handleGlobalSearch(query) {
  currentSearchQuery = query.trim().toLowerCase();

  if (currentTab === 'live') {
    await renderLiveTabsPanel();
  } else if (currentTab === 'vault') {
    if (!currentSearchQuery) {
      await renderVaultGroups();
    } else {
      await renderSearchResults();
    }
  }
}

// Render search results
async function renderSearchResults() {
  const vault = await VaultStorage.getVault();
  const container = document.getElementById('vaultGroups');

  clearContainer(container);

  // Filter tabs across all groups
  const results = [];
  for (const group of vault.groups) {
    const matchingTabs = group.tabs.filter(tab => {
      const titleMatch = (tab.title || '').toLowerCase().includes(currentSearchQuery);
      const urlMatch = (tab.url || '').toLowerCase().includes(currentSearchQuery);
      return titleMatch || urlMatch;
    });

    if (matchingTabs.length > 0) {
      results.push({ group, tabs: matchingTabs });
    }
  }

  if (results.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No matching tabs found.';
    container.appendChild(emptyState);
    return;
  }

  const totalTabs = results.reduce((sum, r) => sum + r.tabs.length, 0);
  const header = document.createElement('div');
  header.className = 'search-results-header';

  const countSpan = document.createElement('span');
  countSpan.textContent = `${totalTabs} result${totalTabs !== 1 ? 's' : ''} found`;

  const clearBtn = document.createElement('button');
  clearBtn.className = 'clear-search-btn';
  clearBtn.textContent = 'Clear search';
  clearBtn.addEventListener('click', () => {
    document.getElementById('globalSearchInput').value = '';
    currentSearchQuery = '';
    renderVaultGroups();
  });

  header.appendChild(countSpan);
  header.appendChild(clearBtn);
  container.appendChild(header);

  for (const result of results) {
    container.appendChild(createSearchResultGroupCard(result.group, result.tabs));
  }
}

// Create a group card for search results (auto-expanded)
function createSearchResultGroupCard(group, matchingTabs) {
  const card = document.createElement('div');
  card.className = 'group-card expanded'; // Auto-expand search results
  card.dataset.groupId = group.id;

  // Group header
  const header = document.createElement('div');
  header.className = 'group-header';

  const expand = document.createElement('span');
  expand.className = 'group-expand';
  expand.textContent = '\u25B6'; // Right triangle

  const info = document.createElement('div');
  info.className = 'group-info';

  const name = document.createElement('div');
  name.className = 'group-name';
  name.textContent = group.name;

  const count = document.createElement('div');
  count.className = 'group-count';
  count.textContent = `${matchingTabs.length} of ${group.tabs.length} ${pluralizeTabs(group.tabs.length)}`;

  info.appendChild(name);
  info.appendChild(count);

  header.appendChild(expand);
  header.appendChild(info);

  header.addEventListener('click', (e) => {
    card.classList.toggle('expanded');
  });

  // Group tabs container (only matching tabs)
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'group-tabs';

  matchingTabs.forEach(tab => {
    const tabItem = createTabItem(tab, group.id);
    tabsContainer.appendChild(tabItem);
  });

  card.appendChild(header);
  card.appendChild(tabsContainer);

  return card;
}

// Shutdown all tabs (except home tabs)

async function shutdownAll() {
  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();

  const tabsToClose = [];
  const homeTabs = [];

  for (const tab of tabs) {
    if (UrlUtils.isSkippableUrl(tab.url)) continue;
    if (HomeTabs.isHomeTabSync(tab.url, homePatterns)) {
      homeTabs.push(tab);
    } else {
      tabsToClose.push(tab);
    }
  }

  if (tabsToClose.length === 0) {
    showToast('No tabs to vault', 'info');
    return;
  }

  const skipConfirm = await Settings.getSetting('skipShutdownAllConfirm');

  // Always show dialog for 10+ tabs, or if not skipped
  if (!skipConfirm || tabsToClose.length >= 10) {
    showConfirmDialog(tabsToClose.length, homeTabs.length);
  } else {
    await executeShutdownAll();
  }
}

// Show the confirmation dialog
function showConfirmDialog(tabCount, homeTabCount) {
  const dialog = document.getElementById('confirmDialog');
  const tabsCountEl = document.getElementById('confirmTabsCount');
  const homeCountEl = document.getElementById('confirmHomeCount');
  const dontShowCheckbox = document.getElementById('dontShowAgainCheckbox');

  tabsCountEl.textContent = `You are about to vault ${tabCount} ${pluralizeTabs(tabCount)}.`;

  if (homeTabCount > 0) {
    homeCountEl.textContent = `${homeTabCount} home ${pluralizeTabs(homeTabCount)} will be protected.`;
    homeCountEl.classList.remove('hidden');
  } else {
    homeCountEl.textContent = '';
    homeCountEl.classList.add('hidden');
  }

  // Reset checkbox
  dontShowCheckbox.checked = false;

  // Show dialog
  dialog.classList.remove('hidden');
}

// Hide the confirmation dialog
function hideConfirmDialog() {
  const dialog = document.getElementById('confirmDialog');
  dialog.classList.add('hidden');
}

/**
 * Show a themed confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Message to display
 * @param {string} confirmText - Text for confirm button (default: "OK")
 * @returns {Promise<boolean>} - True if confirmed, false if cancelled
 */
function showModalConfirm(title, message, confirmText = 'OK') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('modalDialog');
    const titleEl = document.getElementById('modalDialogTitle');
    const messageEl = document.getElementById('modalDialogMessage');
    const inputEl = document.getElementById('modalDialogInput');
    const confirmBtn = document.getElementById('modalDialogConfirm');
    const cancelBtn = document.getElementById('modalDialogCancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    inputEl.classList.add('hidden');
    confirmBtn.textContent = confirmText;

    const cleanup = () => {
      dialog.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeydown);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeydown);

    dialog.classList.remove('hidden');
    confirmBtn.focus();
  });
}

/**
 * Show a themed prompt dialog
 * @param {string} title - Dialog title
 * @param {string} message - Message to display
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} - Input value if confirmed, null if cancelled
 */
function showModalPrompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('modalDialog');
    const titleEl = document.getElementById('modalDialogTitle');
    const messageEl = document.getElementById('modalDialogMessage');
    const inputEl = document.getElementById('modalDialogInput');
    const confirmBtn = document.getElementById('modalDialogConfirm');
    const cancelBtn = document.getElementById('modalDialogCancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    inputEl.classList.remove('hidden');
    inputEl.value = defaultValue;
    confirmBtn.textContent = 'OK';

    const cleanup = () => {
      dialog.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      inputEl.removeEventListener('keydown', onInputKeydown);
      document.removeEventListener('keydown', onKeydown);
    };

    const onConfirm = () => {
      cleanup();
      resolve(inputEl.value);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onInputKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    inputEl.addEventListener('keydown', onInputKeydown);
    document.addEventListener('keydown', onKeydown);

    dialog.classList.remove('hidden');
    inputEl.focus();
    inputEl.select();
  });
}

// Handle confirm button click
async function onConfirmShutdown() {
  const dontShowCheckbox = document.getElementById('dontShowAgainCheckbox');

  // Save preference if checked
  if (dontShowCheckbox.checked) {
    await Settings.updateSetting('skipShutdownAllConfirm', true);
  }

  hideConfirmDialog();
  await executeShutdownAll();
}

// Execute the actual shutdown
async function executeShutdownAll() {
  const btn = document.getElementById('vaultAllBtn');
  setLoading(btn, true);

  const response = await chrome.runtime.sendMessage({
    action: 'shutdown-all'
  });

  setLoading(btn, false);

  if (response.success) {
    if (response.count > 0) {
      showToast(`Vaulted ${response.count} ${pluralizeTabs(response.count)}`, 'success');
    } else {
      showToast('No tabs to vault', 'info');
    }
    await updateLiveTabCount();
    // Refresh current panel if it's vault or live
    if (currentTab === 'vault') {
      await renderVaultGroups();
    } else if (currentTab === 'live') {
      selectedTabIds.clear();
      await renderLiveTabsPanel();
      updateSelectedCount();
    }
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Restore a group
async function restoreGroup(groupId) {
  const group = await VaultStorage.getGroup(groupId);
  if (!group) {
    showToast('Group not found', 'error');
    return;
  }

  if (group.tabs.length >= 10) {
    const skipConfirm = await Settings.getSetting('skipLargeRestoreConfirm');
    if (!skipConfirm) {
      const confirmed = await showModalConfirm(
        'Restore Group',
        `Restore ${group.tabs.length} ${pluralizeTabs(group.tabs.length)}? This will open them all in new tabs.`,
        'Restore'
      );
      if (!confirmed) return;
    }
  }

  const response = await chrome.runtime.sendMessage({
    action: 'restore-group',
    groupId: groupId
  });

  if (response.success) {
    showToast(`Restored ${response.count} ${pluralizeTabs(response.count)}`, 'success');
    await updateLiveTabCount();
    await renderVaultGroups();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Restore a single tab
async function restoreTab(groupId, tabId) {
  const response = await chrome.runtime.sendMessage({
    action: 'restore-tabs',
    groupId: groupId,
    tabIds: [tabId]
  });

  if (response.success) {
    showToast('Tab restored', 'success');
    await updateLiveTabCount();
    await renderVaultGroups();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Duplicate a group (open without removing from vault)
async function duplicateGroup(groupId) {
  const response = await chrome.runtime.sendMessage({
    action: 'duplicate-group',
    groupId: groupId
  });

  if (response.success) {
    showToast(`Opened ${response.count} ${pluralizeTabs(response.count)} (kept in vault)`, 'success');
    await updateLiveTabCount();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Duplicate a single tab (open without removing from vault)
async function duplicateTab(groupId, tabId) {
  const response = await chrome.runtime.sendMessage({
    action: 'duplicate-tabs',
    groupId: groupId,
    tabIds: [tabId]
  });

  if (response.success) {
    showToast('Tab opened (kept in vault)', 'success');
    await updateLiveTabCount();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Show group menu (rename/delete/move)
async function showGroupMenu(group, anchorEl) {
  // Remove any existing menu
  const existingMenu = document.querySelector('.group-menu-dropdown');
  if (existingMenu) existingMenu.remove();

  // Get vault to determine group position
  const vault = await VaultStorage.getVault();
  const groupIndex = vault.groups.findIndex(g => g.id === group.id);
  const isFirst = groupIndex === 0;
  const isLast = groupIndex === vault.groups.length - 1;

  const menu = document.createElement('div');
  menu.className = 'group-menu-dropdown';
  menu.setAttribute('role', 'menu');

  const renameOption = document.createElement('button');
  renameOption.className = 'menu-option';
  renameOption.setAttribute('role', 'menuitem');
  renameOption.textContent = 'Rename';
  renameOption.addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.remove();
    await showRenameDialog(group);
  });

  // Move Up option (disabled if first)
  const moveUpOption = document.createElement('button');
  moveUpOption.className = 'menu-option';
  moveUpOption.setAttribute('role', 'menuitem');
  moveUpOption.textContent = 'Move Up';
  moveUpOption.disabled = isFirst;
  if (isFirst) {
    moveUpOption.classList.add('menu-option-disabled');
    moveUpOption.setAttribute('aria-disabled', 'true');
  }
  moveUpOption.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isFirst) return;
    menu.remove();
    await moveGroup(group.id, -1);
    showToast('Group moved up', 'success');
  });

  // Move Down option (disabled if last)
  const moveDownOption = document.createElement('button');
  moveDownOption.className = 'menu-option';
  moveDownOption.setAttribute('role', 'menuitem');
  moveDownOption.textContent = 'Move Down';
  moveDownOption.disabled = isLast;
  if (isLast) {
    moveDownOption.classList.add('menu-option-disabled');
    moveDownOption.setAttribute('aria-disabled', 'true');
  }
  moveDownOption.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isLast) return;
    menu.remove();
    await moveGroup(group.id, 1);
    showToast('Group moved down', 'success');
  });

  const deleteOption = document.createElement('button');
  deleteOption.className = 'menu-option menu-option-danger';
  deleteOption.setAttribute('role', 'menuitem');
  deleteOption.textContent = 'Delete';
  deleteOption.addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.remove();
    await deleteGroup(group);
  });

  menu.appendChild(renameOption);
  menu.appendChild(moveUpOption);
  menu.appendChild(moveDownOption);
  menu.appendChild(deleteOption);

  // Position menu relative to anchor
  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;

  document.body.appendChild(menu);

  // Close menu when clicking elsewhere
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Show rename dialog
async function showRenameDialog(group) {
  const newName = await showModalPrompt('Rename Group', 'Enter new group name:', group.name);
  if (newName && newName.trim() && newName !== group.name) {
    await renameGroup(group.id, newName.trim());
  }
}

// Rename a group
async function renameGroup(groupId, newName) {
  await VaultStorage.updateGroup(groupId, { name: newName });
  showToast('Group renamed', 'success');
  await renderVaultGroups();
}

// Delete a group
async function deleteGroup(group) {
  const confirmed = await showModalConfirm(
    'Delete Group',
    `Delete "${group.name}" and all ${group.tabs.length} ${pluralizeTabs(group.tabs.length)} in it?`,
    'Delete'
  );
  if (confirmed) {
    await VaultStorage.removeGroup(group.id);
    showToast('Group deleted', 'success');
    await renderVaultGroups();
  }
}

// Move a group up or down
async function moveGroup(groupId, direction) {
  const vault = await VaultStorage.getVault();
  const index = vault.groups.findIndex(g => g.id === groupId);

  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= vault.groups.length) return;

  // Swap groups
  [vault.groups[index], vault.groups[newIndex]] = [vault.groups[newIndex], vault.groups[index]];

  await VaultStorage.saveVault(vault);
  await renderVaultGroups();
}

// Helper aliases for remaining UIHelpers functions
const getDefaultFavicon = UIHelpers.getDefaultFavicon.bind(UIHelpers);
const truncateUrl = UIHelpers.truncateUrl.bind(UIHelpers);

// ============================================
// DRAG AND DROP HANDLERS (Infrastructure for TV2-007)
// ============================================
// These handlers provide the foundation for dragging tabs between vault groups.
// Full implementation is in TV2-007.
//
// Drag flow:
// 1. User starts dragging a tab item (dragstart)
// 2. As they drag over groups/tabs, visual feedback is shown (dragover)
// 3. On drop, the tab is moved to the target group (drop)
// 4. Cleanup happens after drag ends (dragend)

// Track the currently dragged item
let draggedItem = null;
let draggedTabId = null;
let draggedGroupId = null;
let isDraggingGroup = false; // true when dragging a whole group to reorder

// Handle drag start on a tab item
function handleDragStart(e) {
  draggedItem = e.target.closest('.tab-item');
  if (!draggedItem) return;

  draggedTabId = draggedItem.dataset.tabId;
  draggedGroupId = draggedItem.dataset.groupId;

  // Visual feedback
  draggedItem.classList.add('dragging');

  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', JSON.stringify({
    tabId: draggedTabId,
    groupId: draggedGroupId
  }));
}

// Handle drag end (cleanup)
function handleDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove('dragging');
  }

  // Clear all drag-over states
  document.querySelectorAll('.drag-over, .drop-target').forEach(el => {
    el.classList.remove('drag-over', 'drop-target');
  });

  draggedItem = null;
  draggedTabId = null;
  draggedGroupId = null;
}

// Handle drag over a tab item (for positioning within a group)
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const target = e.target.closest('.tab-item');
  if (!target || target === draggedItem) return;

  // Clear previous targets
  document.querySelectorAll('.drop-target').forEach(el => {
    el.classList.remove('drop-target');
  });

  target.classList.add('drop-target');
}

// Handle drop on a tab item
async function handleDrop(e) {
  e.preventDefault();

  const target = e.target.closest('.tab-item');
  if (!target || target === draggedItem) return;

  const targetGroupId = target.dataset.groupId;
  const targetTabId = target.dataset.tabId;

  target.classList.remove('drop-target');

  // Move the tab
  await moveTabToPosition(draggedGroupId, draggedTabId, targetGroupId, targetTabId);
}

// Handle drag over a group card (for moving tabs or reordering groups)
function handleGroupDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const card = e.target.closest('.group-card');
  if (!card) return;

  const targetGroupId = card.dataset.groupId;

  // Clear previous visual states
  document.querySelectorAll('.drop-above, .drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });

  if (isDraggingGroup) {
    // Group reordering - show drop indicator above or below
    if (targetGroupId === draggedGroupId) return;

    const rect = card.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
      card.classList.add('drop-above');
      card.classList.remove('drop-below');
    } else {
      card.classList.add('drop-below');
      card.classList.remove('drop-above');
    }
  } else {
    // Tab moving to group
    if (targetGroupId === draggedGroupId) return;
    card.classList.add('drag-over');
  }
}

// Handle drag leave from a group card
function handleGroupDragLeave(e) {
  const card = e.target.closest('.group-card');
  if (!card) return;

  // Only remove drag-over if we're actually leaving the card
  const relatedTarget = e.relatedTarget;
  if (relatedTarget && card.contains(relatedTarget)) return;

  card.classList.remove('drag-over', 'drop-above', 'drop-below');
}

// Handle drop on a group card
async function handleGroupDrop(e) {
  e.preventDefault();

  const card = e.target.closest('.group-card');
  if (!card) return;

  const targetGroupId = card.dataset.groupId;
  const wasDropAbove = card.classList.contains('drop-above');

  card.classList.remove('drag-over', 'drop-above', 'drop-below');

  if (isDraggingGroup) {
    // Group reordering
    if (targetGroupId === draggedGroupId) return;
    await reorderGroup(draggedGroupId, targetGroupId, wasDropAbove);
  } else {
    // Tab moving to group
    if (targetGroupId === draggedGroupId) return;
    await moveTabToGroup(draggedGroupId, draggedTabId, targetGroupId);
  }
}

// Move a tab to a specific position within a group (before another tab)
async function moveTabToPosition(sourceGroupId, tabId, targetGroupId, beforeTabId) {
  const vault = await VaultStorage.getVault();

  // Find source group and tab
  const sourceGroup = vault.groups.find(g => g.id === sourceGroupId);
  const targetGroup = vault.groups.find(g => g.id === targetGroupId);

  if (!sourceGroup || !targetGroup) return;

  // Find and remove tab from source
  const tabIndex = sourceGroup.tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  const [tab] = sourceGroup.tabs.splice(tabIndex, 1);

  // Find position to insert in target
  const beforeIndex = targetGroup.tabs.findIndex(t => t.id === beforeTabId);

  if (beforeIndex === -1) {
    // Insert at end
    targetGroup.tabs.push(tab);
  } else {
    // Insert before the target tab
    targetGroup.tabs.splice(beforeIndex, 0, tab);
  }

  // Save and re-render
  await VaultStorage.saveVault(vault);
  await renderVaultGroups();
  showToast('Tab moved', 'success');
}

// Move a tab to a different group (at the end)
async function moveTabToGroup(sourceGroupId, tabId, targetGroupId) {
  const vault = await VaultStorage.getVault();

  // Find groups
  const sourceGroup = vault.groups.find(g => g.id === sourceGroupId);
  const targetGroup = vault.groups.find(g => g.id === targetGroupId);

  if (!sourceGroup || !targetGroup) return;

  // Find and remove tab from source
  const tabIndex = sourceGroup.tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  const [tab] = sourceGroup.tabs.splice(tabIndex, 1);

  // Add to target group at the end
  targetGroup.tabs.push(tab);

  // Save and re-render
  await VaultStorage.saveVault(vault);
  await renderVaultGroups();
  showToast('Tab moved', 'success');
}

// ============================================
// GROUP REORDERING DRAG AND DROP
// ============================================

// Handle drag start for group reordering
function handleGroupReorderDragStart(e) {
  const card = e.target.closest('.group-card');
  if (!card) return;

  isDraggingGroup = true;
  draggedItem = card;
  draggedGroupId = card.dataset.groupId;

  card.classList.add('dragging-group');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'group',
    groupId: draggedGroupId
  }));
}

// Handle drag end for group reordering
function handleGroupReorderDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove('dragging-group');
  }

  document.querySelectorAll('.drag-over, .drop-target, .drop-above, .drop-below').forEach(el => {
    el.classList.remove('drag-over', 'drop-target', 'drop-above', 'drop-below');
  });

  draggedItem = null;
  draggedTabId = null;
  draggedGroupId = null;
  isDraggingGroup = false;
}

// Reorder a group to a new position
async function reorderGroup(sourceGroupId, targetGroupId, insertBefore) {
  const vault = await VaultStorage.getVault();

  const sourceIndex = vault.groups.findIndex(g => g.id === sourceGroupId);
  const targetIndex = vault.groups.findIndex(g => g.id === targetGroupId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

  // Remove the source group
  const [group] = vault.groups.splice(sourceIndex, 1);

  // Calculate new index (accounting for removal)
  let newIndex = targetIndex;
  if (sourceIndex < targetIndex) {
    newIndex = insertBefore ? targetIndex - 1 : targetIndex;
  } else {
    newIndex = insertBefore ? targetIndex : targetIndex + 1;
  }

  // Insert at new position
  vault.groups.splice(newIndex, 0, group);

  await VaultStorage.saveVault(vault);
  await renderVaultGroups();
  showToast('Group reordered', 'success');
}
