# TICKETS: Tab Goblin v5 — Bug Fixes and UI Polish

Each ticket includes a **Completion Promise** — the concrete condition to verify the ticket is done.

**Previous Version:** v4 archived at `archive/TICKETS-v4-2026-02-22.md`
**PRD Reference:** `PRD.md`

---

## Phase 1: Home Tab Fixes

### TG5-001: Fix Home Tab Pattern Cleanup on Removal [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.2

**Goal:** When a home tab is removed from the UI, its pattern should be removed from storage.

**Background:**
When a user adds a URL as a home tab, a pattern is stored in `HomeTabStorage`. When the home tab is removed via the UI, the pattern persists in storage, causing the URL to still match as a home tab.

**Tasks:**
- Locate the remove home tab handler in `sidepanel.js`
- Identify where the home tab entry is removed from the UI list
- Add call to `HomeTabStorage.removePattern(pattern)` when removing the home tab
- Ensure the pattern being removed matches what was stored (exact URL or pattern string)
- Test: Add home tab, remove it, close tab — should vault normally

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (remove handler)
- `src/common/home-tabs.js` (verify removePattern exists and works)

**Completion Promise:** Removing a home tab from the UI also removes its pattern from storage. A previously protected URL is no longer protected after removal.

---

### TG5-002: Fix Manual Home Tab Close Handling [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.1

**Goal:** Manually closing a home tab should work normally — close the tab, don't vault it.

**Background:**
Home tabs are protected from "Vault All" operations. However, manually closing a home tab (clicking X) should close it normally. The tab should not be vaulted because the user explicitly closed it.

**Tasks:**
- Review `service-worker.js` tab close handler
- Verify home tabs are identified correctly
- Ensure manual close (single tab close) does NOT vault home tabs
- Ensure "Vault All" still skips home tabs
- Test: Open home tab, manually close — should close without vaulting

**Files to Modify:**
- `src/background/service-worker.js` (tab close handler)

**Completion Promise:** Manually closing a home tab closes it normally. The tab does not appear in vault. "Vault All" still correctly skips home tabs.

---

## Phase 2: History Behavior Fixes

### TG5-003: Prevent Restored Tabs from Re-entering History [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.1

**Goal:** Tabs that match existing vault items should not be added to history when closed.

**Background:**
When a vault item is restored, then closed, it re-enters history as a duplicate. This defeats the purpose of the vault — items persist across close/open cycles.

**Tasks:**
- In tab close handler, before adding to history:
  - Get all vault group URLs
  - Check if closed tab URL exists in any vault group
  - If match found, skip history addition
- Consider: Should we match exact URL or normalized URL?
- Test: Restore vault item, close tab — should NOT appear in history

**Files to Modify:**
- `src/background/service-worker.js` (tab close to history logic)
- `src/common/storage.js` (may need helper: `VaultStorage.hasUrl(url)`)

**Completion Promise:** Closing a tab whose URL exists in the vault does NOT add it to history.

---

### TG5-004: Prevent Duplicate History Entries [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.2

**Goal:** The same URL should not appear multiple times in history.

**Background:**
Users can accumulate multiple history entries for the same URL by repeatedly opening and closing tabs. History should have unique URLs.

**Tasks:**
- In history add logic, check if URL already exists
- If exists: Either skip entirely OR update the timestamp/title
- Decision: Skip (keep original) or Update (show most recent)?
- Recommendation: Skip — first visit is the "original" bookmark
- Test: Close same URL twice — should appear only once in history

**Files to Modify:**
- `src/common/history.js` (add duplicate check)
- `src/background/service-worker.js` (if history logic is there)

**Completion Promise:** History contains unique URLs only. Closing the same URL multiple times does not create duplicates.

---

### TG5-005: History Collapsed by Default [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 2.3

**Goal:** History section should be collapsed when first viewing the Vault tab.

**Background:**
History should be unobtrusive — collapsed by default, expanded on demand.

**Tasks:**
- Find where `expandedVaultGroups` or history section state is initialized
- Remove history from initial expanded state (if present)
- Ensure history ID is NOT in expanded set by default
- Test: Open side panel, go to Vault — history should be collapsed

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (history section render/state)

**Completion Promise:** History section is collapsed by default on page load and tab switch.

---

### TG5-006: History Position and Accordion Direction [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 2.4

**Goal:** History should be at the BOTTOM of the Vault tab and expand UPWARD.

**Background:**
History is supplementary — it should not push vault groups down. Placing it at the bottom with upward expansion keeps focus on vault content.

**Tasks:**
- In `renderVaultPanel()` or equivalent, render history AFTER vault groups
- Apply CSS for upward accordion expansion:
  - Position history at bottom
  - When expanded, content should appear above the header
  - Consider `flex-direction: column-reverse` or absolute positioning
- Test: Expand history — content should appear above the history header

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (render order)
- `src/sidepanel/sidepanel.css` (upward expansion styles)

**Completion Promise:** History section is at the bottom of Vault. Expanding it shows content above the header (accordion opens upward).

---

## Phase 3: Vault UI Improvements

### TG5-007: Icon Buttons for Individual Vault Items [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 3.1

**Goal:** Replace text buttons with icon buttons on individual vault items.

**Icons (Unicode, not emoji):**
- Restore/Open: ↗ (U+2197) — "north east arrow"
- Copy: ⧉ (U+29C9) — "two joined squares" or ⎘ (U+2398) — "next page"
- Delete: ✕ (U+2715) — "multiplication x"

**Tasks:**
- Locate `createVaultTabItem()` or equivalent function
- Replace text button labels with icons
- Add `title` attribute for accessibility: `title="Restore"`, `title="Copy"`, `title="Delete"`
- Add `aria-label` for screen readers
- Style icons appropriately (size, hover states)
- Test: Vault items show icons instead of text

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (button creation)
- `src/sidepanel/sidepanel.css` (icon button styles)

**Completion Promise:** Individual vault items display icon buttons (↗ ⧉ ✕) instead of text. Buttons have accessible labels.

---

### TG5-008: Icon Buttons for Vault Groups [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 3.2

**Goal:** Replace text buttons with icon buttons on vault group headers.

**Icons:**
- Restore All: ↗ (U+2197)
- Rename: ✎ (U+270E) — "lower right pencil"
- Copy All: ⧉ (U+29C9)
- Delete Group: ✕ (U+2715)

**Tasks:**
- Locate `createGroupCard()` or equivalent function
- Replace text button labels with icons
- Add `title` and `aria-label` attributes
- Ensure icon buttons fit in group header layout
- Test: Vault groups show icon buttons

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (group header/menu)
- `src/sidepanel/sidepanel.css` (icon styles)

**Completion Promise:** Vault group headers display icon buttons. All icons have accessible labels.

---

### TG5-009: Remove Move Up/Down Buttons [DONE]

**Priority:** LOW
**PRD Reference:** Section 3.3

**Goal:** Remove Move Up and Move Down buttons from vault group menus.

**Background:**
v4 added these for accessibility as alternatives to drag-and-drop. However, they add clutter and drag-and-drop is sufficient. Remove them to simplify the UI.

**Tasks:**
- Locate `showGroupMenu()` or group menu creation
- Remove "Move Up" and "Move Down" menu options
- Remove associated handler functions if now unused
- Test: Group context menu no longer shows move options

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (menu options, move functions)

**Completion Promise:** Vault group menus do not include "Move Up" or "Move Down" options.

---

### TG5-010: Fix Copy Button Behavior [DONE]

**Priority:** HIGH
**PRD Reference:** Section 3.4

**Goal:** Copy button should copy URL(s) to clipboard, not open tabs.

**Background:**
Currently, Copy button behaves identically to Restore — it opens tabs. The expected behavior is to copy the URL (or URLs for a group) to the clipboard.

**Tasks:**
- Locate copy button handlers for:
  - Individual vault items
  - Vault groups (copy all)
- Replace tab-opening logic with clipboard write:
  ```javascript
  // Individual item
  await navigator.clipboard.writeText(tab.url);
  showToast('Copied to clipboard');

  // Group (multiple URLs)
  const urls = group.tabs.map(t => t.url).join('\n');
  await navigator.clipboard.writeText(urls);
  showToast(`Copied ${group.tabs.length} URLs`);
  ```
- Add visual feedback (toast notification)
- Test: Click Copy — URL copied, no tabs opened

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (copy handlers)

**Completion Promise:** Copy button copies URL(s) to clipboard. Toast confirms the action. No tabs are opened.

---

### TG5-011: Fix Drag-and-Drop Visual Update [DONE]

**Priority:** HIGH
**PRD Reference:** Section 3.5

**Goal:** After drag-and-drop, UI should update immediately.

**Background:**
Dragging items between vault sections shows a success alert, but the UI doesn't reflect the change until a refresh or tab switch. The re-render should happen immediately.

**Tasks:**
- Locate drag-and-drop completion handler
- After storage update succeeds:
  - Re-render the vault panel (or affected sections)
  - Show success feedback AFTER render completes
- Ensure both source and destination sections update
- Test: Drag item between groups — UI updates immediately

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (drag handlers, re-render logic)

**Completion Promise:** Dragging items between vault sections updates the UI immediately. Both source and destination reflect the change.

---

## Phase 4: Light Mode Themes

### TG5-012: Add Light Theme Definitions [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 4.1

**Goal:** Add 5 light theme palette definitions to themes.js.

**Theme Definitions:**
```javascript
'daylight-glass': { name: 'Daylight Glass', type: 'light' },
'warm-sand': { name: 'Warm Sand', type: 'light' },
'morning-lilac': { name: 'Morning Lilac', type: 'light' },
'spring-mint': { name: 'Spring Mint', type: 'light' },
'clean-slate': { name: 'Clean Slate', type: 'light' },
```

**Tasks:**
- Add 5 light theme entries to `THEMES` object in `themes.js`
- Add `getLightThemes()` function (mirror of `getDarkThemes()`)
- Test: `Themes.getLightThemes()` returns 5 light themes

**Files to Modify:**
- `src/common/themes.js`

**Completion Promise:** `themes.js` contains 5 light theme definitions. `getLightThemes()` returns them.

---

### TG5-013: Add Light Theme CSS [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 4.1

**Goal:** Add CSS custom properties for all 5 light themes.

**Color Reference:** `images_context_input/palettes-light.html`

**Tasks:**
- Add CSS blocks for each light theme:
  ```css
  [data-theme="daylight-glass"] {
    --bg: #ffffff;
    --bg-surface: #e0f2fe;
    --primary: #0284c7;
    /* ... full palette */
  }
  ```
- Copy color values from `palettes-light.html`
- Match structure of existing dark theme CSS
- Test: Apply each theme — colors match the palette spec

**Theme Color Mapping (from palettes-light.html):**

| Theme | BG | Surface | Primary | Accent | Muted |
|-------|----|---------| --------|--------|-------|
| daylight-glass | #FFFFFF | #E0F2FE | #0284C7 | #0369A1 | #94A3B8 |
| warm-sand | #FFFFFF | #FFEDD5 | #EA580C | #C2410C | #A8A29E |
| morning-lilac | #FFFFFF | #EDE9FE | #7C3AED | #6D28D9 | #A1A1AA |
| spring-mint | #FFFFFF | #D1FAE5 | #059669 | #047857 | #9CA3AF |
| clean-slate | #FFFFFF | #EEF2FF | #4F46E5 | #4338CA | #A1A1AA |

**Files to Modify:**
- `src/sidepanel/sidepanel.css`

**Completion Promise:** All 5 light themes have CSS custom property definitions. Each theme displays correct colors.

---

### TG5-014: Light Mode Theme Selector UI [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 4.2

**Goal:** When Light mode is selected, show theme palette options (same as Dark mode).

**Background:**
Currently, selecting Dark mode shows a palette picker; Light mode shows nothing. Reuse the SAME UI component for both.

**Tasks:**
- Locate theme mode change handler in `sidepanel.js`
- When "light" is selected, show palette picker with `Themes.getLightThemes()`
- When "dark" is selected, show palette picker with `Themes.getDarkThemes()`
- Reuse the same rendering function for both
- Save selected light palette to settings
- Apply selected light palette when light mode is active
- Test: Switch to Light mode — palette options appear

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (theme mode handler, palette render)

**Completion Promise:** Selecting Light mode shows 5 light theme palette options. Selecting a light palette applies it. Same UI component as dark mode.

---

## Phase 5: Remove Deprecated UI

### TG5-015: Remove Edit Patterns from Live Tabs [DONE]

**Priority:** LOW
**PRD Reference:** Section 5.1

**Goal:** Remove the Edit Patterns link and section from Live Tabs panel.

**Background:**
The Edit Patterns functionality exists on the Settings page. Having it on Live Tabs is redundant and adds clutter. The link only navigates to Settings anyway.

**Tasks:**
- Locate Edit Patterns section/link in Live Tabs rendering
- Remove the HTML element creation
- Remove associated click handlers
- Remove CSS for removed elements (if specific to this)
- Test: Live Tabs panel no longer shows Edit Patterns

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (Live Tabs render)
- `src/sidepanel/sidepanel.css` (cleanup unused styles)

**Completion Promise:** Live Tabs panel does not contain Edit Patterns link or section.

---

## Phase 6: Testing

### TG5-016: Regression Testing [DONE]

**Priority:** HIGH

**Goal:** Verify all existing functionality works after changes.

**Test Cases:**
- [x] Home tab protection still works for "Vault All"
- [x] Adding home tabs creates correct patterns
- [x] Removing home tabs clears patterns
- [x] Manual tab close works for all tab types
- [x] History receives tabs that should be there
- [x] History does not receive vault matches or duplicates
- [x] History accordion works correctly
- [x] Vault group creation and deletion works
- [x] Vault item restore opens correct tabs
- [x] Vault item copy copies to clipboard
- [x] Vault group copy copies all URLs
- [x] Drag-and-drop between groups works
- [x] All 5 dark themes work
- [x] All 5 light themes work
- [x] Theme switching is smooth
- [x] Settings persist across reload
- [x] All icon buttons have accessible labels

**Completion Promise:** All test cases pass. No regressions from v4.

---

## Summary by Priority

| Priority | Tickets | Description |
|----------|---------|-------------|
| HIGH | TG5-001, TG5-002, TG5-003, TG5-004, TG5-010, TG5-011, TG5-016 | Home tabs, history dedup, copy fix, drag-drop, testing |
| MEDIUM | TG5-005, TG5-006, TG5-007, TG5-008, TG5-012, TG5-013, TG5-014 | History UX, icon buttons, light themes |
| LOW | TG5-009, TG5-015 | Remove move buttons, remove edit patterns |

---

## Dependency Graph

```
TG5-012 (theme defs) → TG5-013 (theme CSS) → TG5-014 (theme UI)
TG5-003 (vault match) → TG5-004 (duplicates)  [share URL checking logic]
TG5-007 (item icons) + TG5-008 (group icons)  [can be parallel]
TG5-010 (copy fix) → TG5-007, TG5-008         [copy is part of icons]
```

---

## Recommended Order

1. **TG5-010** — Fix copy behavior (high impact)
2. **TG5-011** — Fix drag-and-drop refresh
3. **TG5-001** — Home tab pattern cleanup
4. **TG5-002** — Home tab close handling
5. **TG5-003** — History vault match check
6. **TG5-004** — History duplicate prevention
7. **TG5-005** — History collapsed default
8. **TG5-006** — History position/direction
9. **TG5-007** — Individual item icons
10. **TG5-008** — Group icons
11. **TG5-009** — Remove move buttons
12. **TG5-012** — Light theme definitions
13. **TG5-013** — Light theme CSS
14. **TG5-014** — Light theme UI
15. **TG5-015** — Remove edit patterns
16. **TG5-016** — Final testing
