// Tab Goblin - Vault Tab Item Component
// Creates tab items for Vault panel

const VaultTabItem = (function() {
  // Callbacks for actions (set during init)
  let _callbacks = {
    onRestore: null,
    onCopy: null,
    onDelete: null,
    onNavigate: null,
    findOpenTabByUrl: null,
    onDragStart: null,
    onDragEnd: null,
    onDragOver: null,
    onDrop: null
  };

  /**
   * Initialize the module with action callbacks
   * @param {Object} callbacks - Action callbacks
   */
  function init(callbacks) {
    _callbacks = callbacks || {};
  }

  /**
   * Create a vault tab item element
   * @param {Object} tab - Tab object from vault
   * @param {string} groupId - Parent group ID
   * @returns {HTMLElement}
   */
  function create(tab, groupId) {
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.dataset.tabId = tab.id;
    item.dataset.groupId = groupId;

    // Check if this tab is currently open
    const openTab = _callbacks.findOpenTabByUrl ? _callbacks.findOpenTabByUrl(tab.url) : null;
    const isActive = !!openTab;

    if (isActive) {
      item.classList.add('active-tab');
      item.dataset.openTabId = openTab.id;
      item.title = 'Click to navigate to this tab';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Navigate to ${tab.title || 'tab'}`);
      item.addEventListener('click', async (e) => {
        if (e.target.closest('button')) return;
        if (_callbacks.onNavigate) await _callbacks.onNavigate(openTab.id);
      });
      item.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (_callbacks.onNavigate) await _callbacks.onNavigate(openTab.id);
        }
      });
    } else {
      item.classList.add('inactive-tab');
      item.title = 'Tab not open \u2014 click Open to open';
      item.setAttribute('aria-label', `${tab.title || 'Tab'} (not open)`);
    }

    // Drag-and-drop attributes
    item.draggable = true;
    if (_callbacks.onDragStart) item.addEventListener('dragstart', _callbacks.onDragStart);
    if (_callbacks.onDragEnd) item.addEventListener('dragend', _callbacks.onDragEnd);
    if (_callbacks.onDragOver) item.addEventListener('dragover', _callbacks.onDragOver);
    if (_callbacks.onDrop) item.addEventListener('drop', _callbacks.onDrop);

    const favicon = LiveTabItem.createFavicon(tab.favIconUrl);
    const info = LiveTabItem.createTabInfo(tab.title, tab.url, isActive);

    const actions = document.createElement('div');
    actions.className = 'tab-actions vault-item-actions';

    // Open button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'tab-action-btn vault-item-btn restore-btn';
    restoreBtn.textContent = '\u2197';
    restoreBtn.title = 'Open';
    restoreBtn.setAttribute('aria-label', 'Open tab');
    restoreBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onRestore) await _callbacks.onRestore(groupId, tab.id);
    });

    // Copy URL button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'tab-action-btn vault-item-btn copy-btn';
    copyBtn.textContent = '\u29C9';
    copyBtn.title = 'Copy URL to clipboard';
    copyBtn.setAttribute('aria-label', 'Copy URL to clipboard');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onCopy) await _callbacks.onCopy(tab);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tab-action-btn vault-item-btn delete-btn';
    deleteBtn.textContent = '\u2715';
    deleteBtn.title = 'Delete';
    deleteBtn.setAttribute('aria-label', 'Delete from vault');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onDelete) await _callbacks.onDelete(groupId, tab.id);
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(favicon);
    item.appendChild(info);
    item.appendChild(actions);

    return item;
  }

  // Public API
  return {
    init,
    create
  };
})();
