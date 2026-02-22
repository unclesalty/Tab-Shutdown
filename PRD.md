# PRD: Tab Goblin v4 — Architecture Refactor

## Overview

**Tab Goblin** is a Chrome extension that solves RAM/CPU drain from too many tabs while preserving them as workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## v4 Goals

This release focuses on **architectural improvements** and **code quality** based on the comprehensive code review (`context_items/opus-cursor-review.md`). No new user-facing features — this is a foundation-strengthening release.

1. **Eliminate Code Duplication** — Extract shared logic into common modules
2. **Unify Behavioral Contracts** — Single implementation for URL handling, navigation, drag-and-drop
3. **Remove Dead Code** — Archive unreachable popup, remove unused variables
4. **Fix CSS Issues** — Syntax errors, performance-impacting rules
5. **Improve Accessibility** — Complete ARIA attributes, keyboard alternatives
6. **Add Concurrency Protection** — Prevent race conditions in storage operations

---

## Problem Statement

The v3 codebase has a **systemic lack of shared abstractions**. The sidepanel and popup (now dead code) diverged into parallel implementations with subtly different logic. This creates:

- **Inconsistent behavior** — Same function behaves differently in different contexts
- **Maintenance burden** — Fixes in one place don't propagate to others
- **Bug risk** — Drift between implementations causes subtle issues
- **Code bloat** — ~3000 lines when ~1500 would suffice

---

## Architecture Changes

### Phase 1: Resolve Popup vs Sidepanel

**Decision: Archive the popup.**

The popup is unreachable (no `default_popup` in manifest.json). The sidepanel is the primary UI. Maintaining two parallel implementations is the root cause of behavioral divergence.

**Actions:**
- Move `src/popup/` to `archive/popup-v3/`
- Remove popup references from documentation
- Single UI codebase going forward

### Phase 2: Extract Shared Modules

Create new modules in `src/common/`:

#### `src/common/ui-helpers.js`
```javascript
// Shared UI utilities
pluralizeTabs(count)        // "1 tab" vs "5 tabs"
clearContainer(element)      // Remove all children
showToast(message, type)    // Toast notifications
setLoading(container, bool) // Loading state
getDefaultFavicon(url)      // Favicon fallback
truncateUrl(url, maxLen)    // URL display truncation
```

#### `src/common/url-utils.js`
```javascript
// URL handling (SINGLE source of truth)
isSkippableUrl(url)         // chrome://, chrome-extension://, undefined
getDomainFromUrl(url)       // Extract domain
normalizeUrl(url)           // Normalize for comparison
groupTabsByDomain(tabs)     // Group tabs by domain
```

#### `src/common/vault-ui.js`
```javascript
// Vault rendering (parameterized for features)
createGroupCard(group, options)  // Options: { draggable, menuItems }
createTabItem(tab, options)      // Options: { checkbox, dragEnabled }
renderVaultGroups(groups, options)
renderSearchResults(results, options)
```

### Phase 3: Unify Behavioral Contracts

#### URL Skipping (Critical Fix)
Current divergence:
- `sidepanel.js`: `if (!url) return false` — tabs without URLs are included
- `popup.js` / `service-worker.js`: `return !url || ...` — tabs without URLs are skipped

**Decision:** Tabs without URLs should be skipped (they're edge cases like about:blank or loading tabs).

Single implementation in `url-utils.js`:
```javascript
function isSkippableUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
}
```

#### Click Behavior Contract
Universal interaction model:
| Context | Row Click | Checkbox Click | Button Click |
|---------|-----------|----------------|--------------|
| Live Tabs | Navigate to tab | Toggle selection | Action |
| Vault (active) | Navigate to tab | N/A | Action |
| Vault (inactive) | Show tooltip | N/A | Action |

#### Drag-and-Drop Contract
Both drag-and-drop AND menu-based reordering should be available:
- Add "Move Up/Down" to sidepanel vault group menu
- ARIA attributes on all draggable elements
- Live region announcements for screen readers

### Phase 4: Fix CSS Issues

#### Syntax Error (Line 857-858)
```css
/* REMOVE orphaned declaration */
.domain-tab-checkbox {
  margin-right: 8px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
  border-bottom: 1px solid var(--border); /* ORPHANED - REMOVE */
}                                          /* STRAY BRACE - REMOVE */
```

#### Universal Transition Rule
```css
/* REMOVE - causes performance issues */
*, *::before, *::after {
  transition-property: background-color, border-color, color;
  ...
}

/* REPLACE WITH specific selectors */
.tab-btn, .group-header, .domain-group-header,
.home-tab-item, .btn, .tab-action-btn {
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
```

### Phase 5: Theme Consolidation

Current state: Theme colors defined in both `themes.js` and `sidepanel.css`. The JS colors are **never used** — CSS is the actual source of truth.

**Decision:** Remove color definitions from `themes.js`. Keep only:
- `applyTheme(themeKey)` — Sets `data-theme` attribute
- `getThemeKeys()` — Returns available themes
- `getDarkThemes()` — Returns dark theme list for UI

CSS remains the single source of truth for colors.

### Phase 6: Storage Concurrency

Add mutex/lock to prevent race conditions:

```javascript
// VaultStorage with concurrency protection
class VaultStorage {
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

  static async addTabsToGroup(groupId, tabs) {
    return this.#withLock(async () => {
      const vault = await this.getVault();
      // ... modify ...
      await this.saveVault(vault);
    });
  }
}
```

---

## Non-Goals (v4)

- New user-facing features
- Additional themes
- Export/import functionality
- Cross-device sync
- Breaking API changes to message passing

---

## Success Criteria

- [ ] `src/popup/` archived, no references in active code
- [ ] Single `isSkippableUrl()` in `src/common/url-utils.js`
- [ ] All shared functions extracted to `src/common/` modules
- [ ] CSS syntax error fixed
- [ ] Universal transition rule replaced with specific selectors
- [ ] Theme colors only in CSS, not JS
- [ ] Storage operations protected from race conditions
- [ ] All ARIA attributes complete
- [ ] Code reduced from ~3000 lines to ~1800 lines
- [ ] All existing functionality preserved (regression-free)

---

## File Structure (v4 Target)

```
chrome_tab_shutdown/
├── manifest.json
├── src/
│   ├── sidepanel/              # Primary UI
│   │   ├── sidepanel.html
│   │   ├── sidepanel.css       # Theme system (single source of truth)
│   │   └── sidepanel.js        # Imports from common/
│   ├── background/
│   │   └── service-worker.js   # Imports from common/
│   ├── common/                 # Shared modules (NEW)
│   │   ├── storage.js          # VaultStorage with concurrency
│   │   ├── home-tabs.js        # HomeTabStorage
│   │   ├── settings.js         # Settings
│   │   ├── themes.js           # Theme API (no color definitions)
│   │   ├── url-utils.js        # NEW: URL handling
│   │   ├── ui-helpers.js       # NEW: UI utilities
│   │   └── vault-ui.js         # NEW: Vault rendering
│   └── assets/
├── archive/
│   ├── popup-v3/               # Archived popup code
│   └── ...
├── context_items/
│   └── opus-cursor-review.md   # Code review reference
├── documentation/
├── PRD.md                      # This file
├── TICKETS.md                  # Implementation tickets
└── CLAUDE.md                   # AI assistant instructions
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regressions during refactor | Medium | High | Comprehensive manual testing, test each phase |
| Module import issues | Low | Medium | Use consistent import pattern, test in browser |
| Storage race condition fix breaks edge cases | Low | High | Test concurrent operations explicitly |
| CSS changes affect theme appearance | Low | Medium | Visual review in all themes |

---

## Dependencies

- Chrome Extension APIs (tabs, storage, sidePanel)
- Vanilla JavaScript (no frameworks)
- CSS custom properties (browser support: all modern browsers)

---

## References

- **Code Review:** `context_items/opus-cursor-review.md`
- **v3 PRD (archived):** `archive/PRD-v3-2026-02-22.md`
- **v3 TICKETS (archived):** `archive/TICKETS-v3-2026-02-22.md`
