# TICKETS: Tab Goblin v8 — Modular Architecture Refactor

Each ticket includes a **Completion Promise** — the concrete condition to verify the ticket is done.

**Previous Version:** v7 archived at `archive/TICKETS-v7-2026-02-24.md`
**PRD Reference:** `PRD.md`

---

## Phase 1: State Extraction

### TG8-001: Create State Module

**Priority:** HIGH
**PRD Reference:** State Management section

**Goal:** Extract all global state variables into a centralized State module.

**Current State Variables to Extract:**
- `selectedTabIds` (Set)
- `collapsedDomainGroups` (Set)
- `expandedVaultGroups` (Set)
- `homeTabsCollapsed` (boolean)
- `currentTab` (string)
- `currentSearchQuery` (string)
- `searchDebounceTimer` (timer id)
- `tabChangeDebounceTimer` (timer id)

**Tasks:**
- Create `src/sidepanel/modules/state.js`
- Implement revealing module pattern
- Add getters/setters for each state variable
- Add simple event subscription system (subscribe/emit)
- Update `sidepanel.html` to load state.js first

**File Structure:**
```javascript
const State = (function() {
  // Private state
  let _selectedTabIds = new Set();
  let _subscribers = {};

  return {
    // Selection state
    getSelectedTabIds() { return new Set(_selectedTabIds); },
    addSelectedTab(id) { _selectedTabIds.add(id); this.emit('selection'); },
    removeSelectedTab(id) { _selectedTabIds.delete(id); this.emit('selection'); },
    clearSelection() { _selectedTabIds.clear(); this.emit('selection'); },
    hasSelectedTab(id) { return _selectedTabIds.has(id); },
    getSelectionCount() { return _selectedTabIds.size; },

    // Event system
    subscribe(event, callback) { /* ... */ },
    emit(event, data) { /* ... */ },

    // ... other state
  };
})();
```

**Completion Promise:** State module exists with all current global variables migrated. Event system allows components to subscribe to state changes.

---

### TG8-002: Migrate sidepanel.js to Use State Module

**Priority:** HIGH
**Depends On:** TG8-001

**Goal:** Update all references to global variables to use State module.

**Tasks:**
- Replace `selectedTabIds` references with `State.getSelectedTabIds()`, etc.
- Replace direct mutations with State setters
- Remove global variable declarations from sidepanel.js
- Test all selection/deselection flows
- Test all accordion expand/collapse flows

**Completion Promise:** No global state variables remain in sidepanel.js. All state access goes through State module. All existing functionality works.

---

## Phase 2: Navigation Extraction

### TG8-003: Create Navigation Module

**Priority:** HIGH
**PRD Reference:** Navigation section

**Goal:** Extract tab bar navigation and panel switching to a dedicated module.

**Functions to Extract:**
- `updateTabBarUI()`
- `showPanel(tabName)`
- `switchToTab(tabName)`
- `loadActiveTab()`
- `saveActiveTab(tabName)`
- `handleTabBarKeydown(e)`

**Tasks:**
- Create `src/sidepanel/modules/navigation.js`
- Move navigation functions
- Subscribe to State.currentTab changes
- Expose `Navigation.init()` and `Navigation.switchToTab()`
- Update sidepanel.js to use Navigation module
- Update event listeners to use Navigation

**Completion Promise:** Navigation module handles all tab switching. Panel visibility managed by Navigation. Keyboard navigation works.

---

## Phase 3: Live Tabs Modularization

### TG8-004: Extract Tab Item Component

**Priority:** HIGH

**Goal:** Create reusable tab item component for Live Tabs.

**Functions to Extract:**
- `createFavicon()`
- `createTabInfo()`
- `createDomainTabItem()`
- `createUngroupedTabItem()`

**Tasks:**
- Create `src/sidepanel/modules/live-tabs/tab-item.js`
- Create `LiveTabItem` module with factory functions
- Consolidate duplicate tab rendering logic
- Handle checkbox state via State module

**Completion Promise:** `LiveTabItem.create()` returns a complete tab item element. Works for both grouped and ungrouped views.

---

### TG8-005: Extract Home Tabs UI

**Priority:** HIGH

**Goal:** Extract Home Tabs section rendering to dedicated module.

**Functions to Extract:**
- `renderHomeTabsSection()`
- `createHomeTabItem()`
- `toggleHomeTabsSection()`
- `removeTabFromHome()`
- `addTabToHome()`

**Tasks:**
- Create `src/sidepanel/modules/live-tabs/home-tabs-ui.js`
- Create `HomeTabsUI` module
- Subscribe to relevant State changes
- Handle collapse state via State module

**Completion Promise:** `HomeTabsUI.render()` renders complete Home Tabs section. Collapse/expand works. Add/remove home tabs works.

---

### TG8-006: Extract Open Tabs UI

**Priority:** HIGH

**Goal:** Extract Open Tabs list rendering to dedicated module.

**Functions to Extract:**
- `renderOpenTabsList()`
- `renderGroupedView()`
- `renderUngroupedView()`
- `createDomainGroupCard()`
- `updateDomainGroupCheckbox()`
- `updateDomainVaultButton()`

**Tasks:**
- Create `src/sidepanel/modules/live-tabs/open-tabs-ui.js`
- Create `OpenTabsUI` module
- Use LiveTabItem for tab rendering
- Handle view mode via Settings

**Completion Promise:** `OpenTabsUI.render()` renders tabs in correct view mode. Group selection works. Vault buttons enable/disable correctly.

---

### TG8-007: Extract View Toggle

**Priority:** MEDIUM

**Goal:** Extract view toggle component.

**Functions to Extract:**
- `handleViewToggle()`
- `updateViewToggleUI()`
- `handleViewToggleKeydown()`

**Tasks:**
- Create `src/sidepanel/modules/live-tabs/view-toggle.js`
- Create `ViewToggle` module
- Wire up to Settings for persistence

**Completion Promise:** `ViewToggle.init()` sets up toggle behavior. Mode persists across sessions.

---

### TG8-008: Create Live Tabs Panel Coordinator

**Priority:** HIGH
**Depends On:** TG8-004, TG8-005, TG8-006, TG8-007

**Goal:** Create coordinator that orchestrates Live Tabs panel components.

**Functions to Extract:**
- `renderLiveTabsPanel()`
- `refreshLivePanel()`
- `updateLiveTabCount()`
- `vaultSelectedTabs()`
- `vaultDomainTabs()`
- `vaultSingleTab()`
- `selectAllTabs()`
- `deselectAllTabs()`
- `updateSelectedCount()`

**Tasks:**
- Create `src/sidepanel/modules/live-tabs/index.js`
- Create `LiveTabsPanel` module
- Coordinate HomeTabsUI and OpenTabsUI
- Handle footer actions (Vault Selected, Vault All)

**Completion Promise:** `LiveTabsPanel.render()` renders complete Live Tabs panel. All vault operations work. Selection count updates.

---

## Phase 4: Vault Modularization

### TG8-009: Extract Vault Tab Item Component

**Priority:** HIGH

**Goal:** Create tab item component for Vault.

**Functions to Extract:**
- `createTabItem()` (vault version)

**Tasks:**
- Create `src/sidepanel/modules/vault/tab-item.js`
- Create `VaultTabItem` module
- Handle drag-drop data attributes

**Completion Promise:** `VaultTabItem.create()` returns complete vault tab item. Drag handle works.

---

### TG8-010: Extract Vault Group Card

**Priority:** HIGH

**Goal:** Extract vault group card rendering.

**Functions to Extract:**
- `createGroupCard()`
- `restoreGroup()`
- `copyGroupUrls()`
- `showRenameDialog()`
- `renameGroup()`
- `deleteGroup()`

**Tasks:**
- Create `src/sidepanel/modules/vault/group-card.js`
- Create `VaultGroupCard` module
- Use VaultTabItem for tab rendering

**Completion Promise:** `VaultGroupCard.create()` returns complete group card. All group actions work (restore, rename, delete, copy).

---

### TG8-011: Extract History UI

**Priority:** MEDIUM

**Goal:** Extract history section rendering.

**Functions to Extract:**
- `renderHistorySection()`
- `createHistoryItem()`
- `restoreFromHistory()`
- `removeFromHistory()`
- `vaultFromHistory()`

**Tasks:**
- Create `src/sidepanel/modules/vault/history-ui.js`
- Create `HistoryUI` module
- Handle collapse state via State

**Completion Promise:** `HistoryUI.render()` renders history section. All history actions work.

---

### TG8-012: Extract Drag-Drop Handler

**Priority:** MEDIUM

**Goal:** Extract drag-and-drop logic.

**Functions to Extract:**
- `clearDragStyles()`
- `handleDragStart()`
- `handleDragEnd()`
- `handleDragOver()`
- `handleDrop()`
- `handleGroupDragOver()`
- `handleGroupDragLeave()`
- `handleGroupDrop()`
- `moveTabToPosition()`
- `moveTabToGroup()`
- `handleGroupReorderDragStart()`
- `handleGroupReorderDragEnd()`
- `reorderGroup()`

**Tasks:**
- Create `src/sidepanel/modules/vault/drag-drop.js`
- Create `DragDrop` module
- Initialize with VaultPanel

**Completion Promise:** `DragDrop.init()` sets up all drag-drop handlers. Tab reordering works. Group reordering works.

---

### TG8-013: Create Vault Panel Coordinator

**Priority:** HIGH
**Depends On:** TG8-009, TG8-010, TG8-011, TG8-012

**Goal:** Create coordinator that orchestrates Vault panel components.

**Functions to Extract:**
- `renderVaultGroups()`
- `restoreTab()`
- `copyTabUrl()`
- `deleteVaultTab()`

**Tasks:**
- Create `src/sidepanel/modules/vault/index.js`
- Create `VaultPanel` module
- Coordinate VaultGroupCard, HistoryUI, DragDrop

**Completion Promise:** `VaultPanel.render()` renders complete Vault panel. All tab operations work.

---

## Phase 5: Settings Modularization

### TG8-014: Extract Theme Settings UI

**Priority:** MEDIUM

**Goal:** Extract theme mode and palette selection.

**Functions to Extract:**
- `initThemeSelector()`
- `handleThemeModeChange()`
- `handlePaletteChange()`

**Tasks:**
- Create `src/sidepanel/modules/settings/theme-settings.js`
- Create `ThemeSettingsUI` module

**Completion Promise:** `ThemeSettingsUI.init()` sets up theme selection. Mode and palette changes work.

---

### TG8-015: Extract Shortcut UI

**Priority:** LOW

**Goal:** Extract keyboard shortcut display.

**Functions to Extract:**
- `isMacOS()`
- `formatShortcutForOS()`
- `getCurrentShortcut()`
- `updateShortcutDisplay()`
- `openShortcutConfig()`

**Tasks:**
- Create `src/sidepanel/modules/settings/shortcut-ui.js`
- Create `ShortcutUI` module

**Completion Promise:** `ShortcutUI.init()` displays current shortcut. Config button works.

---

### TG8-016: Extract Data Settings UI

**Priority:** LOW

**Goal:** Extract import/export UI.

**Functions to Extract:**
- `exportVault()`
- `handleImportFile()`
- `triggerImportFilePicker()`

**Tasks:**
- Create `src/sidepanel/modules/settings/data-settings.js`
- Create `DataSettingsUI` module

**Completion Promise:** `DataSettingsUI.init()` sets up import/export buttons. Both operations work.

---

### TG8-017: Extract Patterns UI

**Priority:** LOW

**Goal:** Extract home tab patterns management.

**Functions to Extract:**
- `renderHomePatterns()`
- `addNewPattern()`
- `addCurrentTabAsPattern()`

**Tasks:**
- Create `src/sidepanel/modules/settings/patterns-ui.js`
- Create `PatternsUI` module

**Completion Promise:** `PatternsUI.render()` shows pattern list. Add/remove patterns works.

---

### TG8-018: Create Settings Panel Coordinator

**Priority:** MEDIUM
**Depends On:** TG8-014, TG8-015, TG8-016, TG8-017

**Goal:** Create coordinator that orchestrates Settings panel components.

**Tasks:**
- Create `src/sidepanel/modules/settings/index.js`
- Create `SettingsPanel` module
- Coordinate all settings components

**Completion Promise:** `SettingsPanel.render()` renders complete Settings panel.

---

## Phase 6: Search and Final Cleanup

### TG8-019: Extract Search Module

**Priority:** MEDIUM

**Goal:** Extract global search functionality.

**Functions to Extract:**
- `matchesSearch()`
- `handleGlobalSearch()`
- `renderSearchResults()`
- `createSearchResultGroupCard()`
- `updateSearchUI()`

**Tasks:**
- Create `src/sidepanel/modules/search.js`
- Create `Search` module
- Handle search state via State module

**Completion Promise:** `Search.init()` sets up search handlers. Search works on Live and Vault panels.

---

### TG8-020: Extract Theme UI Module

**Priority:** LOW

**Goal:** Extract theme initialization (separate from settings UI).

**Functions to Extract:**
- `initTheme()`
- `applyThemeFromSettings()`
- `handleSystemThemeChange()`

**Tasks:**
- Create `src/sidepanel/modules/theme-ui.js`
- Create `ThemeUI` module

**Completion Promise:** `ThemeUI.init()` applies theme on load. System theme changes detected.

---

### TG8-021: Final sidepanel.js Cleanup

**Priority:** HIGH
**Depends On:** All other tickets

**Goal:** Reduce sidepanel.js to initialization-only entry point.

**Remaining Responsibilities:**
- `init()` function
- `setupEventListeners()` (delegating to modules)
- `setupTabListeners()`
- `checkOnboarding()`
- `showOnboardingTip()`

**Tasks:**
- Remove all extracted functions
- Update init() to initialize all modules
- Update event listeners to delegate to modules
- Verify no dead code remains

**Target Structure:**
```javascript
// Tab Goblin - Side Panel Entry Point

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await ThemeUI.init();
  Navigation.init();
  Search.init();
  await Navigation.switchToTab(await State.loadActiveTab());
  setupEventListeners();
  setupTabListeners();
  await checkOnboarding();
}

function setupEventListeners() {
  // Delegate to panel coordinators
  LiveTabsPanel.setupEvents();
  VaultPanel.setupEvents();
  SettingsPanel.setupEvents();
}

// ... tab listeners and onboarding only
```

**Completion Promise:** `sidepanel.js` is under 200 lines. All functionality delegated to modules. No dead code.

---

### TG8-022: Update HTML Script Loading

**Priority:** HIGH
**Depends On:** All module creation tickets

**Goal:** Update sidepanel.html with correct module load order.

**Tasks:**
- Add all new module scripts in dependency order
- Verify no load order errors
- Test in Chrome

**Completion Promise:** Extension loads without errors. All modules available at runtime.

---

## Summary by Priority

| Priority | Tickets | Description |
|----------|---------|-------------|
| HIGH | TG8-001, 002, 003, 004, 005, 006, 008, 009, 010, 013, 021, 022 | Core state, navigation, panels |
| MEDIUM | TG8-007, 011, 012, 014, 018, 019 | Supporting components |
| LOW | TG8-015, 016, 017, 020 | Settings subsections, theme |

---

## Recommended Order

### Week 1: Foundation
1. TG8-001 — Create State Module
2. TG8-002 — Migrate to State Module
3. TG8-003 — Create Navigation Module

### Week 2: Live Tabs
4. TG8-004 — Extract Tab Item Component
5. TG8-005 — Extract Home Tabs UI
6. TG8-006 — Extract Open Tabs UI
7. TG8-007 — Extract View Toggle
8. TG8-008 — Create Live Tabs Coordinator

### Week 3: Vault
9. TG8-009 — Extract Vault Tab Item
10. TG8-010 — Extract Vault Group Card
11. TG8-011 — Extract History UI
12. TG8-012 — Extract Drag-Drop Handler
13. TG8-013 — Create Vault Coordinator

### Week 4: Settings and Cleanup
14. TG8-014 — Extract Theme Settings UI
15. TG8-015 — Extract Shortcut UI
16. TG8-016 — Extract Data Settings UI
17. TG8-017 — Extract Patterns UI
18. TG8-018 — Create Settings Coordinator
19. TG8-019 — Extract Search Module
20. TG8-020 — Extract Theme UI Module
21. TG8-021 — Final Cleanup
22. TG8-022 — Update HTML Script Loading
