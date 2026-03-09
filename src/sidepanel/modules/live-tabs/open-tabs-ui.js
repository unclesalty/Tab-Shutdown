// Tab Goblin - Open Tabs UI Module
// Handles rendering and interaction for the Open Tabs section (grouped and ungrouped views)

const OpenTabsUI = (function() {
  // Callbacks for actions (set during init)
  let _callbacks = {
    onVaultTab: null,
    onCloseTab: null,
    onProtectTab: null,
    onNavigate: null,
    onSelectionChange: null,
    onVaultDomain: null,
    onCloseDomainTabs: null
  };

  // Drag state for domain group reordering
  let _draggedGroupCard = null;
  let _draggedDomain = null;

  /**
   * Initialize the module with action callbacks
   * @param {Object} callbacks - Action callbacks
   */
  function init(callbacks) {
    _callbacks = callbacks || {};
  }

  /**
   * Render the Open Tabs list based on current view mode
   * @param {Object[]} tabs - Array of Chrome tab objects
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   * @param {string} viewMode - 'grouped' or 'ungrouped'
   */
  async function render(tabs, vaultedUrls, viewMode = 'grouped') {
    const container = document.getElementById('domainGroupsList');
    const countEl = document.getElementById('openTabsCount');

    // Preserve scroll position before re-rendering
    const scrollTop = container.scrollTop;

    UIHelpers.clearContainer(container);
    countEl.textContent = tabs.length;
    State.clearSelection();

    if (tabs.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'All open tabs are protected';
      container.appendChild(emptyState);
      return;
    }

    if (viewMode === 'grouped') {
      await renderGroupedView(tabs, container, vaultedUrls);
    } else {
      renderUngroupedView(tabs, container, vaultedUrls);
    }

    // Restore scroll position after re-rendering
    container.scrollTop = scrollTop;
  }

  /**
   * Render tabs grouped by domain (accordion style)
   * @param {Object[]} tabs - Array of Chrome tab objects
   * @param {HTMLElement} container - Container element
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   */
  async function renderGroupedView(tabs, container, vaultedUrls) {
    const domainGroups = UrlUtils.groupTabsByDomain(tabs);
    const domains = Object.keys(domainGroups);

    // Get persisted domain order
    const savedOrder = await Settings.getSetting('domainGroupOrder') || [];

    // Sort domains: persisted order first, then alphabetically for new domains
    const sortedDomains = sortDomainsByOrder(domains, savedOrder);

    // Update persisted order to include any new domains
    await updateDomainOrder(sortedDomains);

    for (const domain of sortedDomains) {
      const domainTabs = domainGroups[domain];
      container.appendChild(createDomainGroupCard(domain, domainTabs, vaultedUrls));
    }
  }

  /**
   * Sort domains by persisted order, with new domains sorted alphabetically at the end
   * @param {string[]} domains - Current domains
   * @param {string[]} savedOrder - Persisted domain order
   * @returns {string[]} - Sorted domains
   */
  function sortDomainsByOrder(domains, savedOrder) {
    const orderMap = new Map(savedOrder.map((d, i) => [d, i]));

    // Separate known and new domains
    const knownDomains = domains.filter(d => orderMap.has(d));
    const newDomains = domains.filter(d => !orderMap.has(d));

    // Sort known domains by their saved position
    knownDomains.sort((a, b) => orderMap.get(a) - orderMap.get(b));

    // Sort new domains alphabetically
    newDomains.sort((a, b) => a.localeCompare(b));

    return [...knownDomains, ...newDomains];
  }

  /**
   * Update the persisted domain order (add new domains, remove stale ones)
   * @param {string[]} currentDomains - Current domain list in sorted order
   */
  async function updateDomainOrder(currentDomains) {
    const savedOrder = await Settings.getSetting('domainGroupOrder') || [];

    // Only update if the order has changed
    const currentSet = new Set(currentDomains);
    const filteredSaved = savedOrder.filter(d => currentSet.has(d));

    // Check if new domains were added or old ones removed
    if (filteredSaved.length !== currentDomains.length ||
        !currentDomains.every((d, i) => filteredSaved[i] === d || !savedOrder.includes(d))) {
      await Settings.updateSetting('domainGroupOrder', currentDomains);
    }
  }

  /**
   * Reorder a domain group to a new position
   * @param {string} sourceDomain - Domain being moved
   * @param {string} targetDomain - Target domain for positioning
   * @param {boolean} insertBefore - Insert before target (true) or after (false)
   */
  async function reorderDomainGroup(sourceDomain, targetDomain, insertBefore) {
    const savedOrder = await Settings.getSetting('domainGroupOrder') || [];

    const sourceIndex = savedOrder.indexOf(sourceDomain);
    const targetIndex = savedOrder.indexOf(targetDomain);

    if (sourceIndex === -1 || targetIndex === -1) return false;
    if (sourceIndex === targetIndex) return false;

    // Remove from current position
    savedOrder.splice(sourceIndex, 1);

    // Find new target index (may have shifted after removal)
    let newTargetIndex = savedOrder.indexOf(targetDomain);
    if (!insertBefore) {
      newTargetIndex++;
    }

    // Insert at new position
    savedOrder.splice(newTargetIndex, 0, sourceDomain);

    await Settings.updateSetting('domainGroupOrder', savedOrder);
    return true;
  }

  /**
   * Render tabs in flat list sorted by domain
   * @param {Object[]} tabs - Array of Chrome tab objects
   * @param {HTMLElement} container - Container element
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   */
  function renderUngroupedView(tabs, container, vaultedUrls) {
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

  /**
   * Create a tab item for ungrouped view
   * @param {Object} tab - Chrome tab object
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   * @returns {HTMLElement}
   */
  function createUngroupedTabItem(tab, vaultedUrls) {
    return LiveTabItem.createUngrouped(tab, vaultedUrls, {
      onVault: _callbacks.onVaultTab,
      onClose: _callbacks.onCloseTab,
      onProtect: async (t) => {
        if (_callbacks.onProtectTab) await _callbacks.onProtectTab(t);
      },
      onSelectionChange: _callbacks.onSelectionChange,
      onNavigate: _callbacks.onNavigate
    });
  }

  /**
   * Create a domain group card (accordion style)
   * @param {string} domain - Domain name
   * @param {Object[]} tabs - Tabs for this domain
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   * @returns {HTMLElement}
   */
  function createDomainGroupCard(domain, tabs, vaultedUrls) {
    const card = document.createElement('div');
    card.className = 'domain-group-card';
    card.dataset.domain = domain;

    // Expand if not manually collapsed OR if searching
    const shouldExpand = !State.isDomainGroupCollapsed(domain) || State.getSearchQuery();
    if (shouldExpand) {
      card.classList.add('expanded');
    }

    // Group header
    const header = document.createElement('div');
    header.className = 'domain-group-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    header.setAttribute('aria-label', `${domain}, ${tabs.length} ${UIHelpers.pluralizeTabs(tabs.length)}`);

    // Drag handle for reordering
    const dragHandle = document.createElement('span');
    dragHandle.className = 'domain-group-drag-handle';
    dragHandle.textContent = '\u2630'; // Hamburger menu icon
    dragHandle.title = 'Drag to reorder';
    dragHandle.draggable = true;
    dragHandle.addEventListener('dragstart', (e) => handleGroupDragStart(e, card, domain));
    dragHandle.addEventListener('dragend', handleGroupDragEnd);

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
    groupCheckbox.addEventListener('change', () => {
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
    count.textContent = `${tabs.length} ${UIHelpers.pluralizeTabs(tabs.length)}`;

    info.appendChild(name);
    info.appendChild(count);

    const actions = document.createElement('div');
    actions.className = 'domain-group-actions';

    // Vault button
    const vaultBtn = document.createElement('button');
    vaultBtn.className = 'tab-action-btn domain-action-btn vault-btn domain-vault-btn';
    vaultBtn.textContent = '\u2913';
    vaultBtn.title = 'Vault selected tabs from this domain';
    vaultBtn.disabled = true;
    vaultBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selectedInGroup = tabs.filter(t => State.hasSelectedTab(t.id));
      if (selectedInGroup.length > 0 && _callbacks.onVaultDomain) {
        await _callbacks.onVaultDomain(domain, selectedInGroup);
      }
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-action-btn domain-action-btn close-btn domain-close-btn';
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Close selected tabs to history';
    closeBtn.disabled = true;
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selectedInGroup = tabs.filter(t => State.hasSelectedTab(t.id));
      if (selectedInGroup.length > 0 && _callbacks.onCloseDomainTabs) {
        await _callbacks.onCloseDomainTabs(selectedInGroup);
      }
    });

    actions.appendChild(vaultBtn);
    actions.appendChild(closeBtn);

    header.appendChild(dragHandle);
    header.appendChild(expand);
    header.appendChild(groupCheckbox);
    header.appendChild(info);
    header.appendChild(actions);

    // Drag-drop handlers for group reordering
    card.addEventListener('dragover', handleGroupDragOver);
    card.addEventListener('dragleave', handleGroupDragLeave);
    card.addEventListener('drop', handleGroupDrop);

    const toggleExpand = (e) => {
      if (e.target.closest('.domain-group-actions') || e.target.closest('.domain-group-checkbox')) return;
      card.classList.toggle('expanded');
      const isExpanded = card.classList.contains('expanded');
      header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      State.setDomainGroupCollapsed(domain, !isExpanded);
    };

    header.addEventListener('click', toggleExpand);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand(e);
      }
    });

    // Tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'domain-group-tabs';

    tabs.forEach(tab => {
      tabsContainer.appendChild(createDomainTabItem(tab, card, vaultedUrls));
    });

    card.appendChild(header);
    card.appendChild(tabsContainer);

    return card;
  }

  /**
   * Create a tab item within a domain group
   * @param {Object} tab - Chrome tab object
   * @param {HTMLElement} groupCard - Parent group card
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   * @returns {HTMLElement}
   */
  function createDomainTabItem(tab, groupCard, vaultedUrls) {
    return LiveTabItem.createGrouped(tab, groupCard, vaultedUrls, {
      onVault: _callbacks.onVaultTab,
      onClose: _callbacks.onCloseTab,
      onProtect: async (t) => {
        if (_callbacks.onProtectTab) await _callbacks.onProtectTab(t);
      },
      onSelectionChange: _callbacks.onSelectionChange,
      onGroupSelectionChange: (card) => {
        updateDomainGroupCheckbox(card);
        updateDomainVaultButton(card);
      },
      onNavigate: _callbacks.onNavigate
    });
  }

  /**
   * Update domain group checkbox based on individual tab checkboxes
   * @param {HTMLElement} groupCard - Group card element
   */
  function updateDomainGroupCheckbox(groupCard) {
    const tabCheckboxes = groupCard.querySelectorAll('.domain-tab-checkbox');
    const groupCheckbox = groupCard.querySelector('.domain-group-checkbox');

    const allChecked = Array.from(tabCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(tabCheckboxes).some(cb => cb.checked);

    groupCheckbox.checked = allChecked;
    groupCheckbox.indeterminate = someChecked && !allChecked;
  }

  /**
   * Update domain action buttons disabled state based on selection
   * @param {HTMLElement} groupCard - Group card element
   */
  function updateDomainVaultButton(groupCard) {
    const vaultBtn = groupCard.querySelector('.domain-vault-btn');
    const closeBtn = groupCard.querySelector('.domain-close-btn');

    const anySelected = Array.from(groupCard.querySelectorAll('.domain-tab-checkbox'))
      .some(cb => cb.checked);

    if (vaultBtn) vaultBtn.disabled = !anySelected;
    if (closeBtn) closeBtn.disabled = !anySelected;
  }

  // ==================== Domain Group Drag-Drop Handlers ====================

  /**
   * Handle drag start for domain group reordering
   */
  function handleGroupDragStart(e, card, domain) {
    e.stopPropagation();
    _draggedGroupCard = card;
    _draggedDomain = domain;

    card.classList.add('dragging-group');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'domain-group',
      domain: domain
    }));
  }

  /**
   * Handle drag end for domain group reordering
   */
  function handleGroupDragEnd(e) {
    if (_draggedGroupCard) {
      _draggedGroupCard.classList.remove('dragging-group');
    }
    clearDragStyles();
    _draggedGroupCard = null;
    _draggedDomain = null;
  }

  /**
   * Handle drag over a domain group card
   */
  function handleGroupDragOver(e) {
    if (!_draggedDomain) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const card = e.target.closest('.domain-group-card');
    if (!card) return;

    const targetDomain = card.dataset.domain;
    if (targetDomain === _draggedDomain) return;

    // Clear previous indicators
    document.querySelectorAll('.domain-group-card.drop-above, .domain-group-card.drop-below')
      .forEach(el => el.classList.remove('drop-above', 'drop-below'));

    // Determine drop position
    const rect = card.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
      card.classList.add('drop-above');
      card.classList.remove('drop-below');
    } else {
      card.classList.add('drop-below');
      card.classList.remove('drop-above');
    }
  }

  /**
   * Handle drag leave from a domain group card
   */
  function handleGroupDragLeave(e) {
    const card = e.target.closest('.domain-group-card');
    if (!card) return;

    const relatedTarget = e.relatedTarget;
    if (relatedTarget && card.contains(relatedTarget)) return;

    card.classList.remove('drop-above', 'drop-below');
  }

  /**
   * Handle drop on a domain group card
   */
  async function handleGroupDrop(e) {
    e.preventDefault();

    const card = e.target.closest('.domain-group-card');
    if (!card || !_draggedDomain) return;

    const targetDomain = card.dataset.domain;
    const wasDropAbove = card.classList.contains('drop-above');

    clearDragStyles();

    if (targetDomain === _draggedDomain) return;

    const success = await reorderDomainGroup(_draggedDomain, targetDomain, wasDropAbove);
    if (success) {
      UIHelpers.showToast('Group reordered', 'success');
      // Trigger refresh via LiveTabsPanel
      if (_callbacks.onSelectionChange) {
        // Use the existing refresh mechanism
        State.emit('domainGroupReorder');
      }
    }
  }

  /**
   * Clear all drag-related CSS classes
   */
  function clearDragStyles() {
    document.querySelectorAll('.domain-group-card.drop-above, .domain-group-card.drop-below, .domain-group-card.dragging-group')
      .forEach(el => el.classList.remove('drop-above', 'drop-below', 'dragging-group'));
  }

  // Public API
  return {
    init,
    render,
    updateDomainGroupCheckbox,
    updateDomainVaultButton
  };
})();
