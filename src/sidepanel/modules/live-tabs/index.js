// Tab Goblin - Live Tabs Panel Coordinator
// Orchestrates HomeTabsUI, OpenTabsUI, and ViewToggle modules

const LiveTabsPanel = (function() {
  let _onNavigate = null;

  function init(options) {
    _onNavigate = options?.onNavigate || null;

    HomeTabsUI.init({
      onNavigate: _onNavigate,
      onRerender: refresh
    });

    OpenTabsUI.init({
      onVaultTab: vaultSingleTab,
      onCloseTab: closeTabToHistory,
      onProtectTab: protectTab,
      onNavigate: _onNavigate,
      onSelectionChange: updateSelectedCount,
      onVaultDomain: vaultDomainTabs,
      onCloseDomainTabs: closeGroupTabsToHistory
    });

    ViewToggle.init({
      onViewChange: refresh
    });

    setupEventListeners();
  }

  function setupEventListeners() {
    document.getElementById('vaultSelectedBtn')?.addEventListener('click', vaultSelectedTabs);
    document.getElementById('vaultAllBtn')?.addEventListener('click', shutdownAll);
    document.getElementById('selectAllBtn')?.addEventListener('click', () => setAllTabCheckboxes(true));
    document.getElementById('deselectAllBtn')?.addEventListener('click', () => setAllTabCheckboxes(false));

    // Listen for domain group reorder events
    State.subscribe('domainGroupReorder', refresh);
  }

  /**
   * Render just the Home Tabs section (used when opening on Vault tab)
   */
  async function renderHomeTabsSection() {
    const tabs = await chrome.tabs.query({});
    const homePatterns = await HomeTabs.getHomePatterns();
    const searchQuery = State.getSearchQuery();

    // Categorize tabs into home tabs
    const openTabsByUrl = new Map();
    const openTabsByPattern = new Map();
    const homeTabsToTrack = [];

    for (const tab of tabs) {
      if (UrlUtils.isSkippableUrl(tab.url)) continue;

      const matchingPattern = HomeTabsUI.findMatchingPattern(tab.url, homePatterns);

      if (matchingPattern) {
        homeTabsToTrack.push({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        });
        openTabsByUrl.set(tab.url, tab);
        if (!openTabsByPattern.has(matchingPattern)) {
          openTabsByPattern.set(matchingPattern, tab);
        }
      }
    }

    if (homeTabsToTrack.length > 0) {
      await HomeTabs.trackManyHomeInstances(homeTabsToTrack);
    }

    // Filter home instances by search
    const homeInstances = await HomeTabs.getHomeInstances();
    const filteredInstances = homeInstances.filter(instance => matchesSearch(instance, searchQuery));

    HomeTabsUI.render(filteredInstances, openTabsByUrl, openTabsByPattern, homePatterns);
  }

  async function render() {
    const tabs = await chrome.tabs.query({});
    const homePatterns = await HomeTabs.getHomePatterns();
    const searchQuery = State.getSearchQuery();

    const viewMode = await Settings.getSetting('liveTabsView') || 'grouped';
    ViewToggle.updateUI(viewMode);

    // Build set of already-vaulted URLs
    const vault = await VaultStorage.getVault();
    const vaultedUrls = new Set();
    for (const group of vault.groups) {
      for (const tab of group.tabs) {
        vaultedUrls.add(tab.url);
      }
    }

    // Categorize tabs into home tabs and regular tabs
    const openTabsByUrl = new Map();
    const openTabsByPattern = new Map();
    const regularTabs = [];
    const homeTabsToTrack = [];

    for (const tab of tabs) {
      if (UrlUtils.isSkippableUrl(tab.url)) continue;

      const matchingPattern = HomeTabsUI.findMatchingPattern(tab.url, homePatterns);

      if (matchingPattern) {
        homeTabsToTrack.push({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        });
        openTabsByUrl.set(tab.url, tab);
        if (!openTabsByPattern.has(matchingPattern)) {
          openTabsByPattern.set(matchingPattern, tab);
        }
      } else if (matchesSearch(tab, searchQuery)) {
        regularTabs.push(tab);
      }
    }

    if (homeTabsToTrack.length > 0) {
      await HomeTabs.trackManyHomeInstances(homeTabsToTrack);
    }

    // Filter home instances by search
    const homeInstances = await HomeTabs.getHomeInstances();
    const filteredInstances = homeInstances.filter(instance => matchesSearch(instance, searchQuery));

    HomeTabsUI.render(filteredInstances, openTabsByUrl, openTabsByPattern, homePatterns);
    await OpenTabsUI.render(regularTabs, vaultedUrls, viewMode);
  }

  async function refresh() {
    await updateLiveTabCount();
    await render();
    updateSelectedCount();
  }

  function matchesSearch(tab, query) {
    if (!query) return true;
    return (tab.title || '').toLowerCase().includes(query)
      || (tab.url || '').toLowerCase().includes(query);
  }

  function updateSelectedCount() {
    const count = State.getSelectionCount();
    document.getElementById('selectedCount').textContent = `${count} selected`;
    const vaultSelectedBtn = document.getElementById('vaultSelectedBtn');
    if (vaultSelectedBtn) vaultSelectedBtn.disabled = count === 0;
  }

  async function updateLiveTabCount() {
    const tabs = await chrome.tabs.query({});
    const homePatterns = await HomeTabs.getHomePatterns();

    let protectedCount = 0;
    for (const tab of tabs) {
      if (UrlUtils.isSkippableUrl(tab.url) || HomeTabs.isHomeTabSync(tab.url, homePatterns)) {
        protectedCount++;
      }
    }

    document.getElementById('liveTabCount').textContent = tabs.length;
    const protectedEl = document.getElementById('protectedTabCount');
    protectedEl.textContent = protectedCount > 0
      ? ` (${protectedCount} protected)`
      : '';
  }

  function setAllTabCheckboxes(checked) {
    document.querySelectorAll('.domain-tab-checkbox, .ungrouped-tab-checkbox').forEach(cb => {
      if (cb.checked !== checked) {
        cb.checked = checked;
        cb.dispatchEvent(new Event('change'));
      }
    });
  }

  /**
   * Send a message to the service worker and handle the response with
   * a toast notification. Calls refresh() on success.
   */
  async function sendAndRefresh(message, successText) {
    const response = await chrome.runtime.sendMessage(message);

    if (response.success) {
      const count = response.count;
      const toastText = count !== undefined
        ? successText.replace('{count}', `${count} ${UIHelpers.pluralizeTabs(count)}`)
        : successText;
      UIHelpers.showToast(toastText, 'success');
      await refresh();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }

    return response;
  }

  async function protectTab(tab) {
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab?.url) {
        await HomeTabsUI.addToHome(currentTab.url);
        return;
      }
    } catch (err) {
      // Tab no longer exists - fall through to error toast
    }
    UIHelpers.showToast('Error: Tab no longer exists', 'error');
  }

  async function vaultSingleTab(tab) {
    const domain = UrlUtils.getDomainFromUrl(tab.url) || 'Other';
    await sendAndRefresh(
      { action: 'shutdown-tabs', tabIds: [tab.id], groupName: domain },
      'Tab vaulted'
    );
  }

  async function closeTabToHistory(tabId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'close-to-history',
        tabId: tabId
      });

      if (response.success) {
        UIHelpers.showToast('Tab closed to history', 'info');
        await refresh();
      } else {
        UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      UIHelpers.showToast('Error closing tab', 'error');
    }
  }

  async function vaultDomainTabs(domain, tabs) {
    const tabIds = tabs.map(t => t.id);

    if (tabIds.length === 0) {
      UIHelpers.showToast('No tabs to vault from this domain', 'info');
      return;
    }

    await sendAndRefresh(
      { action: 'shutdown-tabs', tabIds: tabIds, groupName: domain },
      `Vaulted {count} from ${domain}`
    );
  }

  async function closeGroupTabsToHistory(tabs) {
    if (tabs.length === 0) return;

    try {
      const tabIds = tabs.map(t => t.id);
      const response = await chrome.runtime.sendMessage({
        action: 'close-tabs-to-history',
        tabIds: tabIds
      });

      if (response.success) {
        UIHelpers.showToast(`Closed ${response.count} ${UIHelpers.pluralizeTabs(response.count)} to history`, 'info');
        await refresh();
      } else {
        UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      UIHelpers.showToast('Error closing tabs', 'error');
    }
  }

  async function vaultSelectedTabs() {
    const tabCount = State.getSelectionCount();
    if (tabCount === 0) {
      UIHelpers.showToast('Please select at least one tab to vault.', 'error');
      return;
    }

    const confirmed = await Dialog.showModalConfirm(
      'Vault Selected Tabs',
      `Vault ${tabCount} selected ${UIHelpers.pluralizeTabs(tabCount)}? They will be closed and saved to your vault.`,
      'Vault'
    );
    if (!confirmed) return;

    const response = await chrome.runtime.sendMessage({
      action: 'shutdown-tabs-by-domain',
      tabIds: State.getSelectedTabIdsArray()
    });

    if (response.success) {
      UIHelpers.showToast(`Vaulted ${response.count} ${UIHelpers.pluralizeTabs(response.count)}`, 'success');
      State.clearSelection();
      await refresh();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  }

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
      UIHelpers.showToast('No tabs to vault', 'info');
      return;
    }

    const skipConfirm = await Settings.getSetting('skipShutdownAllConfirm');

    if (!skipConfirm || tabsToClose.length >= 10) {
      await showVaultAllConfirmDialog(tabsToClose.length, homeTabs.length);
    } else {
      await executeShutdownAll();
    }
  }

  async function showVaultAllConfirmDialog(tabCount, homeTabCount) {
    const message = `You are about to vault ${tabCount} ${UIHelpers.pluralizeTabs(tabCount)}.`;
    const subMessage = homeTabCount > 0
      ? `${homeTabCount} home ${UIHelpers.pluralizeTabs(homeTabCount)} will be protected.`
      : undefined;

    const result = await Dialog.showModal({
      title: 'Confirm Vault All',
      message,
      subMessage,
      confirmText: 'Vault Tabs',
      checkboxText: "Don't show this again (except for 10+ tabs)"
    });

    if (result.confirmed) {
      if (result.checkboxChecked) {
        await Settings.updateSetting('skipShutdownAllConfirm', true);
      }
      await executeShutdownAll();
    }
  }

  async function executeShutdownAll() {
    const btn = document.getElementById('vaultAllBtn');
    UIHelpers.setLoading(btn, true);

    const response = await chrome.runtime.sendMessage({ action: 'shutdown-all' });

    UIHelpers.setLoading(btn, false);

    if (response.success) {
      UIHelpers.showToast(`Vaulted ${response.count} ${UIHelpers.pluralizeTabs(response.count)}`, 'success');
      await refresh();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  }

  // Public API - only functions called externally
  return {
    init,
    render,
    renderHomeTabsSection,
    refresh,
    updateSelectedCount,
    updateLiveTabCount
  };
})();
