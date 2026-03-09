// Tab Goblin - Vault Panel Coordinator
// Orchestrates VaultGroupCard, VaultTabItem, HistoryUI, and DragDrop modules

const VaultPanel = (function() {
  let _onNavigate = null;

  function init(options) {
    _onNavigate = options?.onNavigate || null;

    DragDrop.init({
      onVaultChange: renderGroups
    });

    VaultTabItem.init({
      onRestore: restoreTab,
      onCopy: copyTabUrl,
      onDelete: deleteVaultTab,
      onNavigate: _onNavigate,
      findOpenTabByUrl: State.findOpenTabByUrl.bind(State),
      onDragStart: DragDrop.handleDragStart,
      onDragEnd: DragDrop.handleDragEnd,
      onDragOver: DragDrop.handleDragOver,
      onDrop: DragDrop.handleDrop
    });

    VaultGroupCard.init({
      onRestoreGroup: restoreGroup,
      onCopyGroupUrls: copyGroupUrls,
      onRenameGroup: showRenameDialog,
      onDeleteGroup: deleteGroup,
      createTabItem: VaultTabItem.create,
      onGroupDragStart: DragDrop.handleGroupReorderDragStart,
      onGroupDragEnd: DragDrop.handleGroupReorderDragEnd,
      onGroupDragOver: DragDrop.handleGroupDragOver,
      onGroupDragLeave: DragDrop.handleGroupDragLeave,
      onGroupDrop: DragDrop.handleGroupDrop
    });

    HistoryUI.init({
      onVaultChange: renderGroups
    });
  }

  async function renderGroups() {
    const vault = await VaultStorage.getVault();
    const container = document.getElementById('vaultGroups');

    UIHelpers.clearContainer(container);

    if (vault.groups.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Your vault is empty. Shutdown some tabs to get started!';
      container.appendChild(emptyState);
      return;
    }

    vault.groups.forEach(group => {
      container.appendChild(VaultGroupCard.create(group));
    });
  }

  async function renderHistory() {
    await HistoryUI.render();
  }

  /**
   * Copy text to clipboard with toast feedback.
   */
  async function copyToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      UIHelpers.showToast(successMessage, 'success');
    } catch (error) {
      UIHelpers.showToast('Failed to copy to clipboard', 'error');
    }
  }

  async function restoreGroup(groupId) {
    const group = await VaultStorage.getGroup(groupId);
    if (!group) {
      UIHelpers.showToast('Group not found', 'error');
      return;
    }

    if (group.tabs.length >= 10) {
      const skipConfirm = await Settings.getSetting('skipLargeRestoreConfirm');
      if (!skipConfirm) {
        const confirmed = await Dialog.showModalConfirm(
          'Open Group',
          `Open ${group.tabs.length} ${UIHelpers.pluralizeTabs(group.tabs.length)}? They will remain in your vault.`,
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
      UIHelpers.showToast(`Opened ${response.count} ${UIHelpers.pluralizeTabs(response.count)}`, 'success');
      await LiveTabsPanel.updateLiveTabCount();
      await updateOpenTabsCache();
      await renderGroups();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  }

  async function restoreTab(groupId, tabId) {
    const response = await chrome.runtime.sendMessage({
      action: 'duplicate-tabs',
      groupId: groupId,
      tabIds: [tabId],
      navigate: true
    });

    if (response.success) {
      UIHelpers.showToast('Tab opened', 'success');
      await LiveTabsPanel.updateLiveTabCount();
      await updateOpenTabsCache();
      await renderGroups();
    } else {
      UIHelpers.showToast('Error: ' + (response.error || 'Unknown error'), 'error');
    }
  }

  async function copyGroupUrls(group) {
    const urls = group.tabs.map(t => t.url).join('\n');
    const count = group.tabs.length;
    await copyToClipboard(urls, `Copied ${count} URL${count !== 1 ? 's' : ''}`);
  }

  async function copyTabUrl(tab) {
    await copyToClipboard(tab.url, 'Copied to clipboard');
  }

  async function deleteVaultTab(groupId, tabId) {
    await VaultStorage.removeTabsFromGroup(groupId, [tabId]);

    // Remove group if it's now empty
    const group = await VaultStorage.getGroup(groupId);
    if (group && group.tabs.length === 0) {
      await VaultStorage.removeGroup(groupId);
    }

    UIHelpers.showToast('Tab removed', 'success');
    await renderGroups();
  }

  async function showRenameDialog(group) {
    const newName = await Dialog.showModalPrompt('Rename Group', 'Enter new group name:', group.name);
    if (newName && newName.trim() && newName !== group.name) {
      await VaultStorage.updateGroup(group.id, { name: newName.trim() });
      UIHelpers.showToast('Group renamed', 'success');
      await renderGroups();
    }
  }

  async function deleteGroup(group) {
    const confirmed = await Dialog.showModalConfirm(
      'Delete Group',
      `Delete "${group.name}" and all ${group.tabs.length} ${UIHelpers.pluralizeTabs(group.tabs.length)} in it?`,
      'Delete'
    );
    if (!confirmed) return;

    await VaultStorage.removeGroup(group.id);
    UIHelpers.showToast('Group deleted', 'success');
    await renderGroups();
  }

  async function updateOpenTabsCache() {
    try {
      const tabs = await chrome.tabs.query({});
      State.setOpenTabsCache(tabs);
    } catch (error) {
      State.setOpenTabsCache([]);
    }
  }

  // Public API - only functions called externally
  return {
    init,
    renderGroups,
    renderHistory
  };
})();
