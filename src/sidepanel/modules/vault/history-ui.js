// Tab Goblin - History UI Module
// Handles rendering and interaction for the History section

const HistoryUI = (function() {
  // Callback for re-rendering vault groups after history changes
  let _onVaultChange = null;

  /**
   * Initialize the module with callbacks
   * @param {Object} options - { onVaultChange }
   */
  function init(options) {
    _onVaultChange = options?.onVaultChange || null;
  }

  /**
   * Render the history section
   */
  async function render() {
    const section = document.getElementById('historySection');
    const header = document.getElementById('historyHeader');
    const container = document.getElementById('historyList');
    const countEl = document.getElementById('historyCount');
    const emptyEl = document.getElementById('historyEmpty');
    const footerEl = document.getElementById('historyFooter');

    // Restore collapsed state
    if (State.isHistoryCollapsed()) {
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
        State.toggleHistoryCollapsed();
        section.classList.toggle('collapsed');
        header.setAttribute('aria-expanded', !State.isHistoryCollapsed());
      });
    }

    // Get history from service worker
    const response = await chrome.runtime.sendMessage({ action: 'get-history' });
    const history = response.success ? response.history : { tabs: [] };

    UIHelpers.clearContainer(container);
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

    // Sort by closedAt descending (newest at top)
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
        UIHelpers.showToast('History cleared', 'success');
        await render();
      });
    }
  }

  /**
   * Create a history item element
   * @param {Object} tab - History tab object
   * @returns {HTMLElement}
   */
  function createHistoryItem(tab) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.tabId = tab.id;

    const favicon = LiveTabItem.createFavicon(tab.favIconUrl);
    const info = LiveTabItem.createTabInfo(tab.title, tab.url);

    const timeEl = document.createElement('div');
    timeEl.className = 'history-time';
    timeEl.textContent = TabHistory.getTimeRemaining(tab);

    const actions = document.createElement('div');
    actions.className = 'history-item-actions';

    // Restore button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'tab-action-btn restore-btn';
    restoreBtn.textContent = '\u2197';
    restoreBtn.title = 'Restore tab';
    restoreBtn.setAttribute('aria-label', 'Restore tab');
    restoreBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await restoreFromHistory([tab.id]);
    });

    // Vault button
    const vaultBtn = document.createElement('button');
    vaultBtn.className = 'tab-action-btn vault-btn';
    vaultBtn.textContent = '\u2913';
    vaultBtn.title = 'Add to vault';
    vaultBtn.setAttribute('aria-label', 'Add to vault');
    vaultBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await vaultFromHistory(tab);
    });

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'tab-action-btn close-btn';
    removeBtn.textContent = '\u2715';
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

  /**
   * Restore tabs from history
   * @param {string[]} tabIds - Tab IDs to restore
   */
  async function restoreFromHistory(tabIds) {
    const response = await chrome.runtime.sendMessage({
      action: 'restore-from-history',
      tabIds: tabIds
    });

    if (response.success) {
      UIHelpers.showToast(`Restored ${response.count} ${UIHelpers.pluralizeTabs(response.count)}`, 'success');
      await render();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  }

  /**
   * Remove tabs from history without restoring
   * @param {string[]} tabIds - Tab IDs to remove
   */
  async function removeFromHistory(tabIds) {
    const response = await chrome.runtime.sendMessage({
      action: 'remove-from-history',
      tabIds: tabIds
    });

    if (response.success) {
      UIHelpers.showToast('Removed from history', 'info');
      await render();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  }

  /**
   * Vault a tab from history
   * @param {Object} tab - Tab to vault
   */
  async function vaultFromHistory(tab) {
    const groupName = `From History - ${new Date().toLocaleDateString()}`;
    const vault = await VaultStorage.getVault();
    let existingGroup = vault.groups.find(g => g.name === groupName);

    if (existingGroup) {
      await VaultStorage.addTabsToGroup(existingGroup.id, [{
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }]);
    } else {
      await VaultStorage.addGroup(groupName, [{
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }]);
    }

    await TabHistory.removeFromHistory(tab.id);

    UIHelpers.showToast('Added to vault', 'success');
    await render();
    if (_onVaultChange) await _onVaultChange();
  }

  // Public API
  return {
    init,
    render,
    restoreFromHistory,
    removeFromHistory,
    vaultFromHistory
  };
})();
