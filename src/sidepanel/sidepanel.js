// Tab Goblin - Side Panel Script

document.addEventListener('DOMContentLoaded', init);

// Track selected tabs for shutdown
let selectedTabIds = new Set();

// Track collapsed state for accordions (persists across re-renders)
// Groups are expanded by default; this tracks which ones user has collapsed
let collapsedDomainGroups = new Set(); // For Live Tabs panel
let expandedVaultGroups = new Set();  // For Vault panel
let homeTabsCollapsed = false;        // For Home Tabs section

// Debounce timer for search
let searchDebounceTimer = null;

// Debounce timer for tab change events
let tabChangeDebounceTimer = null;

// Current search query (shared across panels)
let currentSearchQuery = '';

// Current active tab
let currentTab = 'live';

// Helper aliases for commonly used UIHelpers functions
const pluralizeTabs = UIHelpers.pluralizeTabs.bind(UIHelpers);
const clearContainer = UIHelpers.clearContainer.bind(UIHelpers);
const showToast = UIHelpers.showToast.bind(UIHelpers);
const setLoading = UIHelpers.setLoading.bind(UIHelpers);
const getDefaultFavicon = UIHelpers.getDefaultFavicon.bind(UIHelpers);
const truncateUrl = UIHelpers.truncateUrl.bind(UIHelpers);

// Check if a tab matches a search query (by title or URL)
function matchesSearch(tab, query) {
  if (!query) return true;
  const titleMatch = (tab.title || '').toLowerCase().includes(query);
  const urlMatch = (tab.url || '').toLowerCase().includes(query);
  return titleMatch || urlMatch;
}

// Refresh the live tabs panel with tab count and selection state
async function refreshLivePanel() {
  await updateLiveTabCount();
  await renderLiveTabsPanel();
  updateSelectedCount();
}

// Create a favicon element with error fallback
function createFavicon(faviconUrl) {
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = faviconUrl || getDefaultFavicon();
  favicon.alt = '';
  favicon.onerror = () => {
    favicon.src = getDefaultFavicon();
  };
  return favicon;
}

// Create tab info element (title and URL) with optional active badge
function createTabInfo(title, url, isActive = false) {
  const info = document.createElement('div');
  info.className = 'tab-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'tab-title-row';

  const titleEl = document.createElement('div');
  titleEl.className = 'tab-title';
  titleEl.textContent = title || 'Untitled';
  titleRow.appendChild(titleEl);

  if (isActive) {
    const activeBadge = document.createElement('span');
    activeBadge.className = 'active-badge';
    activeBadge.textContent = 'Active';
    titleRow.appendChild(activeBadge);
  }

  const urlEl = document.createElement('div');
  urlEl.className = 'tab-url';
  urlEl.textContent = truncateUrl(url);

  info.appendChild(titleRow);
  info.appendChild(urlEl);
  return info;
}

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
  // Update cache and re-render when tabs change (debounced)
  const handleTabChangeImmediate = async () => {
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

  // Debounced version to prevent rapid re-renders when many tabs change at once
  const handleTabChange = () => {
    if (tabChangeDebounceTimer) {
      clearTimeout(tabChangeDebounceTimer);
    }
    tabChangeDebounceTimer = setTimeout(handleTabChangeImmediate, 150);
  };

  chrome.tabs.onCreated.addListener(handleTabChange);
  chrome.tabs.onRemoved.addListener(handleTabChange);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // Only re-render if URL changed
    if (changeInfo.url) {
      handleTabChange();
    }
  });

  // Update when active tab changes (user switches tabs manually)
  chrome.tabs.onActivated.addListener(handleTabChange);
}

// Initialize theme from settings
async function initTheme() {
  try {
    const themeMode = await Settings.getSetting('themeMode');
    const lightPalette = await Settings.getSetting('lightPalette');
    const darkPalette = await Settings.getSetting('darkPalette');

    applyThemeFromSettings(themeMode, lightPalette, darkPalette);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
  } catch (error) {
    // Default to system theme on error
    Themes.applyTheme(null);
  }
}

// Apply theme based on mode and palette settings
function applyThemeFromSettings(themeMode, lightPalette, darkPalette) {
  switch (themeMode) {
    case 'light':
      Themes.applyTheme(lightPalette || 'light');
      break;
    case 'dark':
    case 'custom':
      Themes.applyTheme(darkPalette || 'slate-minimal');
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

  const lightPaletteSelector = document.getElementById('lightPaletteSelector');
  const darkPaletteSelector = document.getElementById('darkPaletteSelector');

  // Hide both selectors first
  lightPaletteSelector.classList.add('hidden');
  darkPaletteSelector.classList.add('hidden');

  if (mode === 'dark') {
    // Show dark palette selector
    darkPaletteSelector.classList.remove('hidden');
    const currentPalette = await Settings.getSetting('darkPalette') || 'slate-minimal';
    Themes.applyTheme(currentPalette);
  } else if (mode === 'light') {
    // Show light palette selector
    lightPaletteSelector.classList.remove('hidden');
    const currentPalette = await Settings.getSetting('lightPalette') || 'light';
    Themes.applyTheme(currentPalette);
  } else {
    // System mode
    Themes.applyTheme(null);
  }
}

// Handle palette button click
async function handlePaletteChange(palette, paletteType) {
  // Determine which selector contains this palette
  const selectorId = paletteType === 'light' ? 'lightPaletteSelector' : 'darkPaletteSelector';
  const settingKey = paletteType === 'light' ? 'lightPalette' : 'darkPalette';

  // Update active state within that selector only
  const selector = document.getElementById(selectorId);
  selector.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.palette === palette);
  });

  // Save and apply
  await Settings.updateSetting(settingKey, palette);
  Themes.applyTheme(palette);
}

// Initialize theme selector UI from settings
async function initThemeSelector() {
  const themeMode = await Settings.getSetting('themeMode') || 'system';
  const lightPalette = await Settings.getSetting('lightPalette') || 'light';
  const darkPalette = await Settings.getSetting('darkPalette') || 'slate-minimal';

  // Set radio button
  const radio = document.querySelector(`input[name="themeMode"][value="${themeMode}"]`);
  if (radio) radio.checked = true;

  // Show/hide palette selectors
  const lightPaletteSelector = document.getElementById('lightPaletteSelector');
  const darkPaletteSelector = document.getElementById('darkPaletteSelector');

  lightPaletteSelector.classList.add('hidden');
  darkPaletteSelector.classList.add('hidden');

  if (themeMode === 'dark') {
    darkPaletteSelector.classList.remove('hidden');
  } else if (themeMode === 'light') {
    lightPaletteSelector.classList.remove('hidden');
  }

  // Set active palettes
  lightPaletteSelector.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.palette === lightPalette);
  });
  darkPaletteSelector.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.palette === darkPalette);
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

  // Home Tabs section persists across Live/Vault, hidden on Settings
  const homeTabsSection = document.getElementById('homeTabsSection');
  if (homeTabsSection) {
    if (tabName === 'settings') {
      homeTabsSection.classList.add('hidden');
    } else {
      homeTabsSection.classList.remove('hidden');
    }
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
      await updateShortcutDisplay();
      break;
  }
}

// Render the entire Live Tabs panel (home section + open tabs)
async function renderLiveTabsPanel() {
  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();
  const searchQuery = currentSearchQuery.toLowerCase();

  // Update view toggle UI based on saved setting
  const viewMode = await Settings.getSetting('liveTabsView') || 'grouped';
  updateViewToggleUI(viewMode);

  // Get vault URLs to check for already-vaulted tabs
  const vault = await VaultStorage.getVault();
  const vaultedUrls = new Set();
  for (const group of vault.groups) {
    for (const tab of group.tabs) {
      vaultedUrls.add(tab.url);
    }
  }

  // Build maps for home tab matching
  const openTabsByUrl = new Map();       // URL -> open tab (for exact matches)
  const openTabsByPattern = new Map();   // pattern -> open tab (for wildcard matches)
  const regularTabs = [];
  const homeTabsToTrack = [];

  for (const tab of tabs) {
    if (UrlUtils.isSkippableUrl(tab.url)) continue;

    // Find which pattern this tab matches (if any)
    const matchingPattern = findMatchingPattern(tab.url, homePatterns);

    if (matchingPattern) {
      // Collect home tabs for batch tracking
      homeTabsToTrack.push({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      });
      openTabsByUrl.set(tab.url, tab);
      // Track by pattern for wildcard support (keeps most recent/first match)
      if (!openTabsByPattern.has(matchingPattern)) {
        openTabsByPattern.set(matchingPattern, tab);
      }
    } else if (matchesSearch(tab, searchQuery)) {
      regularTabs.push(tab);
    }
  }

  // Batch track all home tab instances (single storage read/write)
  if (homeTabsToTrack.length > 0) {
    await HomeTabs.trackManyHomeInstances(homeTabsToTrack);
  }

  // Get all saved home tab instances (includes closed tabs) and filter by search
  const homeInstances = await HomeTabs.getHomeInstances();
  const filteredInstances = homeInstances.filter(instance => matchesSearch(instance, searchQuery));

  // Render home tabs section with instances and open tab info
  renderHomeTabsSection(filteredInstances, openTabsByUrl, openTabsByPattern, homePatterns);

  // Render regular tabs
  renderOpenTabsList(regularTabs, vaultedUrls);
}

// Find which pattern a URL matches (returns the pattern string or null)
function findMatchingPattern(url, patterns) {
  if (!url || !patterns || patterns.length === 0) return null;

  for (const pattern of patterns) {
    try {
      if (HomeTabs.patternToRegex(pattern).test(url)) {
        return pattern;
      }
    } catch (error) {
      // Skip invalid patterns
    }
  }
  return null;
}

// Render the Home Tabs section
// instances: saved home tab instances (may be open or closed)
// openTabsByUrl: Map of URL -> open tab object (exact matches)
// openTabsByPattern: Map of pattern -> open tab object (for wildcard patterns)
function renderHomeTabsSection(instances, openTabsByUrl, openTabsByPattern, homePatterns) {
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

  // Helper to check if a pattern is a wildcard pattern (contains *)
  const isWildcardPattern = (pattern) => pattern && pattern.includes('*');

  // Helper to check if an instance has an open tab (exact URL or same pattern)
  const isInstanceOpen = (instance) => {
    if (openTabsByUrl.has(instance.url)) return true;
    const matchingPattern = findMatchingPattern(instance.url, homePatterns);
    return matchingPattern && openTabsByPattern.has(matchingPattern);
  };

  // Helper to get the open tab for an instance
  const getOpenTabForInstance = (instance) => {
    const exactMatch = openTabsByUrl.get(instance.url);
    if (exactMatch) return exactMatch;
    const matchingPattern = findMatchingPattern(instance.url, homePatterns);
    if (matchingPattern) return openTabsByPattern.get(matchingPattern);
    return null;
  };

  // Consolidate instances that match the same wildcard pattern
  // Keep one representative instance per wildcard pattern (most recently seen)
  const consolidatedInstances = [];
  const seenWildcardPatterns = new Set();

  // Sort by lastSeen descending first so we keep the most recent
  const sortedByRecent = [...instances].sort((a, b) => b.lastSeen - a.lastSeen);

  for (const instance of sortedByRecent) {
    const matchingPattern = findMatchingPattern(instance.url, homePatterns);

    if (matchingPattern && isWildcardPattern(matchingPattern)) {
      // Wildcard pattern - only keep one instance per pattern
      if (!seenWildcardPatterns.has(matchingPattern)) {
        seenWildcardPatterns.add(matchingPattern);
        // Mark with the pattern for later reference
        instance._matchedPattern = matchingPattern;
        consolidatedInstances.push(instance);
      }
    } else {
      // Exact URL pattern - keep all instances
      consolidatedInstances.push(instance);
    }
  }

  clearContainer(container);
  countEl.textContent = consolidatedInstances.length;

  if (consolidatedInstances.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'home-tabs-empty';
    emptyState.textContent = 'No protected tabs';
    container.appendChild(emptyState);
    return;
  }

  // Sort: open tabs first, then by lastSeen
  const sortedInstances = [...consolidatedInstances].sort((a, b) => {
    const aOpen = isInstanceOpen(a);
    const bOpen = isInstanceOpen(b);
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return b.lastSeen - a.lastSeen;
  });

  for (const instance of sortedInstances) {
    const openTab = getOpenTabForInstance(instance);
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

  // Use openTab data if available (more current), fallback to instance
  // For SPAs, show the current tab's info when it's at a different URL
  const favicon = createFavicon(openTab?.favIconUrl || instance.favIconUrl);
  const displayUrl = isOpen ? openTab.url : instance.url;
  const displayTitle = openTab?.title || instance.title;
  const info = createTabInfo(displayTitle, displayUrl);

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
  unprotectBtn.textContent = '\u2715'; // ✕ Multiplication X (matches other close buttons)
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
  // Find pattern to remove: exact URL match first, then regex match
  let patternToRemove = patterns.includes(tabUrl) ? tabUrl : null;

  if (!patternToRemove) {
    patternToRemove = patterns.find(pattern => {
      try {
        return HomeTabs.patternToRegex(pattern).test(tabUrl);
      } catch {
        return false;
      }
    });
  }

  if (patternToRemove) {
    await HomeTabs.removeHomePattern(patternToRemove);
    await HomeTabs.cleanupOrphanedInstances();
    showToast('Tab unprotected', 'success');
    await renderLiveTabsPanel();
    updateSelectedCount();
  }
}

// Render the Open Tabs based on current view mode
async function renderOpenTabsList(tabs, vaultedUrls) {
  const container = document.getElementById('domainGroupsList');
  const countEl = document.getElementById('openTabsCount');
  const viewMode = await Settings.getSetting('liveTabsView') || 'grouped';

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

  if (viewMode === 'grouped') {
    renderGroupedView(tabs, container, vaultedUrls);
  } else {
    renderUngroupedView(tabs, container, vaultedUrls);
  }
}

// Render tabs grouped by domain (accordion style)
function renderGroupedView(tabs, container, vaultedUrls) {
  // Group tabs by domain
  const domainGroups = UrlUtils.groupTabsByDomain(tabs);

  // Sort domains by tab count (descending)
  const sortedDomains = Object.keys(domainGroups).sort((a, b) =>
    domainGroups[b].length - domainGroups[a].length
  );

  // Create domain group cards
  for (const domain of sortedDomains) {
    const domainTabs = domainGroups[domain];
    container.appendChild(createDomainGroupCard(domain, domainTabs, vaultedUrls));
  }
}

// Render tabs in flat list sorted by domain
function renderUngroupedView(tabs, container, vaultedUrls) {
  // Sort tabs by domain, then by title
  const sorted = [...tabs].sort((a, b) => {
    const domainA = UrlUtils.getDomainFromUrl(a.url) || '';
    const domainB = UrlUtils.getDomainFromUrl(b.url) || '';
    const domainCompare = domainA.localeCompare(domainB);
    if (domainCompare !== 0) return domainCompare;
    return (a.title || '').localeCompare(b.title || '');
  });

  for (const tab of sorted) {
    container.appendChild(createUngroupedTabItem(tab, vaultedUrls));
  }
}

// Create a tab item for ungrouped view
function createUngroupedTabItem(tab, vaultedUrls) {
  const domain = UrlUtils.getDomainFromUrl(tab.url) || 'Other';
  const isVaulted = vaultedUrls && vaultedUrls.has(tab.url);

  const item = document.createElement('div');
  item.className = 'ungrouped-tab-item';
  if (tab.active) {
    item.classList.add('current-tab');
  }
  if (isVaulted) {
    item.classList.add('already-vaulted');
  }
  item.dataset.tabId = tab.id;

  // Checkbox for selection
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'ungrouped-tab-checkbox';
  checkbox.checked = false;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      selectedTabIds.add(tab.id);
    } else {
      selectedTabIds.delete(tab.id);
    }
    updateSelectedCount();
  });

  // Favicon
  const favicon = createFavicon(tab.favIconUrl);

  // Tab info with domain badge
  const info = document.createElement('div');
  info.className = 'tab-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'tab-title-row';

  const titleEl = document.createElement('div');
  titleEl.className = 'tab-title';
  titleEl.textContent = tab.title || 'Untitled';
  titleRow.appendChild(titleEl);

  info.appendChild(titleRow);

  // Domain badge
  const domainBadge = document.createElement('div');
  domainBadge.className = 'tab-domain-badge';
  domainBadge.textContent = domain;
  info.appendChild(domainBadge);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'tab-item-actions';

  // Vault button
  const vaultBtn = document.createElement('button');
  vaultBtn.className = 'tab-action-btn vault-btn';
  vaultBtn.textContent = '\u2913';
  vaultBtn.title = 'Vault this tab (save and close)';
  vaultBtn.setAttribute('aria-label', 'Vault this tab');
  vaultBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await vaultSingleTab(tab);
  });

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-action-btn close-btn';
  closeBtn.textContent = '\u{2715}';
  closeBtn.title = 'Close tab to history';
  closeBtn.setAttribute('aria-label', 'Close tab to history');
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await closeTabToHistory(tab.id);
  });

  // Protect button
  const protectBtn = document.createElement('button');
  protectBtn.className = 'tab-action-btn protect-btn-icon';
  protectBtn.textContent = '\u{1F6E1}';
  protectBtn.title = 'Protect from shutdown (add to Home Tabs)';
  protectBtn.setAttribute('aria-label', 'Add to Home Tabs');
  protectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab && currentTab.url) {
        await addTabToHome(currentTab.url);
      } else {
        showToast('Error: Tab no longer exists', 'error');
      }
    } catch (err) {
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

// Create a domain group card (accordion style)
function createDomainGroupCard(domain, tabs, vaultedUrls) {
  const card = document.createElement('div');
  card.className = 'domain-group-card';
  card.dataset.domain = domain;

  // Groups are expanded by default; only collapse if user manually collapsed
  // Always expand when searching (to show matching results)
  const shouldExpand = !collapsedDomainGroups.has(domain) || currentSearchQuery;
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
    // Capture checked state before loop - dispatched events call updateDomainGroupCheckbox
    // which can modify groupCheckbox.checked before all iterations complete
    const isChecked = groupCheckbox.checked;
    const tabCheckboxes = card.querySelectorAll('.domain-tab-checkbox');
    tabCheckboxes.forEach(cb => {
      cb.checked = isChecked;
      cb.dispatchEvent(new Event('change'));
    });
    updateDomainGroupCheckbox(card);
    updateDomainVaultButton(card);
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

  // Vault icon button
  const vaultBtn = document.createElement('button');
  vaultBtn.className = 'tab-action-btn domain-action-btn vault-btn domain-vault-btn';
  vaultBtn.textContent = '\u2913'; // ⤓ Downwards arrow to bar
  vaultBtn.title = 'Vault selected tabs from this domain';
  vaultBtn.disabled = true; // Disabled until tabs are selected
  vaultBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selectedInGroup = tabs.filter(t => selectedTabIds.has(t.id));
    if (selectedInGroup.length > 0) {
      await vaultDomainTabs(domain, selectedInGroup);
    }
  });

  // Close icon button (close to history without vaulting)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-action-btn domain-action-btn close-btn domain-close-btn';
  closeBtn.textContent = '\u2715'; // ✕ X mark
  closeBtn.title = 'Close selected tabs to history';
  closeBtn.disabled = true; // Disabled until tabs are selected
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selectedInGroup = tabs.filter(t => selectedTabIds.has(t.id));
    if (selectedInGroup.length > 0) {
      await closeGroupTabsToHistory(selectedInGroup);
    }
  });

  actions.appendChild(vaultBtn);
  actions.appendChild(closeBtn);

  header.appendChild(expand);
  header.appendChild(groupCheckbox);
  header.appendChild(info);
  header.appendChild(actions);

  const toggleExpand = (e) => {
    if (e.target.closest('.domain-group-actions') || e.target.closest('.domain-group-checkbox')) return;
    card.classList.toggle('expanded');
    const isExpanded = card.classList.contains('expanded');
    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    // Track collapsed state (inverted - we track collapsed, not expanded)
    if (isExpanded) {
      collapsedDomainGroups.delete(domain);
    } else {
      collapsedDomainGroups.add(domain);
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
    const tabItem = createDomainTabItem(tab, card, vaultedUrls);
    tabsContainer.appendChild(tabItem);
  });

  card.appendChild(header);
  card.appendChild(tabsContainer);

  return card;
}

// Create a tab item within a domain group
function createDomainTabItem(tab, groupCard, vaultedUrls) {
  const isVaulted = vaultedUrls && vaultedUrls.has(tab.url);

  const item = document.createElement('div');
  item.className = 'domain-tab-item';
  if (tab.active) {
    item.classList.add('current-tab');
  }
  if (isVaulted) {
    item.classList.add('already-vaulted');
  }
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
    updateDomainVaultButton(groupCard);
  });

  const favicon = createFavicon(tab.favIconUrl);
  const info = createTabInfo(tab.title, tab.url);

  // Action buttons container
  const actions = document.createElement('div');
  actions.className = 'tab-item-actions';

  // Vault button - save tab to vault and close it
  const vaultBtn = document.createElement('button');
  vaultBtn.className = 'tab-action-btn vault-btn';
  vaultBtn.textContent = '\u2913'; // ⤓ Downwards arrow to bar (matches History vault)
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

// Update domain action buttons disabled state based on selection
function updateDomainVaultButton(groupCard) {
  const vaultBtn = groupCard.querySelector('.domain-vault-btn');
  const closeBtn = groupCard.querySelector('.domain-close-btn');

  const anySelected = Array.from(groupCard.querySelectorAll('.domain-tab-checkbox'))
    .some(cb => cb.checked);

  if (vaultBtn) vaultBtn.disabled = !anySelected;
  if (closeBtn) closeBtn.disabled = !anySelected;
}

// Vault all tabs from a specific domain
async function vaultDomainTabs(domain, tabs) {
  // Vault ALL tabs from the domain, not just selected ones
  const tabIds = tabs.map(t => t.id);

  if (tabIds.length === 0) {
    showToast('No tabs to vault from this domain', 'info');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    action: 'shutdown-tabs',
    tabIds: tabIds,
    groupName: domain
  });

  if (response.success) {
    showToast(`Vaulted ${response.count} ${pluralizeTabs(response.count)} from ${domain}`, 'success');
    await refreshLivePanel();
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

  // Verify the pattern was saved
  const savedPatterns = await HomeTabs.getHomePatterns();
  if (!savedPatterns.includes(tabUrl)) {
    showToast('Error: Failed to save pattern', 'error');
    return;
  }

  showToast(result.added ? 'Added to Home Tabs' : 'Tab already protected', result.added ? 'success' : 'info');

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
    await refreshLivePanel();
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
      await refreshLivePanel();
    } else {
      showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Error closing tab', 'error');
  }
}

// Close multiple tabs to history (for group close action)
async function closeGroupTabsToHistory(tabs) {
  if (tabs.length === 0) return;

  try {
    const tabIds = tabs.map(t => t.id);
    const response = await chrome.runtime.sendMessage({
      action: 'close-tabs-to-history',
      tabIds: tabIds
    });

    if (response.success) {
      showToast(`Closed ${response.count} ${pluralizeTabs(response.count)} to history`, 'info');
      await refreshLivePanel();
    } else {
      showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Error closing tabs', 'error');
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
  const homePatterns = await HomeTabs.getHomePatterns();

  // Count protected tabs (home tabs + skippable URLs)
  let protectedCount = 0;
  for (const tab of tabs) {
    if (UrlUtils.isSkippableUrl(tab.url) || HomeTabs.isHomeTabSync(tab.url, homePatterns)) {
      protectedCount++;
    }
  }

  document.getElementById('liveTabCount').textContent = tabs.length;
  const protectedEl = document.getElementById('protectedTabCount');
  if (protectedCount > 0) {
    protectedEl.textContent = ` (${protectedCount} protected)`;
  } else {
    protectedEl.textContent = '';
  }
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

// Track collapsed state for history section (collapsed by default)
let historyCollapsed = true;

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

  // Sort by closedAt descending (newest at top, oldest at bottom)
  const sortedTabs = [...history.tabs].sort((a, b) => b.closedAt - a.closedAt);

  // Render history items
  for (const tab of sortedTabs) {
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

  const favicon = createFavicon(tab.favIconUrl);
  const info = createTabInfo(tab.title, tab.url);

  const timeEl = document.createElement('div');
  timeEl.className = 'history-time';
  timeEl.textContent = TabHistory.getTimeRemaining(tab);

  const actions = document.createElement('div');
  actions.className = 'history-item-actions';

  // Restore button
  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'tab-action-btn restore-btn';
  restoreBtn.textContent = '\u2197'; // ↗ North East Arrow (matches Vault)
  restoreBtn.title = 'Restore tab';
  restoreBtn.setAttribute('aria-label', 'Restore tab');
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreFromHistory([tab.id]);
  });

  // Vault button - add to vault without opening
  const vaultBtn = document.createElement('button');
  vaultBtn.className = 'tab-action-btn vault-btn';
  vaultBtn.textContent = '\u2913'; // Downwards arrow to bar (vault/archive symbol)
  vaultBtn.title = 'Add to vault';
  vaultBtn.setAttribute('aria-label', 'Add to vault');
  vaultBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await vaultFromHistory(tab);
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
  actions.appendChild(vaultBtn);
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

// Vault a tab from history (add to vault without opening)
async function vaultFromHistory(tab) {
  // Create a new vault group with today's date
  const groupName = `From History - ${new Date().toLocaleDateString()}`;

  // Check if a group with this name exists, otherwise create one
  const vault = await VaultStorage.getVault();
  let existingGroup = vault.groups.find(g => g.name === groupName);

  if (existingGroup) {
    // Add to existing group
    await VaultStorage.addTabsToGroup(existingGroup.id, [{
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl
    }]);
  } else {
    // Create new group
    await VaultStorage.addGroup(groupName, [{
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl
    }]);
  }

  // Remove from history
  await TabHistory.removeFromHistory(tab.id);

  showToast('Added to vault', 'success');
  await renderHistorySection();
  await renderVaultGroups();
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
  actions.className = 'group-actions group-icon-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'tab-action-btn group-action-btn restore-btn';
  restoreBtn.textContent = '\u2197'; // ↗ North East Arrow
  restoreBtn.title = 'Open All';
  restoreBtn.setAttribute('aria-label', 'Open all tabs');
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreGroup(group.id);
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'tab-action-btn group-action-btn copy-btn';
  copyBtn.textContent = '\u29C9'; // ⧉ Two Joined Squares
  copyBtn.title = 'Copy all URLs to clipboard';
  copyBtn.setAttribute('aria-label', 'Copy all URLs');
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await copyGroupUrls(group);
  });

  const renameBtn = document.createElement('button');
  renameBtn.className = 'tab-action-btn group-action-btn rename-btn';
  renameBtn.textContent = '\u270E'; // ✎ Lower Right Pencil
  renameBtn.title = 'Rename';
  renameBtn.setAttribute('aria-label', 'Rename group');
  renameBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await showRenameDialog(group);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tab-action-btn group-action-btn delete-btn';
  deleteBtn.textContent = '\u2715'; // ✕ Multiplication X
  deleteBtn.title = 'Delete';
  deleteBtn.setAttribute('aria-label', 'Delete group');
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteGroup(group);
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(renameBtn);
  actions.appendChild(deleteBtn);

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
    item.title = 'Tab not open \u2014 click Open to open';
    item.setAttribute('aria-label', `${tab.title || 'Tab'} (not open)`);
  }

  // Drag-and-drop attributes for vault tabs
  item.draggable = true;
  item.addEventListener('dragstart', handleDragStart);
  item.addEventListener('dragend', handleDragEnd);
  item.addEventListener('dragover', handleDragOver);
  item.addEventListener('drop', handleDrop);

  const favicon = createFavicon(tab.favIconUrl);
  const info = createTabInfo(tab.title, tab.url, isActive);

  const actions = document.createElement('div');
  actions.className = 'tab-actions vault-item-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'tab-action-btn vault-item-btn restore-btn';
  restoreBtn.textContent = '\u2197'; // ↗ North East Arrow
  restoreBtn.title = 'Open';
  restoreBtn.setAttribute('aria-label', 'Open tab');
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreTab(groupId, tab.id);
  });

  const copyBtn = document.createElement('button');
  copyBtn.className = 'tab-action-btn vault-item-btn copy-btn';
  copyBtn.textContent = '\u29C9'; // ⧉ Two Joined Squares
  copyBtn.title = 'Copy URL to clipboard';
  copyBtn.setAttribute('aria-label', 'Copy URL to clipboard');
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await copyTabUrl(tab);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tab-action-btn vault-item-btn delete-btn';
  deleteBtn.textContent = '\u2715'; // ✕ Multiplication X
  deleteBtn.title = 'Delete';
  deleteBtn.setAttribute('aria-label', 'Delete from vault');
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteVaultTab(groupId, tab.id);
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(deleteBtn);

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

  // Live Tabs panel
  document.getElementById('vaultSelectedBtn').addEventListener('click', vaultSelectedTabs);

  // Home tabs section toggle
  document.getElementById('homeTabsHeader').addEventListener('click', toggleHomeTabsSection);

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

  // Light palette selection
  document.querySelectorAll('#lightPaletteSelector .palette-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePaletteChange(btn.dataset.palette, 'light'));
  });

  // Dark palette selection
  document.querySelectorAll('#darkPaletteSelector .palette-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePaletteChange(btn.dataset.palette, 'dark'));
  });

  // Unified search functionality
  document.getElementById('globalSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      handleGlobalSearch(e.target.value);
    }, 200);
  });

  // Import/Export buttons
  document.getElementById('exportVaultBtn').addEventListener('click', exportVault);
  document.getElementById('importBookmarksBtn').addEventListener('click', triggerImportFilePicker);
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);

  // View toggle buttons
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => handleViewToggle(btn.dataset.view));
  });

  // View toggle keyboard navigation
  const viewToggle = document.querySelector('.view-toggle');
  if (viewToggle) {
    viewToggle.addEventListener('keydown', handleViewToggleKeydown);
  }

  // Keyboard shortcut configuration
  document.getElementById('configureShortcutBtn').addEventListener('click', openShortcutConfig);

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

// Update selected count display and button states
function updateSelectedCount() {
  const count = selectedTabIds.size;
  document.getElementById('selectedCount').textContent = `${count} selected`;

  // Enable/disable Vault Selected button based on selection
  const vaultSelectedBtn = document.getElementById('vaultSelectedBtn');
  vaultSelectedBtn.disabled = count === 0;
}

// Set all tab checkboxes to a specific state
function setAllTabCheckboxes(checked) {
  document.querySelectorAll('.domain-tab-checkbox').forEach(cb => {
    if (cb.checked !== checked) {
      cb.checked = checked;
      cb.dispatchEvent(new Event('change'));
    }
  });
}

// Select all open tabs
function selectAllTabs() {
  setAllTabCheckboxes(true);
}

// Deselect all open tabs
function deselectAllTabs() {
  setAllTabCheckboxes(false);
}

// Vault selected tabs (renamed from shutdownSelectedTabs)
async function vaultSelectedTabs() {
  if (selectedTabIds.size === 0) {
    showToast('Please select at least one tab to vault.', 'error');
    return;
  }

  const tabCount = selectedTabIds.size;

  // Show confirmation dialog
  const confirmed = await Dialog.showModalConfirm(
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
    const matchingTabs = group.tabs.filter(tab => matchesSearch(tab, currentSearchQuery));
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
    await showVaultAllConfirmDialog(tabsToClose.length, homeTabs.length);
  } else {
    await executeShutdownAll();
  }
}

// Show the Vault All confirmation dialog using the unified modal
async function showVaultAllConfirmDialog(tabCount, homeTabCount) {
  const message = `You are about to vault ${tabCount} ${pluralizeTabs(tabCount)}.`;
  const subMessage = homeTabCount > 0
    ? `${homeTabCount} home ${pluralizeTabs(homeTabCount)} will be protected.`
    : undefined;

  const result = await Dialog.showModal({
    title: 'Confirm Vault All',
    message,
    subMessage,
    confirmText: 'Vault Tabs',
    checkboxText: "Don't show this again (except for 10+ tabs)"
  });

  if (result.confirmed) {
    // Save preference if checkbox was checked
    if (result.checkboxChecked) {
      await Settings.updateSetting('skipShutdownAllConfirm', true);
    }
    await executeShutdownAll();
  }
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

// Open all tabs from a group (keeps them in vault)
async function restoreGroup(groupId) {
  const group = await VaultStorage.getGroup(groupId);
  if (!group) {
    showToast('Group not found', 'error');
    return;
  }

  if (group.tabs.length >= 10) {
    const skipConfirm = await Settings.getSetting('skipLargeRestoreConfirm');
    if (!skipConfirm) {
      const confirmed = await Dialog.showModalConfirm(
        'Open Group',
        `Open ${group.tabs.length} ${pluralizeTabs(group.tabs.length)}? They will remain in your vault.`,
        'Open'
      );
      if (!confirmed) return;
    }
  }

  const response = await chrome.runtime.sendMessage({
    action: 'duplicate-group',
    groupId: groupId,
    navigate: true
  });

  if (response.success) {
    showToast(`Opened ${response.count} ${pluralizeTabs(response.count)}`, 'success');
    await updateLiveTabCount();
    await updateOpenTabsCache();
    await renderVaultGroups();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Open a single tab from vault (keeps it in vault)
async function restoreTab(groupId, tabId) {
  const response = await chrome.runtime.sendMessage({
    action: 'duplicate-tabs',
    groupId: groupId,
    tabIds: [tabId],
    navigate: true
  });

  if (response.success) {
    showToast('Tab opened', 'success');
    await updateLiveTabCount();
    await updateOpenTabsCache();
    await renderVaultGroups();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Copy all URLs from a group to clipboard
async function copyGroupUrls(group) {
  try {
    const urls = group.tabs.map(t => t.url).join('\n');
    await navigator.clipboard.writeText(urls);
    showToast(`Copied ${group.tabs.length} URL${group.tabs.length !== 1 ? 's' : ''}`, 'success');
  } catch (error) {
    showToast('Failed to copy to clipboard', 'error');
  }
}

// Copy a single tab URL to clipboard
async function copyTabUrl(tab) {
  try {
    await navigator.clipboard.writeText(tab.url);
    showToast('Copied to clipboard', 'success');
  } catch (error) {
    showToast('Failed to copy to clipboard', 'error');
  }
}

// Delete a single tab from the vault
async function deleteVaultTab(groupId, tabId) {
  await VaultStorage.removeTabsFromGroup(groupId, [tabId]);

  // Check if group is now empty and remove it
  const group = await VaultStorage.getGroup(groupId);
  if (group && group.tabs.length === 0) {
    await VaultStorage.removeGroup(groupId);
  }

  showToast('Tab removed', 'success');
  await renderVaultGroups();
}

// Show rename dialog
async function showRenameDialog(group) {
  const newName = await Dialog.showModalPrompt('Rename Group', 'Enter new group name:', group.name);
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
  const confirmed = await Dialog.showModalConfirm(
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

// ============================================
// VIEW TOGGLE FUNCTIONS
// ============================================

// Handle view toggle button click
async function handleViewToggle(view) {
  if (!view || (view !== 'grouped' && view !== 'ungrouped')) return;

  // Save the view setting
  await Settings.updateSetting('liveTabsView', view);

  // Update toggle button UI
  updateViewToggleUI(view);

  // Clear selection when switching views
  selectedTabIds.clear();

  // Re-render the open tabs with the new view mode
  await renderLiveTabsPanel();
  updateSelectedCount();
}

// Update the view toggle button states
function updateViewToggleUI(view) {
  const buttons = document.querySelectorAll('.view-toggle-btn');
  buttons.forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
}

// Handle keyboard navigation for view toggle
function handleViewToggleKeydown(e) {
  const buttons = Array.from(document.querySelectorAll('.view-toggle-btn'));
  const currentIndex = buttons.findIndex(btn => btn.classList.contains('active'));

  let newIndex = currentIndex;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    newIndex = (currentIndex + 1) % buttons.length;
    e.preventDefault();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    e.preventDefault();
  } else if (e.key === 'Enter' || e.key === ' ') {
    // Already handled by click, but ensure it works
    e.preventDefault();
    return;
  } else {
    return;
  }

  if (newIndex !== currentIndex) {
    buttons[newIndex].focus();
    handleViewToggle(buttons[newIndex].dataset.view);
  }
}

// ============================================
// KEYBOARD SHORTCUT FUNCTIONS
// ============================================

// Detect if running on macOS
function isMacOS() {
  return /mac/i.test(navigator.platform);
}

// Format a shortcut string for OS-appropriate display
function formatShortcutForOS(shortcut) {
  if (!shortcut) return null;

  if (isMacOS()) {
    return shortcut.replace(/Ctrl|Command/gi, 'Cmd');
  }
  return shortcut.replace(/Command/gi, 'Ctrl');
}

// Get the current configured shortcut
async function getCurrentShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
    return actionCommand?.shortcut || null;
  } catch {
    return null;
  }
}

// Update the shortcut display in settings
async function updateShortcutDisplay() {
  const shortcutKeysEl = document.getElementById('shortcutKeys');
  if (!shortcutKeysEl) return;

  // Clear existing content
  clearContainer(shortcutKeysEl);

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

// Open Chrome's keyboard shortcut configuration page
async function openShortcutConfig() {
  try {
    await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } catch (error) {
    showToast('Could not open shortcut settings', 'error');
  }
}

// ============================================
// IMPORT/EXPORT FUNCTIONS
// ============================================

// Export the vault as a Netscape Bookmark HTML file
async function exportVault() {
  try {
    const vault = await VaultStorage.getVault();

    if (vault.groups.length === 0) {
      showToast('Vault is empty', 'info');
      return;
    }

    const success = ImportExport.downloadExport(vault);
    if (success) {
      showToast('Vault exported successfully', 'success');
    } else {
      showToast('Failed to export vault', 'error');
    }
  } catch {
    showToast('Failed to export vault', 'error');
  }
}

// Handle import file selection
async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Reset the input so the same file can be selected again
  event.target.value = '';

  try {
    const content = await file.text();
    const result = ImportExport.parseNetscapeBookmarks(content);

    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    if (result.groups.length === 0) {
      showToast('No bookmarks found in file', 'error');
      return;
    }

    const stats = ImportExport.getImportStats(result.groups);

    // Show confirmation dialog
    const groupLabel = stats.groupCount === 1 ? 'group' : 'groups';
    const tabLabel = stats.tabCount === 1 ? 'tab' : 'tabs';
    const confirmed = await Dialog.showModalConfirm(
      'Import Bookmarks?',
      `Found ${stats.groupCount} ${groupLabel} with ${stats.tabCount} ${tabLabel}.\n\nThis will add to your existing vault (nothing will be replaced or deleted).`,
      'Import'
    );

    if (!confirmed) return;

    // Perform import
    const importResult = await ImportExport.importToVault(result.groups);

    // Show result toast
    let message = `Imported ${importResult.groupsAdded} group${importResult.groupsAdded !== 1 ? 's' : ''}`;
    if (importResult.duplicatesSkipped > 0) {
      message += ` (${importResult.duplicatesSkipped} duplicate${importResult.duplicatesSkipped !== 1 ? 's' : ''} skipped)`;
    }
    showToast(message, 'success');

    // Refresh vault display if on vault tab
    if (currentTab === 'vault') {
      await renderVaultGroups();
    }
  } catch {
    showToast('Failed to read file', 'error');
  }
}

// Trigger import file picker
function triggerImportFilePicker() {
  document.getElementById('importFileInput').click();
}

// ============================================
// DRAG AND DROP HANDLERS
// ============================================

// Track the currently dragged item
let draggedItem = null;
let draggedTabId = null;
let draggedGroupId = null;
let isDraggingGroup = false; // true when dragging a whole group to reorder

// Clear all drag-related CSS classes (DRY helper)
function clearDragStyles() {
  document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelectorAll('.drop-above').forEach(el => el.classList.remove('drop-above'));
  document.querySelectorAll('.drop-below').forEach(el => el.classList.remove('drop-below'));
}

// Handle drag start on a tab item
function handleDragStart(e) {
  // Stop propagation to prevent group dragstart from firing
  e.stopPropagation();

  draggedItem = e.target.closest('.tab-item');
  if (!draggedItem) return;

  // Reset group dragging flag - we're dragging a tab, not a group
  isDraggingGroup = false;

  draggedTabId = draggedItem.dataset.tabId;
  draggedGroupId = draggedItem.dataset.groupId;

  // Visual feedback
  draggedItem.classList.add('dragging');

  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', JSON.stringify({
    type: 'tab',
    tabId: draggedTabId,
    groupId: draggedGroupId
  }));
}

// Handle drag end (cleanup)
function handleDragEnd(e) {
  e.stopPropagation(); // Prevent bubbling to group drag end handler

  if (draggedItem) {
    draggedItem.classList.remove('dragging');
  }

  // Clear all drag-over states
  clearDragStyles();

  draggedItem = null;
  draggedTabId = null;
  draggedGroupId = null;
  isDraggingGroup = false;
}

// Handle drag over a tab item (for positioning within a group)
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation(); // Prevent bubbling to group drag over handler
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
  e.stopPropagation(); // Prevent bubbling to group drop handler

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
  const result = await VaultStorage.moveTab(sourceGroupId, tabId, targetGroupId, beforeTabId);

  if (!result.success) return;

  // Clean up expanded state if source group was removed
  if (result.sourceRemoved) {
    expandedVaultGroups.delete(sourceGroupId);
  }

  // Expand target group to show the moved tab
  expandedVaultGroups.add(targetGroupId);

  await renderVaultGroups();
  showToast('Tab moved', 'success');
}

// Move a tab to a different group (at the end)
async function moveTabToGroup(sourceGroupId, tabId, targetGroupId) {
  const result = await VaultStorage.moveTab(sourceGroupId, tabId, targetGroupId, null);

  if (!result.success) return;

  // Clean up expanded state if source group was removed
  if (result.sourceRemoved) {
    expandedVaultGroups.delete(sourceGroupId);
  }

  // Expand target group to show the moved tab
  expandedVaultGroups.add(targetGroupId);

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

  clearDragStyles();

  draggedItem = null;
  draggedTabId = null;
  draggedGroupId = null;
  isDraggingGroup = false;
}

// Reorder a group to a new position
async function reorderGroup(sourceGroupId, targetGroupId, insertBefore) {
  const success = await VaultStorage.moveGroup(sourceGroupId, targetGroupId, insertBefore);

  if (!success) return;

  await renderVaultGroups();
  showToast('Group reordered', 'success');
}
