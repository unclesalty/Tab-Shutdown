// Tab Vault - Popup Script

document.addEventListener('DOMContentLoaded', init);

// Track selected tabs for shutdown
let selectedTabIds = new Set();

// Debounce timer for search
let searchDebounceTimer = null;

// Current search query
let currentSearchQuery = '';

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
  await updateLiveTabCount();
  await renderVaultGroups();
  setupEventListeners();
  await checkOnboarding();
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
  text.textContent = 'Close tabs to save RAM while keeping them organized. Use "Shutdown All" to vault all tabs, or "Select Tabs" to pick specific ones.';

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

// View management
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');
}

// Update the live tab count in the header
async function updateLiveTabCount() {
  const tabs = await chrome.tabs.query({});
  document.getElementById('liveTabCount').textContent = tabs.length;
}

// Render vault groups in the main content area
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
  document.getElementById('shutdownAllBtn').addEventListener('click', shutdownAll);
  document.getElementById('shutdownSelectedBtn').addEventListener('click', showSelectTabsView);
  document.getElementById('settingsBtn').addEventListener('click', showSettingsView);

  // Select Tabs View
  document.getElementById('backToVaultBtn').addEventListener('click', () => {
    showView('vaultView');
  });
  document.getElementById('confirmShutdownBtn').addEventListener('click', shutdownSelectedTabs);

  // Settings View
  document.getElementById('backFromSettingsBtn').addEventListener('click', () => {
    showView('vaultView');
  });
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

  // Domain view
  document.getElementById('shutdownByDomainBtn').addEventListener('click', showDomainView);
  document.getElementById('backFromDomainBtn').addEventListener('click', () => {
    showView('vaultView');
  });
}

// Show Select Tabs View
async function showSelectTabsView() {
  selectedTabIds.clear();
  showView('selectTabsView');
  document.getElementById('groupNameInput').value = '';
  await renderLiveTabsList();
  updateSelectedCount();
}

// Render live tabs list with checkboxes
async function renderLiveTabsList() {
  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();
  const container = document.getElementById('liveTabsList');

  clearContainer(container);

  for (const tab of tabs) {
    if (isSkippableUrl(tab.url)) continue;

    const isHome = HomeTabs.isHomeTabSync(tab.url, homePatterns);
    container.appendChild(createLiveTabItem(tab, isHome));
  }
}

// Create a live tab item with checkbox
function createLiveTabItem(tab, isHome) {
  const item = document.createElement('div');
  item.className = 'live-tab-item';
  if (isHome) item.classList.add('home-tab');
  item.dataset.tabId = tab.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'live-tab-checkbox';
  checkbox.checked = !isHome; // Uncheck home tabs by default

  if (!isHome) {
    selectedTabIds.add(tab.id);
  }

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      selectedTabIds.add(tab.id);
      item.classList.add('selected');
    } else {
      selectedTabIds.delete(tab.id);
      item.classList.remove('selected');
    }
    updateSelectedCount();
  });

  if (!isHome) item.classList.add('selected');

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

  item.appendChild(checkbox);
  item.appendChild(favicon);
  item.appendChild(info);

  if (isHome) {
    const badge = document.createElement('span');
    badge.className = 'home-badge';
    badge.textContent = 'HOME';
    item.appendChild(badge);
  }

  // Click on row toggles checkbox
  item.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }
  });

  return item;
}

// Update selected count display
function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = `${selectedTabIds.size} selected`;
}

// Shutdown selected tabs
async function shutdownSelectedTabs() {
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
    showView('vaultView');
    await updateLiveTabCount();
    await renderVaultGroups();
  } else {
    showToast('Error: ' + (response.error || 'Unknown error'), 'error');
  }
}

// Show Settings View
async function showSettingsView() {
  showView('settingsView');
  await renderHomePatterns();
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
    deleteBtn.addEventListener('click', async () => {
      await HomeTabs.removeHomePattern(pattern);
      await renderHomePatterns();
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    await HomeTabs.addHomePattern(tab.url);
    await renderHomePatterns();
    showToast('Current tab added as home tab', 'success');
  }
}

// Show Domain View
async function showDomainView() {
  showView('domainView');
  await renderDomainList();
}

// Render domain list
async function renderDomainList() {
  const container = document.getElementById('domainList');

  clearContainer(container);

  const response = await chrome.runtime.sendMessage({ action: 'get-domain-groups' });

  if (!response.success || response.domains.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No tabs open to group by domain.';
    container.appendChild(emptyState);
    return;
  }

  response.domains.sort((a, b) => b.count - a.count);

  for (const domain of response.domains) {
    container.appendChild(createDomainItem(domain));
  }
}

// Create domain item
function createDomainItem(domain) {
  const item = document.createElement('div');
  item.className = 'domain-item';

  const info = document.createElement('div');
  info.className = 'domain-info';

  const name = document.createElement('div');
  name.className = 'domain-name';
  name.textContent = domain.domain;

  const count = document.createElement('div');
  count.className = 'domain-count';
  count.textContent = `${domain.count} ${pluralizeTabs(domain.count)}`;

  info.appendChild(name);
  info.appendChild(count);

  const shutdownBtn = document.createElement('button');
  shutdownBtn.className = 'btn btn-primary btn-small';
  shutdownBtn.textContent = 'Vault';
  shutdownBtn.addEventListener('click', async () => {
    setLoading(shutdownBtn, true);
    const result = await chrome.runtime.sendMessage({
      action: 'shutdown-domain',
      domain: domain.domain
    });

    if (result.success) {
      showToast(`Vaulted ${result.count} ${pluralizeTabs(result.count)} from ${domain.domain}`, 'success');
      await renderDomainList();
      await updateLiveTabCount();
    } else {
      showToast('Error: ' + (result.error || 'Unknown error'), 'error');
    }
    setLoading(shutdownBtn, false);
  });

  item.appendChild(info);
  item.appendChild(shutdownBtn);

  return item;
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
async function shutdownAll() {
  const skipConfirm = await Settings.getSetting('skipShutdownAllConfirm');

  const tabs = await chrome.tabs.query({});
  const homePatterns = await HomeTabs.getHomePatterns();
  const tabsToClose = tabs.filter(tab => {
    if (isSkippableUrl(tab.url)) return false;
    return !HomeTabs.isHomeTabSync(tab.url, homePatterns);
  });

  if (tabsToClose.length === 0) {
    showToast('No tabs to vault', 'info');
    return;
  }

  if (!skipConfirm) {
    const confirmed = confirm(`Close and vault ${tabsToClose.length} ${pluralizeTabs(tabsToClose.length)}?`);
    if (!confirmed) return;
  }

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
    await renderVaultGroups();
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
