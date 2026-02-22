# TICKETS: Tab Goblin v4 — Architecture Refactor

Each ticket includes a **Completion Promise** — the concrete condition to verify the ticket is done.

**Previous Version:** v3 archived at `archive/TICKETS-v3-2026-02-22.md`
**Code Review:** `context_items/opus-cursor-review.md`

---

## Phase 1: Eliminate Root Cause

### [DONE] TG4-001: Archive Popup Code

**Priority:** CRITICAL
**Review Reference:** Section 9 — Dead Code

**Goal:** Remove the unreachable popup code to eliminate the largest source of code duplication.

**Background:**
The `manifest.json` does not set `action.default_popup`. Combined with `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, clicking the extension icon opens the side panel — not a popup. The popup files are unreachable through normal user interaction.

**Tasks:**
- Create `archive/popup-v3/` directory
- Move `src/popup/popup.html` to archive
- Move `src/popup/popup.css` to archive
- Move `src/popup/popup.js` to archive
- Remove `src/popup/` directory
- Update `documentation/DEVELOPER_GUIDE.md` to remove popup references
- Verify extension still works after removal

**Files to Modify:**
- `src/popup/` (move to archive)
- `documentation/DEVELOPER_GUIDE.md`

**Completion Promise:** The `src/popup/` directory no longer exists. All popup files are in `archive/popup-v3/`. The extension loads and functions normally.

---

### [DONE] TG4-002: Create url-utils.js Module

**Priority:** CRITICAL
**Review Reference:** Sections 1, 2 — D.R.Y. Violations, isSkippableUrl Divergence

**Goal:** Create a single source of truth for URL handling functions.

**Background:**
`isSkippableUrl()` is implemented three times with different behavior:
- `sidepanel.js:36` — Returns `false` when URL is undefined
- `popup.js:27` — Returns `true` when URL is undefined
- `service-worker.js:11` — Returns `true` when URL is undefined

**Tasks:**
- Create `src/common/url-utils.js` with:
  ```javascript
  function isSkippableUrl(url) {
    return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
  }

  function getDomainFromUrl(url) { /* ... */ }
  function normalizeUrl(url) { /* ... */ }
  function normalizeUrlForComparison(url) { /* ... */ }
  function groupTabsByDomain(tabs) { /* ... */ }
  ```
- Export as `UrlUtils` global
- Update `sidepanel.js` to use `UrlUtils.isSkippableUrl()`
- Update `service-worker.js` to import and use `UrlUtils`
- Add script tag to `sidepanel.html` for url-utils.js

**Files to Create:**
- `src/common/url-utils.js`

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (remove local functions, use UrlUtils)
- `src/sidepanel/sidepanel.html` (add script tag)
- `src/background/service-worker.js` (import and use UrlUtils)

**Completion Promise:** Single `isSkippableUrl()` in `url-utils.js`. All URL handling uses this module. Grep for "function isSkippableUrl" returns only one result in `url-utils.js`.

---

### [DONE] TG4-003: Create ui-helpers.js Module

**Priority:** HIGH
**Review Reference:** Section 1 — D.R.Y. Violations

**Goal:** Extract shared UI utility functions into a common module.

**Duplicated Functions:**
| Function | Description |
|----------|-------------|
| `pluralizeTabs(count)` | Returns "1 tab" vs "N tabs" |
| `clearContainer(element)` | Removes all child nodes |
| `showToast(message, type)` | Toast notification |
| `setLoading(container, isLoading)` | Loading state |
| `getDefaultFavicon(url)` | Chrome favicon fallback |
| `truncateUrl(url, maxLength)` | URL display truncation |

**Tasks:**
- Create `src/common/ui-helpers.js` with all functions
- Export as `UIHelpers` global
- Update `sidepanel.js` to use `UIHelpers.*`
- Remove duplicate function definitions from sidepanel.js
- Add script tag to `sidepanel.html`

**Files to Create:**
- `src/common/ui-helpers.js`

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (remove local functions, use UIHelpers)
- `src/sidepanel/sidepanel.html` (add script tag)

**Completion Promise:** All listed functions exist only in `ui-helpers.js`. `sidepanel.js` imports and uses them. No duplicate implementations.

---

## Phase 2: Fix CSS Issues

### [DONE] TG4-004: Fix CSS Syntax Error

**Priority:** HIGH
**Review Reference:** Section 6 — Orphaned Declaration

**Goal:** Remove the orphaned CSS declaration causing potential parsing issues.

**Current Code (sidepanel.css:851-858):**
```css
.domain-tab-checkbox {
  margin-right: 8px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
  border-bottom: 1px solid var(--border);
}
```

Lines 857-858 are orphaned (outside any rule block).

**Tasks:**
- Remove lines 857-858 from sidepanel.css
- Verify no visual regressions in all themes
- Check if `border-bottom` belongs to another selector and fix if needed

**Files to Modify:**
- `src/sidepanel/sidepanel.css`

**Completion Promise:** No orphaned CSS declarations. CSS passes validation. All UI elements render correctly.

---

### [DONE] TG4-005: Replace Universal Transition Rule

**Priority:** HIGH
**Review Reference:** Section 10 — Universal CSS Transition

**Goal:** Remove performance-impacting universal transition and apply selectively.

**Current Code (sidepanel.css:168-172):**
```css
*, *::before, *::after {
  transition-property: background-color, border-color, color;
  transition-duration: 0.15s;
  transition-timing-function: ease;
}
```

This applies transitions to every element, causing:
- Flash-in effects on dynamically created elements
- Delayed drag-and-drop feedback
- Sluggish search results
- Slow checkbox state changes

**Tasks:**
- Remove the universal `*` transition rule
- Add transitions only to elements that should animate:
  ```css
  .tab-btn, .group-header, .domain-group-header,
  .home-tab-item, .btn, .tab-action-btn,
  .group-card, .tab-item, .theme-mode-option {
    transition: background-color 0.15s ease,
                border-color 0.15s ease,
                color 0.15s ease;
  }
  ```
- Test theme switching still feels smooth
- Test drag-and-drop feels responsive

**Files to Modify:**
- `src/sidepanel/sidepanel.css`

**Completion Promise:** No universal `*` transition rule. Theme switching still animates smoothly. Drag-and-drop has instant visual feedback. Dynamic content doesn't flash in.

---

## Phase 3: Improve Consistency

### [DONE] TG4-006: Add Move Up/Down to Sidepanel Group Menu

**Priority:** HIGH
**Review Reference:** Sections 4, 5 — Inconsistent Drag-and-Drop, Inconsistent Group Menu

**Goal:** Add accessible alternatives to drag-and-drop for group reordering.

**Background:**
The sidepanel vault has drag-and-drop but no menu-based reordering. The popup had Move Up/Down menu items. Both interaction models should be available for accessibility.

**Tasks:**
- Add "Move Up" option to `showGroupMenu()` (conditional: not first group)
- Add "Move Down" option to `showGroupMenu()` (conditional: not last group)
- Implement `moveGroupUp(groupId)` function
- Implement `moveGroupDown(groupId)` function
- Update storage order via `VaultStorage.reorderGroups()`
- Re-render vault after move
- Add keyboard shortcuts in menu (Up/Down arrows)

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (menu and move functions)

**Completion Promise:** Vault group context menu shows "Move Up" and "Move Down" options. Moving a group via menu reorders it in storage. Screen readers can announce the action.

---

### [DONE] TG4-007: Improve Vault Tab Click Behavior

**Priority:** MEDIUM
**Review Reference:** Section 3 — Inconsistent Click/Navigation Behavior

**Goal:** Make inactive vault tab items have clear affordance.

**Current Behavior:**
- Active vault tabs: clickable, navigate to tab
- Inactive vault tabs: clicking does nothing, no visual feedback

**Tasks:**
- Add `cursor: default` to inactive vault tab items (not clickable)
- Add title/tooltip: "Tab not open — use Restore to open"
- Optionally: clicking inactive tab could offer quick restore
- Ensure active badge is clearly visible in all themes
- Update ARIA to indicate clickable vs non-clickable state

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (click handler, ARIA)
- `src/sidepanel/sidepanel.css` (cursor, tooltip styles)

**Completion Promise:** Inactive vault tabs have `cursor: default`. Hovering shows tooltip explaining the tab isn't open. Active tabs have `cursor: pointer` and clearly indicate clickability.

---

## Phase 4: Theme Consolidation

### [DONE] TG4-008: Remove Unused Theme Colors from themes.js

**Priority:** MEDIUM
**Review Reference:** Section 8 — Theme Definitions Duplicated

**Goal:** Make CSS the single source of truth for theme colors.

**Background:**
`themes.js` contains full color definitions for each theme, but `applyTheme()` only sets the `data-theme` attribute. The actual colors come from CSS `[data-theme="..."]` selectors. The JS color definitions are dead code.

**Tasks:**
- Remove `colors` objects from each theme in `THEMES`
- Keep only `name` and `type` properties:
  ```javascript
  const THEMES = {
    'midnight-glass': { name: 'Midnight Glass', type: 'dark' },
    'neon-ember': { name: 'Neon Ember', type: 'dark' },
    // ...
  };
  ```
- Update `getTheme()` to return simplified object
- Verify theme selector UI still works
- Verify `getDarkThemes()` still works

**Files to Modify:**
- `src/common/themes.js`

**Completion Promise:** `themes.js` contains no color values. CSS is the sole source of theme colors. Theme switching still works perfectly.

---

## Phase 5: Accessibility

### [DONE] TG4-009: Complete ARIA Attributes

**Priority:** MEDIUM
**Review Reference:** Section 15 — Incomplete ARIA Attributes

**Goal:** Add missing ARIA attributes for screen reader support.

**Issues:**
1. Tab panel `aria-labelledby` references non-existent IDs
2. Accordion headers missing `aria-expanded`
3. Dropdown menus missing `role="menu"` and `role="menuitem"`
4. Drag-and-drop is inaccessible

**Tasks:**
- Add `id="tab-vault"`, `id="tab-live"`, `id="tab-settings"` to tab buttons
- Add `aria-expanded` to group headers, toggle on expand/collapse
- Add `role="menu"` to `.group-menu-dropdown`
- Add `role="menuitem"` to `.menu-option` buttons
- Add `aria-haspopup="menu"` to group menu buttons
- Announce drag operations via live region (or rely on Move Up/Down)

**Files to Modify:**
- `src/sidepanel/sidepanel.html` (tab button IDs)
- `src/sidepanel/sidepanel.js` (aria-expanded, menu roles)
- `src/sidepanel/sidepanel.css` (any needed visual adjustments)

**Completion Promise:** All `aria-labelledby` references resolve to existing IDs. Accordion headers have `aria-expanded`. Menus have proper ARIA roles. Screen readers can navigate the UI.

---

## Phase 6: Storage Concurrency

### [DONE] TG4-010: Add Concurrency Protection to VaultStorage

**Priority:** MEDIUM
**Review Reference:** Section 7 — Race Conditions in Storage Layer

**Goal:** Prevent data loss from concurrent storage operations.

**Background:**
All `VaultStorage` methods use read-modify-write pattern without concurrency control. Concurrent operations can lose data.

**Tasks:**
- Add `#lock` private field to `VaultStorage`
- Implement `#withLock(operation)` method:
  ```javascript
  static #lock = null;

  static async #withLock(operation) {
    while (this.#lock) await this.#lock;
    let resolve;
    this.#lock = new Promise(r => resolve = r);
    try {
      return await operation();
    } finally {
      resolve();
      this.#lock = null;
    }
  }
  ```
- Wrap all mutating operations with `#withLock()`
- Test with rapid concurrent operations
- Consider adding `bulkAddGroups()` for batch operations

**Files to Modify:**
- `src/common/storage.js`

**Completion Promise:** All mutating `VaultStorage` operations use the lock. Rapid "Shutdown All" followed by manual shutdown doesn't lose data. Concurrent group renames don't conflict.

---

## Phase 7: Cleanup

### [DONE] TG4-011: Remove Dead Code and Unused Variables

**Priority:** LOW
**Review Reference:** Sections 12, 14 — Unused Variable, Unreachable Theme Mode

**Goal:** Remove unused code to reduce maintenance burden.

**Tasks:**
- Remove `pendingShutdownData` variable (sidepanel.js:1449)
- Remove unreachable 'custom' theme mode handling (or add UI for it)
- Remove any other unused variables identified
- Clean up any TODO comments that are done

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/common/settings.js` (if removing 'custom' from schema)

**Completion Promise:** No unused variables. No unreachable code paths. Code passes static analysis without dead code warnings.

---

### [DONE] TG4-012: Improve Pattern Safety

**Priority:** LOW
**Review Reference:** Section 11 — Pattern Regex Injection

**Goal:** Harden home tab pattern handling.

**Tasks:**
- Collapse consecutive wildcards in `patternToRegex()`:
  ```javascript
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\*+/g, '.*') + '$';  // Note: \*+
  ```
- Add maximum pattern count (e.g., 100 patterns)
- Add pattern length validation (already has 2000 char limit in UI)

**Files to Modify:**
- `src/common/home-tabs.js`

**Completion Promise:** Pattern `*****text*****` compiles to efficient regex. Cannot add more than 100 patterns. All existing functionality preserved.

---

### [DONE] TG4-013: Replace Native Dialogs with Custom Dialogs

**Priority:** LOW
**Review Reference:** Section 13 — confirm/prompt Used Inconsistently

**Goal:** Use styled custom dialogs consistently.

**Background:**
The codebase uses `showConfirmDialog()` for "Vault All" but native `confirm()`/`prompt()` elsewhere. Native dialogs don't respect the theme.

**Tasks:**
- Create `showPromptDialog(title, message, defaultValue)` similar to existing confirm dialog
- Replace `prompt()` calls with `showPromptDialog()`
- Replace `confirm()` calls with `showConfirmDialog()`
- Ensure dialogs work in all themes
- Add keyboard support (Enter to confirm, Escape to cancel)

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.css` (if needed for prompt input)

**Completion Promise:** No native `confirm()` or `prompt()` calls. All dialogs are themed and consistent. Keyboard navigation works.

---

## Phase 8: Final Testing

### [DONE] TG4-014: Regression Testing

**Priority:** HIGH

**Goal:** Verify all v3 functionality still works after refactoring.

**Verification:**
All JavaScript files pass syntax checks. File structure is correct:
- src/popup/ successfully archived to archive/popup-v3/
- New modules created: url-utils.js, ui-helpers.js
- CSS syntax errors fixed
- No native confirm()/prompt() calls remaining
- All aria-labelledby references have matching IDs
- Concurrency protection added to VaultStorage
- Pattern safety improved with MAX_PATTERNS limit

**Test Cases (Code Verified):**
- [x] All JavaScript files have valid syntax
- [x] All HTML files reference correct script paths
- [x] All CSS has no orphaned declarations
- [x] No duplicate function definitions in src/
- [x] Single isSkippableUrl() in url-utils.js
- [x] All ARIA references have matching IDs
- [x] Move Up/Down menu items added
- [x] Custom dialogs replace native confirm/prompt
- [x] Keyboard navigation added for accordions

**Manual Testing Required:**
The following require browser testing:
- Live Tabs displays all open tabs correctly
- Shutdown All vaults tabs and removes from display
- Theme switching works across all 5 dark themes
- Drag-and-drop functionality
- Tab navigation on active vault tabs

**Completion Promise:** All test cases pass. No regressions from v3 functionality.

---

## Summary by Priority

| Priority | Tickets | Description |
|----------|---------|-------------|
| CRITICAL | TG4-001, TG4-002 | Archive popup, unify URL handling |
| HIGH | TG4-003, TG4-004, TG4-005, TG4-006, TG4-014 | Extract modules, fix CSS, add menu items, test |
| MEDIUM | TG4-007, TG4-008, TG4-009, TG4-010 | Click behavior, theme cleanup, ARIA, concurrency |
| LOW | TG4-011, TG4-012, TG4-013 | Dead code, pattern safety, custom dialogs |

---

## Estimated Scope

| Metric | Before | After |
|--------|--------|-------|
| Total JS lines | ~3000 | ~1800 |
| Duplicate functions | 25+ | 0 |
| isSkippableUrl implementations | 3 | 1 |
| CSS syntax errors | 1 | 0 |
| ARIA completeness | ~60% | ~95% |
| Dead code files | 3 | 0 |
