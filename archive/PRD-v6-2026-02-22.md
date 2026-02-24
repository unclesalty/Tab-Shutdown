# PRD: Tab Goblin v6 — Import/Export and Keyboard Shortcuts

## Overview

**Tab Goblin** is a Chrome extension that solves RAM/CPU drain from too many tabs while preserving them as workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## v6 Goals

This release adds **data portability** and **keyboard accessibility**:

1. **Import/Export** — Backup vaults to file and restore them; import Chrome bookmarks into vault
2. **Keyboard Shortcut** — Hotkey to toggle the side panel open/closed with OS-specific display

---

## Problem Statement

**Data Portability:**
- Users cannot backup their vault data
- Users cannot transfer vaults between machines or Chrome profiles
- Users with existing bookmarks cannot easily migrate to Tab Goblin
- No way to share vault groups with others

**Keyboard Accessibility:**
- Power users want to open Tab Goblin without clicking the toolbar icon
- No keyboard shortcut exists to toggle the side panel
- Users don't know how to configure Chrome extension shortcuts

---

## Feature 1: Import/Export

### 1.1 Export Format

**Requirement:** Export vault data in Netscape Bookmark HTML format (same as Chrome bookmark export).

**Format Specification:**
```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Goblin Export</TITLE>
<H1>Tab Goblin Export</H1>
<DL><p>
    <DT><H3 ADD_DATE="1708646400" LAST_MODIFIED="1708646400">Group Name</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1708646400">Page Title</A>
    </DL><p>
</DL><p>
```

**Key Points:**
- Each vault group becomes a folder (`<H3>`)
- Each tab becomes a bookmark (`<A HREF>`)
- `ADD_DATE` uses Unix timestamp (seconds since 1970)
- File downloads as `tab-goblin-export-YYYY-MM-DD.html`

### 1.2 Export UI

**Location:** Settings tab, new "Data" section

**Elements:**
- "Export Vault" button
- Brief description: "Download your vault as a bookmark file"

**Behavior:**
- Click triggers file download
- Includes all vault groups and tabs
- Does NOT include history (history is ephemeral)
- Shows toast: "Vault exported successfully"

### 1.3 Import Format

**Requirement:** Import Netscape Bookmark HTML format (Chrome/Firefox/Edge bookmark exports).

**Supported Sources:**
- Chrome bookmark export
- Firefox bookmark export
- Edge bookmark export
- Tab Goblin export (round-trip)

### 1.4 Import UI

**Location:** Settings tab, "Data" section (below Export)

**Elements:**
- "Import Bookmarks" button
- File picker (accepts `.html` files)
- Brief description: "Import bookmarks or a previous Tab Goblin export"

**Behavior:**
- Opens file picker on click
- Parses Netscape Bookmark HTML format
- Each top-level folder becomes a vault group
- Bookmarks without folders go into "Imported Bookmarks" group
- Shows confirmation dialog: "Import X groups with Y tabs?"
- On confirm: adds groups to vault, shows toast: "Imported X groups"
- Does NOT replace existing vault (additive import)

### 1.5 Import Conflict Handling

**Duplicate URLs:**
- If imported URL already exists in vault, skip it
- Count skipped duplicates and report: "Imported X tabs (Y duplicates skipped)"

**Empty Groups:**
- Skip folders with no bookmarks
- Skip separator items (`<HR>`)

**Nested Folders:**
- Flatten nested structure (Tab Goblin has flat groups)
- Nested folder names become: "Parent > Child"

---

## Feature 2: Keyboard Shortcut

### 2.1 Default Shortcut

**Requirement:** Provide a suggested keyboard shortcut to toggle the side panel.

**Implementation:**
- Use Chrome's `commands` API with `_execute_action`
- Suggested shortcut: `Ctrl+Shift+G` (Windows/Linux), `Command+Shift+G` (macOS)
- "G" for "Goblin"

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

### 2.2 Display Current Shortcut

**Location:** Settings tab, new "Keyboard Shortcut" section

**Elements:**
- Section header: "Keyboard Shortcut"
- Current shortcut display (OS-specific formatting)
- Link/button to Chrome's shortcut settings

**OS-Specific Display:**
- macOS: Show `Cmd` symbol or text (detect via `navigator.platform`)
- Windows/Linux: Show `Ctrl`

**Dynamic Shortcut Reading:**
- Use `chrome.commands.getAll()` to read actual configured shortcut
- Display whatever the user has configured (may differ from suggested)
- If no shortcut configured, show "Not set"

### 2.3 Shortcut Configuration Instructions

**Requirement:** Help users configure or change the keyboard shortcut.

**UI Elements:**
- "Configure Shortcut" link/button
- Opens `chrome://extensions/shortcuts` in new tab
- Brief instruction text: "Click to customize in Chrome settings"

**Note:** Extensions cannot programmatically open `chrome://` URLs directly. Use `chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })` which works from the extension context.

### 2.4 Shortcut Enable/Disable Toggle

**Requirement:** Allow users to disable the keyboard shortcut from the extension.

**Implementation Options:**

**Option A: Remove from manifest (not recommended)**
- Cannot dynamically modify manifest

**Option B: Inform user to clear shortcut (recommended)**
- Display instructions: "To disable, clear the shortcut in Chrome settings"
- Provide direct link to `chrome://extensions/shortcuts`

**Decision:** Option B — Chrome manages shortcuts; we display current state and link to settings.

---

## UI Specifications

### Settings Tab Layout (Updated)

```
Settings
─────────────────────────────
Appearance
  Theme Mode: [System ▼]
  Theme Palette: [○ ○ ○ ○ ○]

─────────────────────────────
Keyboard Shortcut
  Current: Cmd+Shift+G
  [Configure in Chrome Settings]

─────────────────────────────
Data
  [Export Vault]
  Download your vault as a bookmark file

  [Import Bookmarks]
  Import bookmarks or a previous export

─────────────────────────────
Home Tabs
  [List of home tab patterns...]
  [Add Pattern]
```

### Import Confirmation Dialog

```
┌─────────────────────────────────┐
│  Import Bookmarks?              │
│                                 │
│  Found 5 groups with 47 tabs.   │
│                                 │
│  This will add to your existing │
│  vault (nothing will be         │
│  replaced or deleted).          │
│                                 │
│  [Cancel]           [Import]    │
└─────────────────────────────────┘
```

---

## Technical Notes

### Netscape Bookmark Parsing

```javascript
function parseNetscapeBookmarks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const groups = [];

  // Find all DT elements (folders and bookmarks)
  const dts = doc.querySelectorAll('DT');
  // Parse folder structure...

  return groups;
}
```

### Netscape Bookmark Generation

```javascript
function generateNetscapeBookmarks(vault) {
  const timestamp = Math.floor(Date.now() / 1000);
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Goblin Export</TITLE>
<H1>Tab Goblin Export</H1>
<DL><p>
`;

  for (const group of vault.groups) {
    html += `    <DT><H3 ADD_DATE="${timestamp}">${escapeHtml(group.name)}</H3>\n`;
    html += `    <DL><p>\n`;
    for (const tab of group.tabs) {
      const addDate = Math.floor(tab.vaultedAt / 1000);
      html += `        <DT><A HREF="${escapeHtml(tab.url)}" ADD_DATE="${addDate}">${escapeHtml(tab.title)}</A>\n`;
    }
    html += `    </DL><p>\n`;
  }

  html += `</DL><p>`;
  return html;
}
```

### OS Detection for Shortcut Display

```javascript
function getModifierKey() {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) {
    return 'Cmd';  // or '⌘' for symbol
  }
  return 'Ctrl';
}

function formatShortcut(shortcut) {
  // shortcut from chrome.commands.getAll() e.g., "Ctrl+Shift+G"
  const modifier = getModifierKey();
  return shortcut.replace(/Ctrl|Command/gi, modifier);
}
```

### Reading Current Shortcut

```javascript
async function getCurrentShortcut() {
  const commands = await chrome.commands.getAll();
  const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
  return actionCommand?.shortcut || null;
}
```

---

## Non-Goals (v6)

- Cloud sync (backup to Google Drive, etc.)
- Scheduled automatic backups
- Import from other formats (JSON, CSV)
- Export individual groups (export all or nothing)
- Custom shortcut configuration within extension (use Chrome's UI)
- Multiple shortcut bindings

---

## Success Criteria

- [ ] Export button downloads valid Netscape Bookmark HTML file
- [ ] Exported file can be imported into Chrome bookmarks
- [ ] Import parses Chrome bookmark exports correctly
- [ ] Import parses Tab Goblin exports correctly (round-trip)
- [ ] Import shows confirmation dialog with counts
- [ ] Import adds groups without replacing existing vault
- [ ] Duplicate URLs are skipped during import
- [ ] Keyboard shortcut section appears in Settings
- [ ] Current shortcut is displayed with OS-appropriate modifier
- [ ] "Not set" shown when no shortcut configured
- [ ] Configure link opens Chrome shortcuts page
- [ ] Default shortcut (Ctrl/Cmd+Shift+G) works after install
- [ ] Shortcut toggles side panel open/closed

---

## File Structure Impact

```
src/
├── common/
│   ├── import-export.js    # NEW: Import/export functions
│   └── storage.js          # May need bulk import helper
├── sidepanel/
│   ├── sidepanel.js        # Settings UI updates
│   └── sidepanel.css       # New section styles
└── background/
    └── service-worker.js   # File download handling (if needed)

manifest.json               # Add commands section
```

---

## References

- **Chrome Commands API:** https://developer.chrome.com/docs/extensions/reference/api/commands
- **Chrome Shortcuts UI:** `chrome://extensions/shortcuts`
- **Netscape Bookmark Format:** http://fileformats.archiveteam.org/wiki/Netscape_bookmarks
- **v5 PRD (archived):** `archive/PRD-v5-2026-02-22.md`
- **v5 TICKETS (archived):** `archive/TICKETS-v5-2026-02-22.md`
