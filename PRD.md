# PRD: Tab Goblin v8 — Modular Architecture Refactor

## Overview

**Tab Goblin** is a Chrome extension that solves RAM/CPU drain from too many tabs while preserving them as workflow aids. Tabs are either live (open) or vaulted (fully closed and saved).

## v8 Goals

This release focuses on **architectural improvements** to make the codebase more maintainable, testable, and easier to extend:

1. **Break up the monolith** — Split `sidepanel.js` (2,794 lines) into focused modules
2. **Separation of concerns** — UI rendering, state management, and event handling in separate layers
3. **Consistent patterns** — Establish patterns for future feature development

---

## Problem Statement

### Current Architecture Issues

**`sidepanel.js` is a 2,794-line monolith containing:**
- 79 functions with mixed responsibilities
- Theme management
- Tab navigation/state
- Live Tabs panel rendering
- Vault panel rendering
- Settings panel rendering
- Event handlers
- Search functionality
- Import/export
- Drag-and-drop
- 12+ global variables for state

**Pain Points:**
- Hard to find relevant code for a specific feature
- Changes in one area risk breaking unrelated features
- Testing individual components is difficult
- New developers face steep learning curve
- Code duplication across similar UI components

### What's Working Well

**`src/common/` modules are well-structured:**
- `storage.js` (368 lines) — Vault storage with concurrency locking
- `home-tabs.js` (311 lines) — Home tab patterns
- `settings.js` (120 lines) — User settings
- `history.js` (256 lines) — History storage
- `themes.js` (133 lines) — Theme definitions
- `dialog.js` (162 lines) — Unified dialog system
- `ui-helpers.js` (92 lines) — Shared UI utilities
- `url-utils.js` (112 lines) — URL processing
- `import-export.js` (285 lines) — Bookmark import/export

**These modules demonstrate the right patterns:**
- Single responsibility
- Clear API surface
- ~100-350 lines each
- Reusable across contexts

---

## Proposed Module Structure

### New `src/sidepanel/` Directory Structure

```
src/sidepanel/
├── sidepanel.html
├── sidepanel.css
├── sidepanel.js              # Entry point, initialization, event setup
├── modules/
│   ├── state.js              # Centralized state management
│   ├── navigation.js         # Tab bar, panel switching, routing
│   ├── search.js             # Global search across panels
│   ├── theme-ui.js           # Theme selector UI (uses common/themes.js)
│   │
│   ├── live-tabs/
│   │   ├── index.js          # Live Tabs panel coordinator
│   │   ├── home-tabs-ui.js   # Home Tabs section rendering
│   │   ├── open-tabs-ui.js   # Open Tabs list (grouped/ungrouped)
│   │   ├── tab-item.js       # Tab item component
│   │   └── view-toggle.js    # View mode toggle
│   │
│   ├── vault/
│   │   ├── index.js          # Vault panel coordinator
│   │   ├── group-card.js     # Vault group card component
│   │   ├── tab-item.js       # Vault tab item component
│   │   ├── history-ui.js     # History section rendering
│   │   └── drag-drop.js      # Drag-and-drop handling
│   │
│   └── settings/
│       ├── index.js          # Settings panel coordinator
│       ├── theme-settings.js # Theme mode/palette selection
│       ├── shortcut-ui.js    # Keyboard shortcut display
│       ├── data-settings.js  # Import/export UI
│       └── patterns-ui.js    # Home tab patterns management
```

### Module Responsibilities

#### Core Modules

**`state.js`** — Centralized State Management
```javascript
// Single source of truth for UI state
const State = {
  selectedTabIds: new Set(),
  collapsedDomainGroups: new Set(),
  expandedVaultGroups: new Set(),
  homeTabsCollapsed: false,
  currentTab: 'live',
  currentSearchQuery: '',
  openTabsCache: [],

  // State change notifications
  subscribe(event, callback) { },
  emit(event, data) { },

  // Getters/setters that trigger updates
  setSelectedTabs(ids) { },
  toggleDomainGroup(domain) { },
  // ...
};
```

**`navigation.js`** — Panel Navigation
```javascript
const Navigation = {
  init() { },
  switchToTab(tabName) { },
  updateTabBarUI() { },
  showPanel(tabName) { },
  handleKeydown(e) { },
};
```

**`search.js`** — Global Search
```javascript
const Search = {
  init() { },
  handleSearch(query) { },
  renderResults() { },
  clearSearch() { },
};
```

#### Panel Modules

**`live-tabs/index.js`** — Live Tabs Panel Coordinator
```javascript
const LiveTabsPanel = {
  render() { },
  refresh() { },
  updateTabCount() { },
  handleVaultSelected() { },
  handleVaultAll() { },
};
```

**`vault/index.js`** — Vault Panel Coordinator
```javascript
const VaultPanel = {
  render() { },
  refresh() { },
  renderGroups() { },
  renderHistory() { },
};
```

---

## Refactoring Strategy

### Phase 1: State Extraction
1. Create `state.js` with all global variables
2. Add subscription system for state changes
3. Update `sidepanel.js` to use State module
4. No visible changes to users

### Phase 2: Navigation Extraction
1. Create `navigation.js` with tab switching logic
2. Extract `showPanel`, `switchToTab`, `updateTabBarUI`
3. Wire up State subscriptions for panel changes
4. No visible changes to users

### Phase 3: Live Tabs Modularization
1. Extract Home Tabs section to `home-tabs-ui.js`
2. Extract Open Tabs list to `open-tabs-ui.js`
3. Extract tab item component to `tab-item.js`
4. Create `live-tabs/index.js` coordinator
5. No visible changes to users

### Phase 4: Vault Modularization
1. Extract group card to `group-card.js`
2. Extract tab item to `vault/tab-item.js`
3. Extract drag-drop to `drag-drop.js`
4. Extract history to `history-ui.js`
5. Create `vault/index.js` coordinator
6. No visible changes to users

### Phase 5: Settings Modularization
1. Extract theme settings to `theme-settings.js`
2. Extract shortcut UI to `shortcut-ui.js`
3. Extract import/export to `data-settings.js`
4. Extract patterns to `patterns-ui.js`
5. Create `settings/index.js` coordinator
6. No visible changes to users

### Phase 6: Search and Theme UI
1. Extract search to `search.js`
2. Extract theme UI to `theme-ui.js`
3. Final cleanup of `sidepanel.js`

---

## Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| `sidepanel.js` lines | 2,794 | ~200 (entry point only) |
| Largest module | 2,794 | ~300 |
| Average module size | N/A | ~150 |
| Number of modules | 1 | ~15 |
| Global variables | 12+ | 0 (in State module) |

---

## Module Loading Strategy

Since this is a Chrome extension without a bundler, modules will use the revealing module pattern:

```javascript
// state.js
const State = (function() {
  // Private state
  let selectedTabIds = new Set();

  // Public API
  return {
    getSelectedTabIds() { return new Set(selectedTabIds); },
    setSelectedTabIds(ids) { selectedTabIds = new Set(ids); this.emit('selection-changed'); },
    // ...
  };
})();
```

Load order in `sidepanel.html`:
```html
<!-- Common modules first -->
<script src="../common/url-utils.js"></script>
<script src="../common/storage.js"></script>
<!-- ... -->

<!-- Sidepanel modules -->
<script src="modules/state.js"></script>
<script src="modules/navigation.js"></script>
<script src="modules/search.js"></script>
<script src="modules/theme-ui.js"></script>

<script src="modules/live-tabs/tab-item.js"></script>
<script src="modules/live-tabs/home-tabs-ui.js"></script>
<script src="modules/live-tabs/open-tabs-ui.js"></script>
<script src="modules/live-tabs/view-toggle.js"></script>
<script src="modules/live-tabs/index.js"></script>

<script src="modules/vault/tab-item.js"></script>
<script src="modules/vault/group-card.js"></script>
<script src="modules/vault/history-ui.js"></script>
<script src="modules/vault/drag-drop.js"></script>
<script src="modules/vault/index.js"></script>

<script src="modules/settings/theme-settings.js"></script>
<script src="modules/settings/shortcut-ui.js"></script>
<script src="modules/settings/data-settings.js"></script>
<script src="modules/settings/patterns-ui.js"></script>
<script src="modules/settings/index.js"></script>

<!-- Main entry point last -->
<script src="sidepanel.js"></script>
```

---

## Non-Goals (v8)

- Adding new user-facing features
- Changing the service worker architecture
- Introducing a build system or bundler
- TypeScript conversion
- Unit test framework setup (future v9)

---

## Success Criteria

- [ ] `sidepanel.js` reduced to ~200 lines (initialization only)
- [ ] No module exceeds 350 lines
- [ ] All existing functionality preserved
- [ ] No visual changes for users
- [ ] Each module has clear, documented API
- [ ] State changes flow through State module
- [ ] Panels are independently renderable

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | HIGH | Incremental refactoring, test after each phase |
| Load order bugs | MEDIUM | Document dependencies, test in dev mode |
| Performance regression | LOW | Profile before/after, modules are small |
| Scope creep | MEDIUM | No new features, architecture only |

---

## References

- **v7 PRD (archived):** `archive/PRD-v7-2026-02-24.md`
- **v7 TICKETS (archived):** `archive/TICKETS-v7-2026-02-24.md`
- **Code review:** `context_items/opus-cursor-review.md`
