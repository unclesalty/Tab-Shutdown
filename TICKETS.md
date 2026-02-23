# TICKETS: Tab Goblin v6 — Import/Export and Keyboard Shortcuts

Each ticket includes a **Completion Promise** — the concrete condition to verify the ticket is done.

**Previous Version:** v5 archived at `archive/TICKETS-v5-2026-02-22.md`
**PRD Reference:** `PRD.md`

---

## Phase 1: Export Feature

### TG6-001: Create Import/Export Module [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.1, 1.3

**Goal:** Create a shared module for import/export functionality.

**Tasks:**
- Create `src/common/import-export.js`
- Implement `escapeHtml()` helper for safe HTML generation
- Implement `generateNetscapeBookmarks(vault)` function
- Implement `parseNetscapeBookmarks(html)` function
- Handle nested folders by flattening with "Parent > Child" naming
- Skip empty folders and `<HR>` separator elements
- Export module for use in sidepanel

**Netscape Format Structure:**
```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Goblin Export</TITLE>
<H1>Tab Goblin Export</H1>
<DL><p>
    <DT><H3 ADD_DATE="timestamp">Group Name</H3>
    <DL><p>
        <DT><A HREF="url" ADD_DATE="timestamp">Title</A>
    </DL><p>
</DL><p>
```

**Files to Create:**
- `src/common/import-export.js`

**Completion Promise:** Module exports `generateNetscapeBookmarks()` and `parseNetscapeBookmarks()` functions. Both handle the Netscape Bookmark format correctly.

---

### TG6-002: Implement Export Vault Function [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.1, 1.2

**Goal:** Generate and download vault as Netscape Bookmark HTML file.

**Tasks:**
- In `import-export.js`, implement full `generateNetscapeBookmarks()`:
  - Convert each vault group to a folder (`<H3>`)
  - Convert each tab to a bookmark (`<A HREF>`)
  - Use `vaultedAt` timestamp (convert ms to seconds)
  - Escape HTML entities in titles and URLs
- Implement `downloadExport(vault)` function:
  - Generate HTML content
  - Create Blob with `text/html` type
  - Create download link with filename `tab-goblin-export-YYYY-MM-DD.html`
  - Trigger download
  - Clean up object URL

**Files to Modify:**
- `src/common/import-export.js`

**Completion Promise:** `downloadExport()` downloads a valid Netscape Bookmark HTML file. File can be imported into Chrome bookmarks.

---

### TG6-003: Add Export UI to Settings [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.2

**Goal:** Add Export button to Settings tab.

**Tasks:**
- Add "Data" section to Settings panel (after Appearance, before Home Tabs)
- Add section header: "Data"
- Add "Export Vault" button
- Add description text: "Download your vault as a bookmark file"
- Wire button to call `downloadExport()` with current vault
- Show toast on success: "Vault exported successfully"
- Handle empty vault case: show toast "Vault is empty"

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (Settings render)
- `src/sidepanel/sidepanel.css` (section styles if needed)

**Completion Promise:** Settings tab shows "Data" section with "Export Vault" button. Clicking exports the vault as HTML file.

---

## Phase 2: Import Feature

### TG6-004: Implement Import Parser [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.3, 1.5

**Goal:** Parse Netscape Bookmark HTML into vault group structure.

**Tasks:**
- Implement `parseNetscapeBookmarks(html)`:
  - Use DOMParser to parse HTML
  - Find folder headers (`<DT><H3>`)
  - Find bookmarks (`<DT><A>`)
  - Build groups array with tabs
  - Handle nested folders: flatten with "Parent > Child" naming
  - Skip empty folders (no bookmarks)
  - Skip separator elements (`<HR>`)
  - Handle bookmarks without folder: create "Imported Bookmarks" group
- Return structure: `{ groups: [{ name, tabs: [{ url, title }] }] }`

**Edge Cases:**
- Chrome Bookmarks Bar, Other Bookmarks folders
- Firefox toolbar, menu, unsorted bookmarks
- Deeply nested folders (3+ levels)
- Empty file or invalid HTML

**Files to Modify:**
- `src/common/import-export.js`

**Completion Promise:** `parseNetscapeBookmarks()` correctly parses Chrome, Firefox, and Edge bookmark exports. Returns flat group structure.

---

### TG6-005: Implement Import to Vault [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.4, 1.5

**Goal:** Add parsed bookmark groups to vault storage.

**Tasks:**
- Implement `importToVault(parsedGroups)`:
  - Get existing vault URLs for deduplication
  - For each group:
    - Filter out tabs with URLs already in vault
    - Skip group if all tabs are duplicates
    - Add group via `VaultStorage.addGroup()`
  - Return stats: `{ groupsAdded, tabsAdded, duplicatesSkipped }`
- Add helper to `storage.js` if needed: `VaultStorage.getAllUrls()`

**Files to Modify:**
- `src/common/import-export.js`
- `src/common/storage.js` (if helper needed)

**Completion Promise:** `importToVault()` adds groups to vault. Duplicate URLs are skipped. Returns accurate counts.

---

### TG6-006: Add Import UI to Settings [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.4

**Goal:** Add Import button and file picker to Settings tab.

**Tasks:**
- Add "Import Bookmarks" button to Data section (below Export)
- Add description: "Import bookmarks or a previous export"
- Create hidden file input (`accept=".html"`)
- Wire button to trigger file input click
- On file selected:
  - Read file contents
  - Parse with `parseNetscapeBookmarks()`
  - Show confirmation dialog with counts
  - On confirm: call `importToVault()`
  - Show success toast with stats
  - Refresh vault display

**Confirmation Dialog Content:**
```
Import Bookmarks?

Found X groups with Y tabs.

This will add to your existing vault
(nothing will be replaced or deleted).

[Cancel] [Import]
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.css` (dialog styles if needed)

**Completion Promise:** Import button opens file picker. Selecting valid HTML shows confirmation dialog. Confirming imports to vault with toast feedback.

---

### TG6-007: Import Error Handling [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 1.5

**Goal:** Handle import errors gracefully.

**Tasks:**
- Handle invalid/corrupt HTML file
- Handle file with no bookmarks
- Handle file read errors
- Show appropriate error toasts:
  - "Invalid bookmark file"
  - "No bookmarks found in file"
  - "Failed to read file"
- Log errors to console for debugging

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (error handling)
- `src/common/import-export.js` (validation)

**Completion Promise:** Invalid files show appropriate error messages. No crashes or unhandled exceptions.

---

## Phase 3: Keyboard Shortcut

### TG6-008: Add Commands to Manifest [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.1

**Goal:** Define keyboard shortcut in manifest.json.

**Tasks:**
- Add `commands` section to manifest.json
- Define `_execute_action` command
- Set suggested keys:
  - `default`: "Ctrl+Shift+G"
  - `mac`: "Command+Shift+G"
- Set description: "Open Tab Goblin"

**Manifest Addition:**
```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+G",
        "mac": "Command+Shift+G"
      },
      "description": "Open Tab Goblin"
    }
  }
}
```

**Files to Modify:**
- `manifest.json`

**Completion Promise:** After extension reload, keyboard shortcut appears in `chrome://extensions/shortcuts`. Pressing shortcut toggles side panel.

---

### TG6-009: Add Shortcut Display to Settings [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.2

**Goal:** Display current keyboard shortcut in Settings with OS-appropriate formatting.

**Tasks:**
- Add "Keyboard Shortcut" section to Settings (between Appearance and Data)
- Implement `getCurrentShortcut()`:
  - Call `chrome.commands.getAll()`
  - Find `_execute_action` command
  - Return shortcut string or null
- Implement `formatShortcutForOS(shortcut)`:
  - Detect OS via `navigator.platform`
  - Replace "Ctrl" with "Cmd" on macOS
  - Keep "Ctrl" on Windows/Linux
- Display current shortcut or "Not set"
- Style shortcut as keyboard keys (rounded boxes)

**OS Detection:**
```javascript
const isMac = navigator.platform.toLowerCase().includes('mac');
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.css` (keyboard key styles)

**Completion Promise:** Settings shows "Keyboard Shortcut" section. Current shortcut displayed with correct OS modifier. "Not set" shown if no shortcut configured.

---

### TG6-010: Add Configure Shortcut Link [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.3

**Goal:** Provide link to Chrome's shortcut configuration page.

**Tasks:**
- Add "Configure in Chrome Settings" button/link below shortcut display
- On click: open `chrome://extensions/shortcuts` in new tab
- Use `chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })`
- Add brief instruction text if shortcut is "Not set"

**Files to Modify:**
- `src/sidepanel/sidepanel.js`

**Completion Promise:** Clicking "Configure" opens Chrome's extension shortcuts page in new tab.

---

## Phase 4: Polish and Testing

### TG6-011: Settings Section Ordering [DONE]

**Priority:** MEDIUM
**PRD Reference:** UI Specifications

**Goal:** Ensure Settings sections are in correct order.

**Correct Order:**
1. Appearance (Theme Mode, Theme Palette)
2. Keyboard Shortcut (Current shortcut, Configure link)
3. Data (Export, Import)
4. Home Tabs (Pattern list, Add pattern)

**Tasks:**
- Review Settings render function
- Ensure sections render in correct order
- Verify visual spacing between sections

**Files to Modify:**
- `src/sidepanel/sidepanel.js`

**Completion Promise:** Settings tab sections appear in order: Appearance, Keyboard Shortcut, Data, Home Tabs.

---

### TG6-012: Import/Export Round-Trip Test [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.3

**Goal:** Verify export can be re-imported without data loss.

**Test Steps:**
1. Create vault with multiple groups and tabs
2. Export vault
3. Clear vault (or use fresh profile)
4. Import exported file
5. Verify all groups and tabs restored correctly
6. Verify timestamps preserved

**Manual Testing Checklist:**
- [ ] Export creates valid HTML file
- [ ] File opens in text editor with correct structure
- [ ] File imports into Chrome bookmarks correctly
- [ ] File imports back into Tab Goblin correctly
- [ ] Group names preserved
- [ ] Tab titles preserved
- [ ] Tab URLs preserved
- [ ] No data corruption

**Completion Promise:** Exported vault can be imported back with all data intact.

---

### TG6-013: Cross-Browser Import Test [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 1.3

**Goal:** Verify import works with exports from other browsers.

**Test Steps:**
1. Export bookmarks from Chrome
2. Export bookmarks from Firefox (if available)
3. Export bookmarks from Edge (if available)
4. Import each into Tab Goblin
5. Verify groups and tabs created correctly

**Edge Cases to Test:**
- [ ] Chrome Bookmarks Bar folder
- [ ] Chrome Other Bookmarks folder
- [ ] Nested folder structures (3+ levels)
- [ ] Special characters in titles
- [ ] Very long URLs
- [ ] Bookmarks without titles

**Completion Promise:** Chrome, Firefox, and Edge bookmark exports import correctly into Tab Goblin.

---

### TG6-014: Shortcut Functionality Test [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.1

**Goal:** Verify keyboard shortcut works correctly.

**Test Steps:**
1. Install/reload extension
2. Verify default shortcut appears in `chrome://extensions/shortcuts`
3. Press Ctrl+Shift+G (or Cmd+Shift+G on Mac)
4. Verify side panel opens
5. Press shortcut again
6. Verify side panel closes (toggles)
7. Customize shortcut in Chrome settings
8. Verify Settings displays new shortcut

**Completion Promise:** Keyboard shortcut toggles side panel. Settings displays current shortcut correctly.

---

### TG6-015: Regression Testing [DONE]

**Priority:** HIGH

**Goal:** Verify all existing functionality works after changes.

**Test Cases:**
- [ ] Vault operations (add, remove, restore groups)
- [ ] Tab vaulting (manual, vault all, vault domain)
- [ ] Home tab protection
- [ ] History functionality
- [ ] Theme switching (light/dark, all palettes)
- [ ] Drag-and-drop between groups
- [ ] Copy to clipboard
- [ ] Search functionality
- [ ] Keyboard navigation

**Completion Promise:** All existing functionality works correctly. No regressions from v5.

---

## Summary by Priority

| Priority | Tickets | Description |
|----------|---------|-------------|
| HIGH | TG6-001 to TG6-006, TG6-008 to TG6-010, TG6-012, TG6-014, TG6-015 | Core import/export, shortcut, testing |
| MEDIUM | TG6-007, TG6-011, TG6-013 | Error handling, polish, cross-browser |

---

## Dependency Graph

```
TG6-001 (module) → TG6-002 (export) → TG6-003 (export UI)
TG6-001 (module) → TG6-004 (parser) → TG6-005 (import) → TG6-006 (import UI) → TG6-007 (errors)
TG6-008 (manifest) → TG6-009 (display) → TG6-010 (configure link)
TG6-003 + TG6-006 → TG6-011 (section order)
TG6-002 + TG6-005 → TG6-012 (round-trip test)
TG6-004 → TG6-013 (cross-browser test)
TG6-008 + TG6-009 → TG6-014 (shortcut test)
All → TG6-015 (regression)
```

---

## Recommended Order

1. **TG6-001** — Create import/export module
2. **TG6-002** — Implement export function
3. **TG6-003** — Add export UI
4. **TG6-004** — Implement import parser
5. **TG6-005** — Implement import to vault
6. **TG6-006** — Add import UI
7. **TG6-007** — Import error handling
8. **TG6-008** — Add commands to manifest
9. **TG6-009** — Add shortcut display
10. **TG6-010** — Add configure link
11. **TG6-011** — Settings section ordering
12. **TG6-012** — Round-trip test
13. **TG6-013** — Cross-browser test
14. **TG6-014** — Shortcut test
15. **TG6-015** — Regression testing
