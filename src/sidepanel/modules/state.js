// Tab Goblin - Centralized State Management Module

const State = (function() {
  // Private state
  let _selectedTabIds = new Set();
  let _collapsedDomainGroups = new Set();
  let _expandedVaultGroups = new Set();
  let _homeTabsCollapsed = false;
  let _currentTab = 'live';
  let _currentSearchQuery = '';
  let _searchDebounceTimer = null;
  let _tabChangeDebounceTimer = null;
  let _openTabsCache = [];
  let _historyCollapsed = true;

  const VALID_TABS = ['live', 'vault', 'settings'];

  // Event subscription system
  const _subscribers = {};

  /**
   * Toggle membership in a Set and return the new membership state.
   */
  function toggleSetMember(set, key) {
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    return set.has(key);
  }

  /**
   * Add or remove a key from a Set based on a boolean flag.
   */
  function setMembership(set, key, shouldContain) {
    if (shouldContain) {
      set.add(key);
    } else {
      set.delete(key);
    }
  }

  return {
    // ==================== Event System ====================

    /**
     * Subscribe to state change events.
     * Returns an unsubscribe function.
     */
    subscribe(event, callback) {
      if (!_subscribers[event]) {
        _subscribers[event] = [];
      }
      _subscribers[event].push(callback);

      return () => {
        const index = _subscribers[event].indexOf(callback);
        if (index > -1) {
          _subscribers[event].splice(index, 1);
        }
      };
    },

    emit(event, data) {
      if (!_subscribers[event]) return;
      _subscribers[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // Prevent one subscriber from breaking others
        }
      });
    },

    // ==================== Tab Selection State ====================

    getSelectedTabIds() {
      return new Set(_selectedTabIds);
    },

    getSelectedTabIdsArray() {
      return Array.from(_selectedTabIds);
    },

    addSelectedTab(id) {
      _selectedTabIds.add(id);
      this.emit('selection');
    },

    removeSelectedTab(id) {
      _selectedTabIds.delete(id);
      this.emit('selection');
    },

    toggleSelectedTab(id) {
      const result = toggleSetMember(_selectedTabIds, id);
      this.emit('selection');
      return result;
    },

    clearSelection() {
      _selectedTabIds.clear();
      this.emit('selection');
    },

    setSelectedTabs(ids) {
      _selectedTabIds = new Set(ids);
      this.emit('selection');
    },

    hasSelectedTab(id) {
      return _selectedTabIds.has(id);
    },

    getSelectionCount() {
      return _selectedTabIds.size;
    },

    // ==================== Domain Group Collapse State ====================

    isDomainGroupCollapsed(domain) {
      return _collapsedDomainGroups.has(domain);
    },

    toggleDomainGroup(domain) {
      const result = toggleSetMember(_collapsedDomainGroups, domain);
      this.emit('domainGroupToggle', domain);
      return result;
    },

    setDomainGroupCollapsed(domain, collapsed) {
      setMembership(_collapsedDomainGroups, domain, collapsed);
      this.emit('domainGroupToggle', domain);
    },

    clearCollapsedDomainGroups() {
      _collapsedDomainGroups.clear();
      this.emit('domainGroupToggle', null);
    },

    // ==================== Vault Group Expand State ====================

    isVaultGroupExpanded(groupId) {
      return _expandedVaultGroups.has(groupId);
    },

    toggleVaultGroup(groupId) {
      const result = toggleSetMember(_expandedVaultGroups, groupId);
      this.emit('vaultGroupToggle', groupId);
      return result;
    },

    setVaultGroupExpanded(groupId, expanded) {
      setMembership(_expandedVaultGroups, groupId, expanded);
      this.emit('vaultGroupToggle', groupId);
    },

    clearExpandedVaultGroups() {
      _expandedVaultGroups.clear();
      this.emit('vaultGroupToggle', null);
    },

    // ==================== Home Tabs Collapse State ====================

    isHomeTabsCollapsed() {
      return _homeTabsCollapsed;
    },

    toggleHomeTabsCollapsed() {
      _homeTabsCollapsed = !_homeTabsCollapsed;
      this.emit('homeTabsToggle', _homeTabsCollapsed);
      return _homeTabsCollapsed;
    },

    setHomeTabsCollapsed(collapsed) {
      _homeTabsCollapsed = collapsed;
      this.emit('homeTabsToggle', _homeTabsCollapsed);
    },

    // ==================== History Collapse State ====================

    isHistoryCollapsed() {
      return _historyCollapsed;
    },

    toggleHistoryCollapsed() {
      _historyCollapsed = !_historyCollapsed;
      this.emit('historyToggle', _historyCollapsed);
      return _historyCollapsed;
    },

    setHistoryCollapsed(collapsed) {
      _historyCollapsed = collapsed;
      this.emit('historyToggle', _historyCollapsed);
    },

    // ==================== Current Tab State ====================

    getCurrentTab() {
      return _currentTab;
    },

    setCurrentTab(tabName) {
      if (VALID_TABS.includes(tabName)) {
        _currentTab = tabName;
        this.emit('tabChange', _currentTab);
      }
    },

    // ==================== Search State ====================

    getSearchQuery() {
      return _currentSearchQuery;
    },

    setSearchQuery(query) {
      _currentSearchQuery = query.toLowerCase();
      this.emit('searchChange', _currentSearchQuery);
    },

    clearSearchQuery() {
      this.setSearchQuery('');
    },

    // ==================== Debounce Timers ====================

    getSearchDebounceTimer() {
      return _searchDebounceTimer;
    },

    setSearchDebounceTimer(timer) {
      _searchDebounceTimer = timer;
    },

    getTabChangeDebounceTimer() {
      return _tabChangeDebounceTimer;
    },

    setTabChangeDebounceTimer(timer) {
      _tabChangeDebounceTimer = timer;
    },

    // ==================== Open Tabs Cache ====================

    getOpenTabsCache() {
      return _openTabsCache;
    },

    setOpenTabsCache(tabs) {
      _openTabsCache = tabs || [];
      this.emit('openTabsCacheUpdate', _openTabsCache);
    },

    findOpenTabByUrl(url) {
      if (!url || !_openTabsCache.length) return null;
      const normalizedUrl = UrlUtils.normalizeUrl(url);
      return _openTabsCache.find(tab => UrlUtils.normalizeUrl(tab.url) === normalizedUrl);
    },

    // ==================== Persistence Helpers ====================

    async loadActiveTab() {
      try {
        const activeTab = await Settings.getSetting('activeTab');
        if (activeTab && VALID_TABS.includes(activeTab)) {
          _currentTab = activeTab;
        }
        return _currentTab;
      } catch (error) {
        return _currentTab;
      }
    },

    async saveActiveTab(tabName) {
      if (VALID_TABS.includes(tabName)) {
        await Settings.updateSetting('activeTab', tabName);
      }
    }
  };
})();
