// Tab Goblin - Side Panel Entry Point
// Orchestrates all panel modules and handles initialization

document.addEventListener('DOMContentLoaded', init);

/**
 * Initialize the side panel
 */
async function init() {
  // Initialize theme first for immediate visual consistency
  await ThemeUI.init();

  // Update open tabs cache for all modules to use
  await updateOpenTabsCache();

  // Initialize Live Tabs panel coordinator
  LiveTabsPanel.init({
    onNavigate: navigateToTab
  });

  // Initialize Vault panel coordinator
  VaultPanel.init({
    onNavigate: navigateToTab
  });

  // Initialize Settings panel coordinator
  SettingsPanel.init({
    onVaultChange: async () => {
      await VaultPanel.renderGroups();
    }
  });

  // Initialize Search module
  Search.init();

  // Initialize Navigation with panel render callbacks
  Navigation.init({
    vault: async () => {
      await VaultPanel.renderHistory();
      await VaultPanel.renderGroups();
    },
    live: async () => {
      State.clearSelection();
      await LiveTabsPanel.render();
      LiveTabsPanel.updateSelectedCount();
    },
    settings: async () => {
      await SettingsPanel.render();
    }
  });

  await Navigation.loadActiveTab();
  await LiveTabsPanel.updateLiveTabCount();
  await Navigation.renderCurrentPanel();
  setupEventListeners();
  setupTabListeners();
  await checkOnboarding();
}

/**
 * Set up listeners for tab changes to update active indicators
 */
function setupTabListeners() {
  // Update cache and re-render when tabs change (debounced)
  const handleTabChangeImmediate = async () => {
    await updateOpenTabsCache();
    await LiveTabsPanel.updateLiveTabCount();
    // Re-render current panel to reflect tab changes
    const currentTab = State.getCurrentTab();
    if (currentTab === 'vault') {
      await VaultPanel.renderHistory();
      if (State.getSearchQuery()) {
        await Search.renderSearchResults();
      } else {
        await VaultPanel.renderGroups();
      }
    } else if (currentTab === 'live') {
      await LiveTabsPanel.render();
      LiveTabsPanel.updateSelectedCount();
    }
  };

  // Debounced version to prevent rapid re-renders when many tabs change at once
  const handleTabChange = () => {
    const timer = State.getTabChangeDebounceTimer();
    if (timer) {
      clearTimeout(timer);
    }
    State.setTabChangeDebounceTimer(setTimeout(handleTabChangeImmediate, 150));
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

/**
 * Update cache of open tabs (uses State module)
 */
async function updateOpenTabsCache() {
  try {
    const tabs = await chrome.tabs.query({});
    State.setOpenTabsCache(tabs);
  } catch (error) {
    State.setOpenTabsCache([]);
  }
}

/**
 * Navigate to a specific tab
 */
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

/**
 * Check and show onboarding tips
 */
async function checkOnboarding() {
  const onboardingComplete = await Settings.getSetting('onboardingComplete');
  if (!onboardingComplete) {
    showOnboardingTip();
    await Settings.updateSetting('onboardingComplete', true);
  }
}

/**
 * Show onboarding tip
 */
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

/**
 * Setup global event listeners
 * Note: Panel-specific event listeners are handled by their respective modules
 */
function setupEventListeners() {
  // Escape key closes dropdown menus
  document.addEventListener('keydown', handleGlobalKeydown);
}

/**
 * Global keyboard handler
 */
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
