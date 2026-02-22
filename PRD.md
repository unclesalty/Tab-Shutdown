# PRD: Tab Goblin v5 — Bug Fixes and UI Polish

## Overview

**Tab Goblin** is a Chrome extension that solves RAM/CPU drain from too many tabs while preserving them as workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## v5 Goals

This release focuses on **bug fixes**, **UI polish**, and **UX consistency**. Addressing user-reported issues and refining the interface for a smoother experience.

1. **Fix Home Tab Bugs** — Manual close handling, pattern cleanup on removal
2. **Fix History Behavior** — Duplicate prevention, proper accordion behavior
3. **Fix Vault UI** — Icon buttons, proper copy behavior, drag-and-drop reflection
4. **Add Light Mode Themes** — 5 light palettes matching the dark themes
5. **Remove Deprecated UI** — Edit Patterns section from Live Tabs, Move Up/Down buttons

---

## Problem Statement

Users have reported several bugs and UX inconsistencies:

- **Home Tab Issues**: Manually closing a home tab doesn't behave correctly; removing a home tab doesn't clear its pattern
- **History Issues**: Restored tabs re-enter history when closed; duplicates accumulate; wrong default expand state
- **Vault UI Issues**: Copy button opens tabs instead of copying to clipboard; drag-and-drop shows success but doesn't update UI; text buttons feel cluttered
- **Theme Parity**: Dark mode has 5 theme options, light mode has none
- **Redundant UI**: Edit Patterns exists on Settings page but also clutters Live Tabs

---

## Requirements

### Category 1: Home Tab Fixes

#### 1.1 Manual Home Tab Close Handling
**Current**: When a home tab is manually closed, behavior is inconsistent
**Expected**: Home tabs can be manually closed by the user without special handling — they should close normally like any other tab, but NOT be vaulted (they are protected from "Vault All" operations, not from manual close)

#### 1.2 Home Tab Pattern Cleanup
**Current**: When a home tab is removed from the Home Tab section, its pattern remains in storage
**Expected**: Removing a home tab from the UI should also remove its pattern from `HomeTabStorage`

---

### Category 2: History Behavior Fixes

#### 2.1 Prevent Restored Tabs from Re-entering History
**Current**: When a vault item is restored and then the tab is closed, it re-enters history as a new entry
**Expected**: When a tab is closed, check if its URL matches an existing vault item. If so, do NOT add to history.

#### 2.2 Prevent Duplicate History Entries
**Current**: Multiple entries for the same URL can accumulate in history
**Expected**: Before adding to history, check if URL already exists. If so, skip or update timestamp.

#### 2.3 History Collapsed by Default
**Current**: History section may be expanded by default
**Expected**: History section should be COLLAPSED by default

#### 2.4 History Position and Direction
**Current**: History position may vary
**Expected**: History should be at the BOTTOM of the Vault tab, and should accordion UPWARDS when expanded

---

### Category 3: Vault UI Improvements

#### 3.1 Icon Buttons for Individual Vault Items
**Current**: Individual vault items use text buttons (Restore, Copy, Delete)
**Expected**: Use icon buttons:
- Restore: ↗ or similar "open" icon
- Copy: 📋 or clipboard icon (Unicode, no emoji)
- Delete: ✕ or trash icon

#### 3.2 Icon Buttons for Vault Groups
**Current**: Vault groups use text buttons
**Expected**: Use icon buttons for:
- Restore (all in group)
- Rename (group name)
- Copy (all URLs in group)
- Delete (entire group)

#### 3.3 Remove Move Up/Down Buttons
**Current**: Vault groups have Move Up and Move Down buttons in menu
**Expected**: Remove these buttons entirely — drag-and-drop is sufficient for reordering

#### 3.4 Fix Copy Button Behavior
**Current**: Copy button opens tabs (same as Restore)
**Expected**: Copy button should:
- For individual item: Copy the URL to clipboard
- For group: Copy all URLs (newline-separated) to clipboard
- Show visual confirmation (toast: "Copied to clipboard" or similar)
- NOT open any tabs

#### 3.5 Fix Drag-and-Drop Visual Update
**Current**: Dragging items between vault sections shows success alert but UI doesn't reflect the change
**Expected**: After successful drag-and-drop:
- Update storage
- Re-render affected sections immediately
- Show success feedback only after UI updates

---

### Category 4: Light Mode Themes

#### 4.1 Add 5 Light Theme Palettes
**Current**: Dark mode has 5 theme options (Midnight Glass, Neon Ember, Soft Lavender, Arctic Mint, Slate Minimal); Light mode has no palette options
**Expected**: Add 5 light theme palettes as companions to the dark themes:

| Dark Theme | Light Companion | Primary Color |
|------------|-----------------|---------------|
| Midnight Glass | Daylight Glass | #0284C7 (sky blue) |
| Neon Ember | Warm Sand | #EA580C (terracotta) |
| Soft Lavender | Morning Lilac | #7C3AED (violet) |
| Arctic Mint | Spring Mint | #059669 (emerald) |
| Slate Minimal | Clean Slate | #4F46E5 (indigo) |

**Color Reference**: See `images_context_input/palettes-light.html` for full specifications

#### 4.2 Theme UI Parity
**Current**: Selecting Dark mode shows theme palette options; selecting Light mode shows nothing
**Expected**: Selecting Light mode should show the 5 light theme palettes using the SAME UI component as dark mode (reuse existing code)

---

### Category 5: Remove Deprecated UI

#### 5.1 Remove Edit Patterns from Live Tabs
**Current**: Live Tabs panel has an "Edit Patterns" link/section
**Expected**: Remove the Edit Patterns link and section entirely from Live Tabs. This functionality exists on the Settings page and the link only navigates there anyway.

---

## Non-Goals (v5)

- New features beyond bug fixes
- Export/import functionality
- Cross-device sync
- Additional dark themes
- Breaking API changes

---

## Success Criteria

- [ ] Manually closing a home tab works normally (no vault)
- [ ] Removing a home tab clears its pattern from storage
- [ ] Restored tabs don't re-enter history when closed
- [ ] No duplicate URLs in history
- [ ] History is collapsed by default
- [ ] History is at bottom of Vault, accordions upward
- [ ] Vault items use icon buttons (Restore, Copy, Delete)
- [ ] Vault groups use icon buttons (Restore, Rename, Copy, Delete)
- [ ] Move Up/Down buttons removed from vault groups
- [ ] Copy button copies URL(s) to clipboard, shows feedback
- [ ] Drag-and-drop updates UI immediately
- [ ] 5 light themes available when Light mode selected
- [ ] Light/Dark theme selectors use same UI component
- [ ] Edit Patterns removed from Live Tabs panel
- [ ] All existing functionality preserved

---

## Technical Notes

### Copy to Clipboard
Use the Clipboard API:
```javascript
await navigator.clipboard.writeText(urlOrUrls);
showToast('Copied to clipboard');
```

### Icon Buttons
Use Unicode symbols (not emoji):
- Open/Restore: ↗ (U+2197) or ⎋ (U+238B)
- Copy: ⧉ (U+29C9) or use SVG
- Delete: ✕ (U+2715)
- Rename: ✎ (U+270E)

### Theme Reuse
The `getDarkThemes()` pattern should be mirrored with `getLightThemes()`:
```javascript
function getLightThemes() {
  return Object.entries(THEMES)
    .filter(([, theme]) => theme.type === 'light')
    .map(([key, theme]) => ({ key, ...theme }));
}
```

---

## File Structure Impact

```
src/
├── common/
│   ├── themes.js        # Add light theme definitions
│   └── home-tabs.js     # Fix pattern cleanup on removal
├── sidepanel/
│   ├── sidepanel.js     # Fix copy, drag-drop, history, home tabs, remove edit patterns
│   └── sidepanel.css    # Add light theme CSS, icon button styles
└── background/
    └── service-worker.js # History duplicate prevention, home tab close handling
```

---

## References

- **Light Palette Specs**: `images_context_input/palettes-light.html`
- **Code Review**: `context_items/opus-cursor-review.md`
- **v4 PRD (archived)**: `archive/PRD-v4-2026-02-22.md`
- **v4 TICKETS (archived)**: `archive/TICKETS-v4-2026-02-22.md`
