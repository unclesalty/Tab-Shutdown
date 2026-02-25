// Tab Goblin - Vault Group Card Component
// Creates group cards for Vault panel

const VaultGroupCard = (function() {
  // Callbacks for actions (set during init)
  let _callbacks = {
    onRestoreGroup: null,
    onCopyGroupUrls: null,
    onRenameGroup: null,
    onDeleteGroup: null,
    createTabItem: null,
    onGroupDragStart: null,
    onGroupDragEnd: null,
    onGroupDragOver: null,
    onGroupDragLeave: null,
    onGroupDrop: null
  };

  /**
   * Initialize the module with action callbacks
   * @param {Object} callbacks - Action callbacks
   */
  function init(callbacks) {
    _callbacks = callbacks || {};
  }

  /**
   * Create a vault group card element
   * @param {Object} group - Group object from vault
   * @returns {HTMLElement}
   */
  function create(group) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;

    // Restore expanded state if previously expanded
    if (State.isVaultGroupExpanded(group.id)) {
      card.classList.add('expanded');
    }

    // Make the group draggable for reordering
    card.draggable = true;
    if (_callbacks.onGroupDragStart) card.addEventListener('dragstart', _callbacks.onGroupDragStart);
    if (_callbacks.onGroupDragEnd) card.addEventListener('dragend', _callbacks.onGroupDragEnd);

    // Make the group a drop target
    if (_callbacks.onGroupDragOver) card.addEventListener('dragover', _callbacks.onGroupDragOver);
    if (_callbacks.onGroupDragLeave) card.addEventListener('dragleave', _callbacks.onGroupDragLeave);
    if (_callbacks.onGroupDrop) card.addEventListener('drop', _callbacks.onGroupDrop);

    // Group header
    const header = document.createElement('div');
    header.className = 'group-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', State.isVaultGroupExpanded(group.id) ? 'true' : 'false');
    header.setAttribute('aria-label', `${group.name}, ${group.tabs.length} ${UIHelpers.pluralizeTabs(group.tabs.length)}`);

    // Drag handle
    const dragHandle = document.createElement('span');
    dragHandle.className = 'group-drag-handle';
    dragHandle.textContent = '\u2630';
    dragHandle.title = 'Drag to reorder';
    dragHandle.setAttribute('aria-hidden', 'true');

    const expand = document.createElement('span');
    expand.className = 'group-expand';
    expand.textContent = '\u25B6';
    expand.setAttribute('aria-hidden', 'true');

    const info = document.createElement('div');
    info.className = 'group-info';

    const name = document.createElement('div');
    name.className = 'group-name';
    name.textContent = group.name;

    const count = document.createElement('div');
    count.className = 'group-count';
    count.textContent = `${group.tabs.length} ${UIHelpers.pluralizeTabs(group.tabs.length)}`;

    info.appendChild(name);
    info.appendChild(count);

    const actions = document.createElement('div');
    actions.className = 'group-actions group-icon-actions';

    // Open All button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'tab-action-btn group-action-btn restore-btn';
    restoreBtn.textContent = '\u2197';
    restoreBtn.title = 'Open All';
    restoreBtn.setAttribute('aria-label', 'Open all tabs');
    restoreBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onRestoreGroup) await _callbacks.onRestoreGroup(group.id);
    });

    // Copy All URLs button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'tab-action-btn group-action-btn copy-btn';
    copyBtn.textContent = '\u29C9';
    copyBtn.title = 'Copy all URLs to clipboard';
    copyBtn.setAttribute('aria-label', 'Copy all URLs');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onCopyGroupUrls) await _callbacks.onCopyGroupUrls(group);
    });

    // Rename button
    const renameBtn = document.createElement('button');
    renameBtn.className = 'tab-action-btn group-action-btn rename-btn';
    renameBtn.textContent = '\u270E';
    renameBtn.title = 'Rename';
    renameBtn.setAttribute('aria-label', 'Rename group');
    renameBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onRenameGroup) await _callbacks.onRenameGroup(group);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tab-action-btn group-action-btn delete-btn';
    deleteBtn.textContent = '\u2715';
    deleteBtn.title = 'Delete';
    deleteBtn.setAttribute('aria-label', 'Delete group');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (_callbacks.onDeleteGroup) await _callbacks.onDeleteGroup(group);
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(dragHandle);
    header.appendChild(expand);
    header.appendChild(info);
    header.appendChild(actions);

    const toggleExpand = (e) => {
      if (e.target.closest('.group-actions') || e.target.closest('.group-drag-handle')) return;
      card.classList.toggle('expanded');
      const isExpanded = card.classList.contains('expanded');
      header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      State.setVaultGroupExpanded(group.id, isExpanded);
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
    tabsContainer.className = 'group-tabs';

    group.tabs.forEach(tab => {
      const tabItem = _callbacks.createTabItem
        ? _callbacks.createTabItem(tab, group.id)
        : VaultTabItem.create(tab, group.id);
      tabsContainer.appendChild(tabItem);
    });

    card.appendChild(header);
    card.appendChild(tabsContainer);

    return card;
  }

  // Public API
  return {
    init,
    create
  };
})();
