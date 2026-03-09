// Tab Goblin - Data Settings UI Module
// Handles import/export functionality in Settings panel

const DataSettingsUI = (function() {
  // Callback for refreshing vault after import
  let _onVaultChange = null;

  /**
   * Initialize data settings UI
   * @param {Object} options - { onVaultChange }
   */
  function init(options) {
    _onVaultChange = options?.onVaultChange || null;
    setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    document.getElementById('exportVaultBtn').addEventListener('click', exportVault);
    document.getElementById('importBookmarksBtn').addEventListener('click', triggerImportFilePicker);
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);
  }

  /**
   * Export the vault as a Netscape Bookmark HTML file
   */
  async function exportVault() {
    try {
      const vault = await VaultStorage.getVault();

      if (vault.groups.length === 0) {
        UIHelpers.showToast('Vault is empty', 'info');
        return;
      }

      const success = ImportExport.downloadExport(vault);
      if (success) {
        UIHelpers.showToast('Vault exported successfully', 'success');
      } else {
        UIHelpers.showToast('Failed to export vault', 'error');
      }
    } catch {
      UIHelpers.showToast('Failed to export vault', 'error');
    }
  }

  /**
   * Handle import file selection
   */
  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    try {
      const content = await file.text();
      const result = ImportExport.parseNetscapeBookmarks(content);

      if (result.error) {
        UIHelpers.showToast(result.error, 'error');
        return;
      }

      if (result.groups.length === 0) {
        UIHelpers.showToast('No bookmarks found in file', 'error');
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
      UIHelpers.showToast(message, 'success');

      // Refresh vault display if on vault tab
      if (State.getCurrentTab() === 'vault' && _onVaultChange) {
        await _onVaultChange();
      }
    } catch {
      UIHelpers.showToast('Failed to read file', 'error');
    }
  }

  /**
   * Trigger import file picker
   */
  function triggerImportFilePicker() {
    document.getElementById('importFileInput').click();
  }

  // Public API
  return {
    init,
    exportVault,
    handleImportFile,
    triggerImportFilePicker
  };
})();
