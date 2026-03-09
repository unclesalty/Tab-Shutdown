// Tab Goblin - Home Tabs UI Module
// Handles rendering and interaction for the Home Tabs section

const HomeTabsUI = (function() {
  // Callbacks for actions (set during init)
  let _callbacks = {
    onNavigate: null,
    onRerender: null
  };

  /**
   * Initialize the module with action callbacks
   * @param {Object} callbacks - { onNavigate, onRerender }
   */
  function init(callbacks) {
    _callbacks = callbacks || {};
    setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    const header = document.getElementById('homeTabsHeader');
    if (header) {
      header.addEventListener('click', toggleSection);
    }
  }

  /**
   * Toggle home tabs section collapse
   */
  function toggleSection() {
    const section = document.getElementById('homeTabsSection');
    const header = document.getElementById('homeTabsHeader');
    section.classList.toggle('collapsed');

    const isCollapsed = section.classList.contains('collapsed');
    State.setHomeTabsCollapsed(isCollapsed);
    header.setAttribute('aria-expanded', !isCollapsed);
  }

  /**
   * Find which pattern a URL matches
   * @param {string} url - URL to check
   * @param {string[]} patterns - Array of patterns
   * @returns {string|null}
   */
  function findMatchingPattern(url, patterns) {
    if (!url || !patterns || patterns.length === 0) return null;

    for (const pattern of patterns) {
      try {
        if (HomeTabs.patternToRegex(pattern).test(url)) {
          return pattern;
        }
      } catch (error) {
        // Skip invalid patterns
      }
    }
    return null;
  }

  /**
   * Render the Home Tabs section
   * @param {Object[]} instances - Saved home tab instances
   * @param {Map} openTabsByUrl - URL -> open tab mapping
   * @param {Map} openTabsByPattern - Pattern -> open tab mapping
   * @param {string[]} homePatterns - Home tab patterns
   */
  function render(instances, openTabsByUrl, openTabsByPattern, homePatterns) {
    const section = document.getElementById('homeTabsSection');
    const header = document.getElementById('homeTabsHeader');
    const container = document.getElementById('homeTabsList');
    const countEl = document.getElementById('homeTabsCount');

    // Restore collapsed state
    if (State.isHomeTabsCollapsed()) {
      section.classList.add('collapsed');
      header.setAttribute('aria-expanded', 'false');
    } else {
      section.classList.remove('collapsed');
      header.setAttribute('aria-expanded', 'true');
    }

    // Helper to check if a pattern is a wildcard pattern
    const isWildcardPattern = (pattern) => pattern && pattern.includes('*');

    // Helper to check if an instance has an open tab
    const isInstanceOpen = (instance) => {
      if (openTabsByUrl.has(instance.url)) return true;
      const matchingPattern = findMatchingPattern(instance.url, homePatterns);
      return matchingPattern && openTabsByPattern.has(matchingPattern);
    };

    // Helper to get the open tab for an instance
    const getOpenTabForInstance = (instance) => {
      const exactMatch = openTabsByUrl.get(instance.url);
      if (exactMatch) return exactMatch;
      const matchingPattern = findMatchingPattern(instance.url, homePatterns);
      if (matchingPattern) return openTabsByPattern.get(matchingPattern);
      return null;
    };

    // Consolidate instances that match the same wildcard pattern
    const consolidatedInstances = [];
    const seenWildcardPatterns = new Set();

    // Sort by lastSeen descending first
    const sortedByRecent = [...instances].sort((a, b) => b.lastSeen - a.lastSeen);

    for (const instance of sortedByRecent) {
      const matchingPattern = findMatchingPattern(instance.url, homePatterns);

      if (matchingPattern && isWildcardPattern(matchingPattern)) {
        if (!seenWildcardPatterns.has(matchingPattern)) {
          seenWildcardPatterns.add(matchingPattern);
          instance._matchedPattern = matchingPattern;
          consolidatedInstances.push(instance);
        }
      } else {
        consolidatedInstances.push(instance);
      }
    }

    UIHelpers.clearContainer(container);
    countEl.textContent = consolidatedInstances.length;

    if (consolidatedInstances.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'home-tabs-empty';
      emptyState.textContent = 'No protected tabs';
      container.appendChild(emptyState);
      return;
    }

    // Sort: open tabs first, then by lastSeen
    const sortedInstances = [...consolidatedInstances].sort((a, b) => {
      const aOpen = isInstanceOpen(a);
      const bOpen = isInstanceOpen(b);
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return b.lastSeen - a.lastSeen;
    });

    for (const instance of sortedInstances) {
      const openTab = getOpenTabForInstance(instance);
      container.appendChild(createHomeTabItem(instance, openTab, homePatterns));
    }
  }

  /**
   * Create a home tab item
   * @param {Object} instance - Saved home tab instance
   * @param {Object|null} openTab - Open chrome tab or null
   * @param {string[]} homePatterns - Home tab patterns
   * @returns {HTMLElement}
   */
  function createHomeTabItem(instance, openTab, homePatterns) {
    const isOpen = !!openTab;

    const item = document.createElement('div');
    item.className = 'home-tab-item' + (isOpen ? ' active' : ' closed');
    item.dataset.url = instance.url;
    if (openTab) {
      item.dataset.tabId = openTab.id;
    }

    const favicon = LiveTabItem.createFavicon(openTab?.favIconUrl || instance.favIconUrl);
    const displayUrl = isOpen ? openTab.url : instance.url;
    const displayTitle = openTab?.title || instance.title;
    const info = LiveTabItem.createTabInfo(displayTitle, displayUrl);

    // Status indicator
    const status = document.createElement('span');
    status.className = 'home-tab-status';
    if (isOpen) {
      status.textContent = 'Active';
      status.classList.add('status-active');
    } else {
      status.textContent = 'Closed';
      status.classList.add('status-closed');
    }

    const unprotectBtn = document.createElement('button');
    unprotectBtn.className = 'unprotect-btn';
    unprotectBtn.textContent = '\u2715';
    unprotectBtn.title = 'Remove from Home Tabs';
    unprotectBtn.setAttribute('aria-label', 'Remove from Home Tabs');
    unprotectBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentPatterns = await HomeTabs.getHomePatterns();
      await removeFromHome(instance.url, currentPatterns);
      await HomeTabs.removeHomeInstance(instance.url);
    });

    item.appendChild(favicon);
    item.appendChild(info);
    item.appendChild(status);
    item.appendChild(unprotectBtn);

    // Click on row: navigate if open, open if closed
    item.addEventListener('click', async (e) => {
      if (e.target.closest('button')) return;

      if (isOpen && openTab) {
        if (_callbacks.onNavigate) await _callbacks.onNavigate(openTab.id);
      } else {
        const newTab = await chrome.tabs.create({ url: instance.url, active: true });
        await HomeTabs.trackHomeInstance({
          url: instance.url,
          title: instance.title,
          favIconUrl: instance.favIconUrl
        });
        await chrome.windows.update(newTab.windowId, { focused: true });
        if (_callbacks.onRerender) await _callbacks.onRerender();
      }
    });

    return item;
  }

  /**
   * Remove a tab from home protection
   * @param {string} tabUrl - URL of the tab
   * @param {string[]} patterns - Current patterns
   */
  async function removeFromHome(tabUrl, patterns) {
    let patternToRemove = patterns.includes(tabUrl) ? tabUrl : null;

    if (!patternToRemove) {
      patternToRemove = patterns.find(pattern => {
        try {
          return HomeTabs.patternToRegex(pattern).test(tabUrl);
        } catch {
          return false;
        }
      });
    }

    if (patternToRemove) {
      await HomeTabs.removeHomePattern(patternToRemove);
      await HomeTabs.cleanupOrphanedInstances();
      UIHelpers.showToast('Tab unprotected', 'success');
      if (_callbacks.onRerender) await _callbacks.onRerender();
    }
  }

  /**
   * Add a tab to home protection
   * @param {string} tabUrl - URL to add
   */
  async function addToHome(tabUrl) {
    if (!tabUrl) {
      UIHelpers.showToast('Error: Invalid tab URL', 'error');
      return;
    }

    const result = await HomeTabs.addHomePattern(tabUrl);
    if (result.error) {
      UIHelpers.showToast(result.error, 'error');
      return;
    }

    const savedPatterns = await HomeTabs.getHomePatterns();
    if (!savedPatterns.includes(tabUrl)) {
      UIHelpers.showToast('Error: Failed to save pattern', 'error');
      return;
    }

    UIHelpers.showToast(result.added ? 'Added to Home Tabs' : 'Tab already protected', result.added ? 'success' : 'info');

    // Clear search and expand section
    if (State.getSearchQuery()) {
      State.clearSearchQuery();
      document.getElementById('globalSearchInput').value = '';
    }
    State.setHomeTabsCollapsed(false);

    if (_callbacks.onRerender) await _callbacks.onRerender();
  }

  // Public API
  return {
    init,
    render,
    toggleSection,
    removeFromHome,
    addToHome,
    findMatchingPattern
  };
})();
