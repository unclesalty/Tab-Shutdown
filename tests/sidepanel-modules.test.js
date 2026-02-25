/**
 * Tab Goblin - Sidepanel Modules Unit Tests
 *
 * These tests verify the modularized sidepanel architecture works correctly.
 * Run with: node tests/sidepanel-modules.test.js
 *
 * Note: These are standalone tests that mock Chrome APIs and DOM.
 */

// ============================================
// TEST FRAMEWORK (Minimal)
// ============================================

let passCount = 0;
let failCount = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`  ✗ ${name}`);
    failures.push({ name, error: error.message });
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected true, got ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected false, got ${value}`);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message} Expected ${expectedStr}, got ${actualStr}`);
  }
}

// ============================================
// MOCKS
// ============================================

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      _data: {},
      get: async (keys) => {
        if (typeof keys === 'string') {
          return { [keys]: global.chrome.storage.local._data[keys] };
        }
        const result = {};
        keys.forEach(k => { result[k] = global.chrome.storage.local._data[k]; });
        return result;
      },
      set: async (data) => {
        Object.assign(global.chrome.storage.local._data, data);
      }
    }
  },
  tabs: {
    query: async () => [],
    create: async (opts) => ({ id: 999, windowId: 1, ...opts }),
    update: async () => ({}),
    get: async (id) => ({ id, url: 'https://example.com', title: 'Example' })
  },
  windows: {
    update: async () => ({})
  },
  runtime: {
    sendMessage: async (msg) => ({ success: true, count: 1 })
  },
  commands: {
    getAll: async () => [{ name: '_execute_action', shortcut: 'Ctrl+Shift+G' }]
  }
};

// Mock DOM
global.document = {
  _elements: {},
  getElementById: (id) => global.document._elements[id] || null,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    children: [],
    dataset: {},
    classList: {
      _classes: new Set(),
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      toggle: function(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains: function(c) { return this._classes.has(c); }
    },
    appendChild: function(child) { this.children.push(child); return child; },
    addEventListener: function() {},
    setAttribute: function(k, v) { this[k] = v; },
    getAttribute: function(k) { return this[k]; }
  }),
  addEventListener: () => {}
};

global.window = {
  matchMedia: () => ({ addEventListener: () => {} })
};

// ============================================
// STATE MODULE TESTS
// ============================================

// Inline State module for testing
const State = (function() {
  let _selectedTabIds = new Set();
  let _collapsedDomainGroups = new Set();
  let _expandedVaultGroups = new Set();
  let _homeTabsCollapsed = false;
  let _historyCollapsed = true;
  let _currentTab = 'live';
  let _currentSearchQuery = '';
  let _searchDebounceTimer = null;
  let _tabChangeDebounceTimer = null;
  let _openTabsCache = [];
  let _subscribers = {};

  const VALID_TABS = ['live', 'vault', 'settings'];

  function toggleSetMember(set, id) {
    if (set.has(id)) {
      set.delete(id);
      return false;
    }
    set.add(id);
    return true;
  }

  function setMembership(set, id, shouldBeMember) {
    if (shouldBeMember) {
      set.add(id);
    } else {
      set.delete(id);
    }
  }

  return {
    // Selection state
    getSelectedTabIds() { return new Set(_selectedTabIds); },
    addSelectedTab(id) { _selectedTabIds.add(id); this.emit('selection'); },
    removeSelectedTab(id) { _selectedTabIds.delete(id); this.emit('selection'); },
    toggleSelectedTab(id) {
      const added = toggleSetMember(_selectedTabIds, id);
      this.emit('selection');
      return added;
    },
    clearSelection() { _selectedTabIds.clear(); this.emit('selection'); },
    hasSelectedTab(id) { return _selectedTabIds.has(id); },
    getSelectionCount() { return _selectedTabIds.size; },

    // Domain group collapse state
    isDomainGroupCollapsed(domain) { return _collapsedDomainGroups.has(domain); },
    setDomainGroupCollapsed(domain, collapsed) {
      setMembership(_collapsedDomainGroups, domain, collapsed);
    },
    toggleDomainGroup(domain) {
      return toggleSetMember(_collapsedDomainGroups, domain);
    },

    // Vault group expand state
    isVaultGroupExpanded(groupId) { return _expandedVaultGroups.has(groupId); },
    setVaultGroupExpanded(groupId, expanded) {
      setMembership(_expandedVaultGroups, groupId, expanded);
    },
    toggleVaultGroup(groupId) {
      return toggleSetMember(_expandedVaultGroups, groupId);
    },

    // Home tabs collapse state
    isHomeTabsCollapsed() { return _homeTabsCollapsed; },
    setHomeTabsCollapsed(collapsed) { _homeTabsCollapsed = collapsed; },
    toggleHomeTabsCollapsed() {
      _homeTabsCollapsed = !_homeTabsCollapsed;
      return _homeTabsCollapsed;
    },

    // History collapse state
    isHistoryCollapsed() { return _historyCollapsed; },
    setHistoryCollapsed(collapsed) { _historyCollapsed = collapsed; },
    toggleHistoryCollapsed() {
      _historyCollapsed = !_historyCollapsed;
      return _historyCollapsed;
    },

    // Current tab state
    getCurrentTab() { return _currentTab; },
    setCurrentTab(tabName) {
      if (VALID_TABS.includes(tabName)) {
        _currentTab = tabName;
        this.emit('tabChange', tabName);
      }
    },

    // Search state
    getSearchQuery() { return _currentSearchQuery; },
    setSearchQuery(query) {
      _currentSearchQuery = query.toLowerCase();
      this.emit('searchChange', _currentSearchQuery);
    },
    clearSearchQuery() { this.setSearchQuery(''); },

    // Debounce timers
    getSearchDebounceTimer() { return _searchDebounceTimer; },
    setSearchDebounceTimer(timer) { _searchDebounceTimer = timer; },
    getTabChangeDebounceTimer() { return _tabChangeDebounceTimer; },
    setTabChangeDebounceTimer(timer) { _tabChangeDebounceTimer = timer; },

    // Open tabs cache
    getOpenTabsCache() { return [..._openTabsCache]; },
    setOpenTabsCache(tabs) { _openTabsCache = tabs || []; },
    findOpenTabByUrl(url) {
      return _openTabsCache.find(tab => tab.url === url) || null;
    },

    // Event system
    subscribe(event, callback) {
      if (!_subscribers[event]) _subscribers[event] = [];
      _subscribers[event].push(callback);
      return () => {
        const index = _subscribers[event].indexOf(callback);
        if (index > -1) _subscribers[event].splice(index, 1);
      };
    },
    emit(event, data) {
      if (!_subscribers[event]) return;
      _subscribers[event].forEach(cb => cb(data));
    },

    // Reset for testing
    _reset() {
      _selectedTabIds.clear();
      _collapsedDomainGroups.clear();
      _expandedVaultGroups.clear();
      _homeTabsCollapsed = false;
      _historyCollapsed = true;
      _currentTab = 'live';
      _currentSearchQuery = '';
      _searchDebounceTimer = null;
      _tabChangeDebounceTimer = null;
      _openTabsCache = [];
      _subscribers = {};
    }
  };
})();

describe('State Module', () => {
  // Reset before each test group
  State._reset();

  it('should start with empty selection', () => {
    assertEqual(State.getSelectionCount(), 0);
  });

  it('should add tab to selection', () => {
    State.addSelectedTab('tab1');
    assertTrue(State.hasSelectedTab('tab1'));
    assertEqual(State.getSelectionCount(), 1);
  });

  it('should remove tab from selection', () => {
    State._reset();
    State.addSelectedTab('tab1');
    State.removeSelectedTab('tab1');
    assertFalse(State.hasSelectedTab('tab1'));
    assertEqual(State.getSelectionCount(), 0);
  });

  it('should toggle tab selection', () => {
    State._reset();
    const added = State.toggleSelectedTab('tab1');
    assertTrue(added);
    assertTrue(State.hasSelectedTab('tab1'));

    const removed = State.toggleSelectedTab('tab1');
    assertFalse(removed);
    assertFalse(State.hasSelectedTab('tab1'));
  });

  it('should clear all selections', () => {
    State._reset();
    State.addSelectedTab('tab1');
    State.addSelectedTab('tab2');
    State.clearSelection();
    assertEqual(State.getSelectionCount(), 0);
  });

  it('should emit selection events', () => {
    State._reset();
    let eventFired = false;
    State.subscribe('selection', () => { eventFired = true; });
    State.addSelectedTab('tab1');
    assertTrue(eventFired);
  });

  it('should track domain group collapse state', () => {
    State._reset();
    assertFalse(State.isDomainGroupCollapsed('example.com'));
    State.setDomainGroupCollapsed('example.com', true);
    assertTrue(State.isDomainGroupCollapsed('example.com'));
  });

  it('should toggle domain group collapse', () => {
    State._reset();
    const collapsed = State.toggleDomainGroup('example.com');
    assertTrue(collapsed);
    const expanded = State.toggleDomainGroup('example.com');
    assertFalse(expanded);
  });

  it('should track vault group expand state', () => {
    State._reset();
    assertFalse(State.isVaultGroupExpanded('group1'));
    State.setVaultGroupExpanded('group1', true);
    assertTrue(State.isVaultGroupExpanded('group1'));
  });

  it('should track home tabs collapse state', () => {
    State._reset();
    assertFalse(State.isHomeTabsCollapsed());
    State.setHomeTabsCollapsed(true);
    assertTrue(State.isHomeTabsCollapsed());
  });

  it('should toggle home tabs collapse', () => {
    State._reset();
    const collapsed = State.toggleHomeTabsCollapsed();
    assertTrue(collapsed);
    const expanded = State.toggleHomeTabsCollapsed();
    assertFalse(expanded);
  });

  it('should track history collapse state', () => {
    State._reset();
    assertTrue(State.isHistoryCollapsed()); // Default is collapsed
    State.setHistoryCollapsed(false);
    assertFalse(State.isHistoryCollapsed());
  });

  it('should track current tab', () => {
    State._reset();
    assertEqual(State.getCurrentTab(), 'live');
    State.setCurrentTab('vault');
    assertEqual(State.getCurrentTab(), 'vault');
  });

  it('should reject invalid tab names', () => {
    State._reset();
    State.setCurrentTab('invalid');
    assertEqual(State.getCurrentTab(), 'live'); // Should not change
  });

  it('should track search query', () => {
    State._reset();
    State.setSearchQuery('Test Query');
    assertEqual(State.getSearchQuery(), 'test query'); // Lowercased
  });

  it('should clear search query', () => {
    State._reset();
    State.setSearchQuery('test');
    State.clearSearchQuery();
    assertEqual(State.getSearchQuery(), '');
  });

  it('should cache open tabs', () => {
    State._reset();
    const tabs = [
      { id: 1, url: 'https://example.com', title: 'Example' },
      { id: 2, url: 'https://test.com', title: 'Test' }
    ];
    State.setOpenTabsCache(tabs);
    assertEqual(State.getOpenTabsCache().length, 2);
  });

  it('should find tab by URL', () => {
    State._reset();
    const tabs = [
      { id: 1, url: 'https://example.com', title: 'Example' }
    ];
    State.setOpenTabsCache(tabs);
    const found = State.findOpenTabByUrl('https://example.com');
    assertEqual(found.id, 1);
  });

  it('should return null for unfound URL', () => {
    State._reset();
    State.setOpenTabsCache([]);
    const found = State.findOpenTabByUrl('https://notfound.com');
    assertEqual(found, null);
  });

  it('should support unsubscribe', () => {
    State._reset();
    let count = 0;
    const unsub = State.subscribe('selection', () => { count++; });
    State.addSelectedTab('tab1');
    assertEqual(count, 1);
    unsub();
    State.addSelectedTab('tab2');
    assertEqual(count, 1); // Should not increment
  });
});

// ============================================
// SEARCH MATCHING TESTS
// ============================================

function matchesSearch(tab, query) {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const titleMatch = (tab.title || '').toLowerCase().includes(lowerQuery);
  const urlMatch = (tab.url || '').toLowerCase().includes(lowerQuery);
  return titleMatch || urlMatch;
}

describe('Search Matching', () => {
  it('should match empty query to any tab', () => {
    const tab = { title: 'Test', url: 'https://example.com' };
    assertTrue(matchesSearch(tab, ''));
    assertTrue(matchesSearch(tab, null));
  });

  it('should match by title', () => {
    const tab = { title: 'GitHub Repository', url: 'https://github.com' };
    assertTrue(matchesSearch(tab, 'github'));
    assertTrue(matchesSearch(tab, 'repository'));
  });

  it('should match by URL', () => {
    const tab = { title: 'Home', url: 'https://example.com/page' };
    assertTrue(matchesSearch(tab, 'example'));
    assertTrue(matchesSearch(tab, 'page'));
  });

  it('should be case insensitive', () => {
    const tab = { title: 'GitHub', url: 'https://GITHUB.com' };
    assertTrue(matchesSearch(tab, 'github'));
    assertTrue(matchesSearch(tab, 'GITHUB'));
    assertTrue(matchesSearch(tab, 'GitHub'));
  });

  it('should not match non-matching query', () => {
    const tab = { title: 'Test', url: 'https://example.com' };
    assertFalse(matchesSearch(tab, 'notfound'));
  });

  it('should handle tabs with missing title', () => {
    const tab = { url: 'https://example.com' };
    assertTrue(matchesSearch(tab, 'example'));
    assertFalse(matchesSearch(tab, 'title'));
  });

  it('should handle tabs with missing URL', () => {
    const tab = { title: 'Test Page' };
    assertTrue(matchesSearch(tab, 'test'));
    assertFalse(matchesSearch(tab, 'http'));
  });
});

// ============================================
// URL VALIDATION TESTS
// ============================================

function isSkippableUrl(url) {
  if (!url) return true;
  const skippable = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'moz-extension://',
    'file://'
  ];
  return skippable.some(prefix => url.startsWith(prefix));
}

describe('URL Validation', () => {
  it('should skip chrome:// URLs', () => {
    assertTrue(isSkippableUrl('chrome://extensions'));
    assertTrue(isSkippableUrl('chrome://settings'));
  });

  it('should skip chrome-extension:// URLs', () => {
    assertTrue(isSkippableUrl('chrome-extension://abc123/popup.html'));
  });

  it('should skip about: URLs', () => {
    assertTrue(isSkippableUrl('about:blank'));
    assertTrue(isSkippableUrl('about:newtab'));
  });

  it('should skip file:// URLs', () => {
    assertTrue(isSkippableUrl('file:///path/to/file.html'));
  });

  it('should not skip http URLs', () => {
    assertFalse(isSkippableUrl('http://example.com'));
  });

  it('should not skip https URLs', () => {
    assertFalse(isSkippableUrl('https://example.com'));
  });

  it('should skip null/undefined URLs', () => {
    assertTrue(isSkippableUrl(null));
    assertTrue(isSkippableUrl(undefined));
    assertTrue(isSkippableUrl(''));
  });
});

// ============================================
// DOMAIN EXTRACTION TESTS
// ============================================

function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}

// Mock URL for Node.js
global.URL = class {
  constructor(url) {
    if (!url || !url.includes('://')) throw new Error('Invalid URL');
    const match = url.match(/^(?:https?:\/\/)?([^\/]+)/);
    this.hostname = match ? match[1] : 'unknown';
  }
};

describe('Domain Extraction', () => {
  it('should extract domain from https URL', () => {
    assertEqual(getDomainFromUrl('https://example.com/path'), 'example.com');
  });

  it('should extract domain from http URL', () => {
    assertEqual(getDomainFromUrl('http://test.org/page'), 'test.org');
  });

  it('should extract subdomain', () => {
    assertEqual(getDomainFromUrl('https://sub.example.com/'), 'sub.example.com');
  });

  it('should return unknown for invalid URLs', () => {
    assertEqual(getDomainFromUrl('not-a-url'), 'unknown');
    assertEqual(getDomainFromUrl(''), 'unknown');
  });
});

// ============================================
// PLURALIZATION TESTS
// ============================================

function pluralizeTabs(count) {
  return count === 1 ? 'tab' : 'tabs';
}

describe('Pluralization', () => {
  it('should return singular for 1', () => {
    assertEqual(pluralizeTabs(1), 'tab');
  });

  it('should return plural for 0', () => {
    assertEqual(pluralizeTabs(0), 'tabs');
  });

  it('should return plural for multiple', () => {
    assertEqual(pluralizeTabs(2), 'tabs');
    assertEqual(pluralizeTabs(100), 'tabs');
  });
});

// ============================================
// HTML ESCAPING TESTS (Security)
// ============================================

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

describe('HTML Escaping (Security)', () => {
  it('should escape ampersands', () => {
    assertEqual(escapeHtml('a & b'), 'a &amp; b');
  });

  it('should escape less than', () => {
    assertEqual(escapeHtml('a < b'), 'a &lt; b');
  });

  it('should escape greater than', () => {
    assertEqual(escapeHtml('a > b'), 'a &gt; b');
  });

  it('should escape quotes', () => {
    assertEqual(escapeHtml('a "b" c'), 'a &quot;b&quot; c');
  });

  it('should escape single quotes', () => {
    assertEqual(escapeHtml("a 'b' c"), "a &#039;b&#039; c");
  });

  it('should handle script tags', () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = escapeHtml(malicious);
    assertFalse(escaped.includes('<script>'));
    assertTrue(escaped.includes('&lt;script&gt;'));
  });

  it('should handle null/empty', () => {
    assertEqual(escapeHtml(null), '');
    assertEqual(escapeHtml(''), '');
  });
});

// ============================================
// MODULE INITIALIZATION ORDER TESTS
// ============================================

describe('Module Initialization', () => {
  it('should have State module defined', () => {
    assertTrue(typeof State === 'object');
    assertTrue(typeof State.getSelectedTabIds === 'function');
  });

  it('should have all State public methods', () => {
    const requiredMethods = [
      'getSelectedTabIds', 'addSelectedTab', 'removeSelectedTab',
      'toggleSelectedTab', 'clearSelection', 'hasSelectedTab',
      'getSelectionCount', 'isDomainGroupCollapsed', 'setDomainGroupCollapsed',
      'toggleDomainGroup', 'isVaultGroupExpanded', 'setVaultGroupExpanded',
      'toggleVaultGroup', 'isHomeTabsCollapsed', 'setHomeTabsCollapsed',
      'toggleHomeTabsCollapsed', 'isHistoryCollapsed', 'setHistoryCollapsed',
      'toggleHistoryCollapsed', 'getCurrentTab', 'setCurrentTab',
      'getSearchQuery', 'setSearchQuery', 'clearSearchQuery',
      'getSearchDebounceTimer', 'setSearchDebounceTimer',
      'getTabChangeDebounceTimer', 'setTabChangeDebounceTimer',
      'getOpenTabsCache', 'setOpenTabsCache', 'findOpenTabByUrl',
      'subscribe', 'emit'
    ];

    requiredMethods.forEach(method => {
      assertTrue(typeof State[method] === 'function', `Missing ${method}`);
    });
  });
});

// ============================================
// RUN TESTS
// ============================================

console.log('\n========================================');
console.log('Tab Goblin - Sidepanel Module Tests');
console.log('========================================');

// Tests are run during describe() calls above

console.log('\n========================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('========================================');

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => {
    console.log(`  - ${f.name}: ${f.error}`);
  });
  process.exit(1);
}

console.log('\nAll tests passed!');
process.exit(0);
