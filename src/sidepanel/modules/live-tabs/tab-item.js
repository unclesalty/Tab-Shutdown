// Tab Goblin - Live Tab Item Component
// Creates tab items for Live Tabs panel (both grouped and ungrouped views)

const LiveTabItem = (function() {
  /**
   * Create a favicon element with error fallback
   * @param {string} faviconUrl - URL of the favicon
   * @returns {HTMLElement}
   */
  function createFavicon(faviconUrl) {
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = faviconUrl || UIHelpers.getDefaultFavicon();
    favicon.alt = '';
    favicon.onerror = () => {
      favicon.src = UIHelpers.getDefaultFavicon();
    };
    return favicon;
  }

  /**
   * Create tab info element (title and URL) with optional active badge
   * @param {string} title - Tab title
   * @param {string} url - Tab URL
   * @param {boolean} isActive - Whether to show active badge
   * @returns {HTMLElement}
   */
  function createTabInfo(title, url, isActive = false) {
    const info = document.createElement('div');
    info.className = 'tab-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'tab-title-row';

    const titleEl = document.createElement('div');
    titleEl.className = 'tab-title';
    titleEl.textContent = title || 'Untitled';
    titleRow.appendChild(titleEl);

    if (isActive) {
      const activeBadge = document.createElement('span');
      activeBadge.className = 'active-badge';
      activeBadge.textContent = 'Active';
      titleRow.appendChild(activeBadge);
    }

    const urlEl = document.createElement('div');
    urlEl.className = 'tab-url';
    urlEl.textContent = UIHelpers.truncateUrl(url);

    info.appendChild(titleRow);
    info.appendChild(urlEl);
    return info;
  }

  /**
   * Create action buttons for a tab item
   * @param {Object} tab - Tab object
   * @param {Object} callbacks - Action callbacks { onVault, onClose, onProtect }
   * @returns {HTMLElement}
   */
  function createActionButtons(tab, callbacks) {
    const actions = document.createElement('div');
    actions.className = 'tab-item-actions';

    // Vault button
    const vaultBtn = document.createElement('button');
    vaultBtn.className = 'tab-action-btn vault-btn';
    vaultBtn.textContent = '\u2913'; // Downwards arrow to bar
    vaultBtn.title = 'Vault this tab (save and close)';
    vaultBtn.setAttribute('aria-label', 'Vault this tab');
    vaultBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (callbacks.onVault) await callbacks.onVault(tab);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-action-btn close-btn';
    closeBtn.textContent = '\u2715'; // X mark
    closeBtn.title = 'Close tab to history';
    closeBtn.setAttribute('aria-label', 'Close tab to history');
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (callbacks.onClose) await callbacks.onClose(tab.id);
    });

    // Protect button
    const protectBtn = document.createElement('button');
    protectBtn.className = 'tab-action-btn protect-btn-icon';
    protectBtn.textContent = '\u{1F6E1}'; // Shield icon
    protectBtn.title = 'Protect from shutdown (add to Home Tabs)';
    protectBtn.setAttribute('aria-label', 'Add to Home Tabs');
    protectBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (callbacks.onProtect) await callbacks.onProtect(tab);
    });

    actions.appendChild(vaultBtn);
    actions.appendChild(closeBtn);
    actions.appendChild(protectBtn);

    return actions;
  }

  /**
   * Create a tab item for ungrouped view (with domain badge)
   * @param {Object} tab - Chrome tab object
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   * @param {Object} callbacks - Action callbacks
   * @returns {HTMLElement}
   */
  function createUngrouped(tab, vaultedUrls, callbacks) {
    const domain = UrlUtils.getDomainFromUrl(tab.url) || 'Other';
    const isVaulted = vaultedUrls && vaultedUrls.has(tab.url);

    const item = document.createElement('div');
    item.className = 'ungrouped-tab-item';
    if (tab.active) item.classList.add('current-tab');
    if (isVaulted) item.classList.add('already-vaulted');
    item.dataset.tabId = tab.id;

    // Checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ungrouped-tab-checkbox';
    checkbox.checked = false;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        State.addSelectedTab(tab.id);
      } else {
        State.removeSelectedTab(tab.id);
      }
      if (callbacks.onSelectionChange) callbacks.onSelectionChange();
    });

    // Favicon
    const favicon = createFavicon(tab.favIconUrl);

    // Tab info with domain badge
    const info = document.createElement('div');
    info.className = 'tab-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'tab-title-row';

    const titleEl = document.createElement('div');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title || 'Untitled';
    titleRow.appendChild(titleEl);

    info.appendChild(titleRow);

    // Domain badge
    const domainBadge = document.createElement('div');
    domainBadge.className = 'tab-domain-badge';
    domainBadge.textContent = domain;
    info.appendChild(domainBadge);

    // Action buttons
    const actions = createActionButtons(tab, callbacks);

    item.appendChild(checkbox);
    item.appendChild(favicon);
    item.appendChild(info);
    item.appendChild(actions);

    // Click on row navigates to tab (except on checkbox or buttons)
    item.addEventListener('click', async (e) => {
      if (e.target === checkbox || e.target.closest('button')) return;
      if (callbacks.onNavigate) await callbacks.onNavigate(tab.id);
    });

    return item;
  }

  /**
   * Create a tab item within a domain group
   * @param {Object} tab - Chrome tab object
   * @param {HTMLElement} groupCard - Parent group card element
   * @param {Set} vaultedUrls - Set of already vaulted URLs
   * @param {Object} callbacks - Action callbacks
   * @returns {HTMLElement}
   */
  function createGrouped(tab, groupCard, vaultedUrls, callbacks) {
    const isVaulted = vaultedUrls && vaultedUrls.has(tab.url);

    const item = document.createElement('div');
    item.className = 'domain-tab-item';
    if (tab.active) item.classList.add('current-tab');
    if (isVaulted) item.classList.add('already-vaulted');
    item.dataset.tabId = tab.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'domain-tab-checkbox';
    checkbox.checked = false;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        State.addSelectedTab(tab.id);
      } else {
        State.removeSelectedTab(tab.id);
      }
      if (callbacks.onSelectionChange) callbacks.onSelectionChange();
      if (callbacks.onGroupSelectionChange) callbacks.onGroupSelectionChange(groupCard);
    });

    const favicon = createFavicon(tab.favIconUrl);
    const info = createTabInfo(tab.title, tab.url);
    const actions = createActionButtons(tab, callbacks);

    item.appendChild(checkbox);
    item.appendChild(favicon);
    item.appendChild(info);
    item.appendChild(actions);

    // Click on row navigates to tab (except on checkbox or buttons)
    item.addEventListener('click', async (e) => {
      if (e.target === checkbox || e.target.closest('button')) return;
      if (callbacks.onNavigate) await callbacks.onNavigate(tab.id);
    });

    return item;
  }

  // Public API
  return {
    createFavicon,
    createTabInfo,
    createUngrouped,
    createGrouped
  };
})();
