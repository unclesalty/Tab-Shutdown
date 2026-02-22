// Tab Vault - Side Panel Script

document.addEventListener('DOMContentLoaded', init);

// Track selected tabs for shutdown
let selectedTabIds = new Set();

// Debounce timer for search
let searchDebounceTimer = null;

// Current search query
let currentSearchQuery = '';

// Current active tab
let currentTab = 'vault';

// Helper: Pluralize 'tab' based on count
function pluralizeTabs(count) {
  return `tab${count !== 1 ? 's' : ''}`;
}

// Helper: Clear all children from a container
function clearContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

// Helper: Check if URL should be skipped (chrome:// or extension pages)
function isSkippableUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const text = document.createElement('span');
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => toast.remove());

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// Set loading state on button
function setLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

async function init() {
  await loadActiveTab();
  await updateLiveTabCount();
  await renderCurrentPanel();
  setupEventListeners();
  await checkOnboarding();
}

// Load persisted active tab from settings
async function loadActiveTab() {
  try {
    const activeTab = await Settings.getSetting('activeTab');
    if (activeTab && ['vault', 'live', 'settings'].includes(activeTab)) {
      currentTab = activeTab;
    }
  } catch (error) {
    currentTab = 'vault';
  }
  updateTabBarUI();
  showPanel(currentTab);
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
  await saveActiveTab(tabName);
  await renderCurrentPanel();
}

// Render content for current panel
async function renderCurrentPanel() {
  switch (currentTab) {
    case 'vault':
      await renderVaultGroups();
      break;
    case 'live':
      selectedTabIds.clear();
      document.getElementById('groupNameInput').value = '';
      await renderLiveTabsPanel();
      updateSelectedCount();
      break;
    case 'settings':
      await renderHomePatterns();
      break;
  }
}

// Render the entire Live Tabs panel (home section + open tabs)
async function renderLiveTabsPanel() {
  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();

  // Separate home tabs from regular tabs
  const homeTabs = [];
  const regularTabs = [];

  for (const tab of tabs) {
    if (isSkippableUrl(tab.url)) continue;

    if (HomeTabs.isHomeTabSync(tab.url, homePatterns)) {
      homeTabs.push(tab);
    } else {
      regularTabs.push(tab);
    }
  }

  // Render home tabs section
  renderHomeTabsSection(homeTabs, homePatterns);

  // Render regular tabs
  renderOpenTabsList(regularTabs);
}

// Render the Home Tabs section
function renderHomeTabsSection(homeTabs, homePatterns) {
  const container = document.getElementById('homeTabsList');
  const countEl = document.getElementById('homeTabsCount');

  clearContainer(container);
  countEl.textContent = homeTabs.length;

  if (homeTabs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'home-tabs-empty';
    emptyState.textContent = 'No protected tabs open';
    container.appendChild(emptyState);
    return;
  }

  for (const tab of homeTabs) {
    container.appendChild(createHomeTabItem(tab, homePatterns));
  }
}

// Create a home tab item
function createHomeTabItem(tab, homePatterns) {
  const item = document.createElement('div');
  item.className = 'home-tab-item';
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

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = truncateUrl(tab.url);

  info.appendChild(title);
  info.appendChild(url);

  const unprotectBtn = document.createElement('button');
  unprotectBtn.className = 'unprotect-btn';
  unprotectBtn.textContent = '\u2716'; // X mark
  unprotectBtn.title = 'Remove from Home Tabs';
  unprotectBtn.setAttribute('aria-label', 'Remove from Home Tabs');
  unprotectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeTabFromHome(tab.url, homePatterns);
  });

  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(unprotectBtn);

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
  const domainGroups = groupTabsByDomain(tabs);

  // Sort domains by tab count (descending)
  const sortedDomains = Object.keys(domainGroups).sort((a, b) =>
    domainGroups[b].length - domainGroups[a].length
  );

  // Create domain group cards
  for (const domain of sortedDomains) {
    const domainTabs = domainGroups[domain];
    container.appendChild(createDomainGroupCard(domain, domainTabs));

    // Add all tabs to selected by default
    domainTabs.forEach(tab => selectedTabIds.add(tab.id));
  }
}

// Group tabs by domain
function groupTabsByDomain(tabs) {
  const groups = {};
  for (const tab of tabs) {
    const domain = getDomainFromUrl(tab.url) || 'Other';
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(tab);
  }
  return groups;
}

// Get domain from URL
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Create a domain group card (accordion style)
function createDomainGroupCard(domain, tabs) {
  const card = document.createElement('div');
  card.className = 'domain-group-card';
  card.dataset.domain = domain;

  // Group header
  const header = document.createElement('div');
  header.className = 'domain-group-header';

  const expand = document.createElement('span');
  expand.className = 'domain-group-expand';
  expand.textContent = '\u25B6'; // Right triangle

  const groupCheckbox = document.createElement('input');
  groupCheckbox.type = 'checkbox';
  groupCheckbox.className = 'domain-group-checkbox';
  groupCheckbox.checked = true;
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

  header.addEventListener('click', (e) => {
    if (e.target.closest('.domain-group-actions') || e.target.closest('.domain-group-checkbox')) return;
    card.classList.toggle('expanded');
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
  checkbox.checked = true;

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

  const pinBtn = document.createElement('button');
  pinBtn.className = 'pin-home-btn';
  pinBtn.textContent = '\u{1F3E0}'; // House emoji
  pinBtn.title = 'Add to Home Tabs';
  pinBtn.setAttribute('aria-label', 'Add to Home Tabs');
  pinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await addTabToHome(tab.url);
  });

  item.appendChild(checkbox);
  item.appendChild(favicon);
  item.appendChild(info);
  item.appendChild(pinBtn);

  // Click on row toggles checkbox (except on buttons)
  item.addEventListener('click', (e) => {
    if (e.target !== checkbox && !e.target.closest('button')) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }
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
  await HomeTabs.addHomePattern(tabUrl);
  showToast('Added to Home Tabs', 'success');
  await renderLiveTabsPanel();
  updateSelectedCount();
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
  title.textContent = 'Welcome to Tab Vault!';

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

// Create a group card element
function createGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'group-card';
  card.dataset.groupId = group.id;

  // Make the group a drop target for drag-and-drop
  card.addEventListener('dragover', handleGroupDragOver);
  card.addEventListener('dragleave', handleGroupDragLeave);
  card.addEventListener('drop', handleGroupDrop);

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
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showGroupMenu(group, menuBtn);
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(menuBtn);

  header.appendChild(expand);
  header.appendChild(info);
  header.appendChild(actions);

  header.addEventListener('click', (e) => {
    if (e.target.closest('.group-actions')) return;
    card.classList.toggle('expanded');
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

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = truncateUrl(tab.url);

  info.appendChild(title);
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
  document.getElementById('shutdownAllBtn').addEventListener('click', shutdownAll);

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

  // Search functionality
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      handleSearch(e.target.value);
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

  // Update ARIA expanded state
  const isExpanded = !section.classList.contains('collapsed');
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

  const autoGroup = document.getElementById('autoGroupCheckbox').checked;
  const groupName = document.getElementById('groupNameInput').value.trim() || 'Selected Tabs';

  let response;
  if (autoGroup) {
    response = await chrome.runtime.sendMessage({
      action: 'shutdown-tabs-by-domain',
      tabIds: Array.from(selectedTabIds)
    });
  } else {
    response = await chrome.runtime.sendMessage({
      action: 'shutdown-tabs',
      tabIds: Array.from(selectedTabIds),
      groupName: groupName
    });
  }

  if (response.success) {
    showToast(`Vaulted ${response.count} ${pluralizeTabs(response.count)}`, 'success');
    await updateLiveTabCount();
    // Refresh live tabs panel
    selectedTabIds.clear();
    document.getElementById('groupNameInput').value = '';
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

  await HomeTabs.addHomePattern(pattern);
  input.value = '';
  await renderHomePatterns();
  showToast('Pattern added', 'success');
}

// Add current tab URL as pattern
async function addCurrentTabAsPattern() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      await HomeTabs.addHomePattern(tab.url);
      await renderHomePatterns();
      showToast('Current tab added as home tab', 'success');
    }
  } catch (error) {
    showToast('Could not add current tab', 'error');
  }
}

// Handle search input
async function handleSearch(query) {
  currentSearchQuery = query.trim().toLowerCase();

  if (!currentSearchQuery) {
    await renderVaultGroups();
    return;
  }

  await renderSearchResults();
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
    document.getElementById('searchInput').value = '';
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
// Pending shutdown data for confirmation dialog
let pendingShutdownData = null;

async function shutdownAll() {
  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();

  const tabsToClose = [];
  const homeTabs = [];

  for (const tab of tabs) {
    if (isSkippableUrl(tab.url)) continue;
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
  const btn = document.getElementById('shutdownAllBtn');
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
      const confirmed = confirm(`Restore ${group.tabs.length} ${pluralizeTabs(group.tabs.length)}? This will open them all in new tabs.`);
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

  const vault = await VaultStorage.getVault();
  const groupIndex = vault.groups.findIndex(g => g.id === group.id);

  const menu = document.createElement('div');
  menu.className = 'group-menu-dropdown';

  // Move up option
  if (groupIndex > 0) {
    const moveUpOption = document.createElement('button');
    moveUpOption.className = 'menu-option';
    moveUpOption.textContent = 'Move Up';
    moveUpOption.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.remove();
      await moveGroup(group.id, -1);
    });
    menu.appendChild(moveUpOption);
  }

  // Move down option
  if (groupIndex < vault.groups.length - 1) {
    const moveDownOption = document.createElement('button');
    moveDownOption.className = 'menu-option';
    moveDownOption.textContent = 'Move Down';
    moveDownOption.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.remove();
      await moveGroup(group.id, 1);
    });
    menu.appendChild(moveDownOption);
  }

  const renameOption = document.createElement('button');
  renameOption.className = 'menu-option';
  renameOption.textContent = 'Rename';
  renameOption.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.remove();
    showRenameDialog(group);
  });

  const deleteOption = document.createElement('button');
  deleteOption.className = 'menu-option menu-option-danger';
  deleteOption.textContent = 'Delete';
  deleteOption.addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.remove();
    await deleteGroup(group);
  });

  menu.appendChild(renameOption);
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
function showRenameDialog(group) {
  const newName = prompt('Enter new group name:', group.name);
  if (newName && newName.trim() && newName !== group.name) {
    renameGroup(group.id, newName.trim());
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
  const confirmed = confirm(`Delete "${group.name}" and all ${group.tabs.length} ${pluralizeTabs(group.tabs.length)} in it?`);
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

// Utility: Get default favicon
function getDefaultFavicon() {
  return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect fill=%22%23ddd%22 width=%2216%22 height=%2216%22 rx=%222%22/></svg>';
}

// Utility: Truncate URL for display
function truncateUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    const truncatedPath = path.length > 40 ? path.substring(0, 40) + '...' : path;
    return parsed.hostname + truncatedPath;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}

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

// Handle drag over a group card (for moving to a different group)
function handleGroupDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const card = e.target.closest('.group-card');
  if (!card) return;

  const targetGroupId = card.dataset.groupId;

  // Don't allow dropping in the same group (for now)
  if (targetGroupId === draggedGroupId) return;

  card.classList.add('drag-over');
}

// Handle drag leave from a group card
function handleGroupDragLeave(e) {
  const card = e.target.closest('.group-card');
  if (!card) return;

  // Only remove drag-over if we're actually leaving the card
  const relatedTarget = e.relatedTarget;
  if (relatedTarget && card.contains(relatedTarget)) return;

  card.classList.remove('drag-over');
}

// Handle drop on a group card
async function handleGroupDrop(e) {
  e.preventDefault();

  const card = e.target.closest('.group-card');
  if (!card) return;

  const targetGroupId = card.dataset.groupId;
  card.classList.remove('drag-over');

  // Don't allow dropping in the same group
  if (targetGroupId === draggedGroupId) {
    return;
  }

  // Move the tab to the end of the target group
  await moveTabToGroup(draggedGroupId, draggedTabId, targetGroupId);
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
