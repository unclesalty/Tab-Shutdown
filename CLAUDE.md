# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tab Goblin** (formerly Tab Vault) — a Chrome extension (Manifest V3) that solves RAM/CPU drain from too many tabs while preserving them as ADHD workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## Current Status

**v6 In Progress** — Import/Export and Keyboard Shortcuts:
- Import/Export in Netscape Bookmark HTML format (Chrome-compatible)
- Keyboard shortcut to toggle side panel (Ctrl/Cmd+Shift+G)
- OS-specific shortcut display in Settings (macOS shows Cmd, Windows shows Ctrl)
- Link to Chrome shortcut configuration page

**v5 Complete** (archived):
- Fixed home tab manual close and pattern cleanup on removal
- Fixed history behavior: duplicates, vault match prevention, collapsed default, bottom position
- Vault UI: icon buttons for items/groups, copy to clipboard, drag-drop refresh
- Added 5 light mode theme palettes (matching dark themes)
- Removed deprecated UI: Move Up/Down buttons, Edit Patterns from Live Tabs

**v4 Complete** (archived):
- Architecture refactor — popup archived, shared modules extracted
- Single `isSkippableUrl()` in `url-utils.js`
- CSS syntax errors fixed, universal transition rule replaced
- ARIA attributes complete, custom dialogs replace native
- Storage concurrency protection added

**v3 Complete** (archived):
- Bug fix: Live Tabs panel not displaying open tabs
- Rebrand: "Tab Vault" to "Tab Goblin"
- Remove emojis from UI
- Simplified header design
- Theme system (light/dark/system/custom modes)
- 5 dark theme palettes
- Tab navigation: click active tabs to navigate, auto-navigate on restore

**v2 Complete** (archived):
- Side panel UI with tab-based navigation (Vault, Live Tabs, Settings)
- Unified accordion display for live tabs by domain
- Drag-and-drop between vault groups
- Home tab protection with quick-add/remove
- Keyboard navigation and accessibility

## Key Documents

- **PRD.md** — Full product requirements for v6
- **TICKETS.md** — Implementation tickets (check for `[DONE]` status)
- **PROMPT.md** — Ralph Loop instructions (ONLY used with `/ralph-loop` command)
- **context_items/opus-cursor-review.md** — Comprehensive code review (v3 baseline)
- **archive/** — Completed v1-v5 iteration documents
- **documentation/** — User guide, developer guide, contributing guide

## Important: Ralph Loop Usage

**DO NOT** read or follow PROMPT.md unless explicitly running a Ralph Loop via the `/ralph-loop` slash command. PROMPT.md contains autonomous execution instructions that should only be triggered intentionally.

For normal conversation and assistance, ignore PROMPT.md entirely.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla HTML/CSS/JS (no frameworks, no bundlers)
- `chrome.storage.local` for persistence
- `chrome.sidePanel` for UI
- `chrome.commands` for keyboard shortcuts
- Background service worker for tab operations
- CSS custom properties for theming

## File Structure

```
chrome_tab_shutdown/
├── manifest.json
├── src/
│   ├── sidepanel/        # Side panel UI (primary interface)
│   │   ├── sidepanel.html
│   │   ├── sidepanel.css  # Theme system here
│   │   └── sidepanel.js
│   ├── background/       # Service worker
│   │   └── service-worker.js
│   ├── common/           # Shared modules
│   │   ├── storage.js    # Vault storage with VaultStorage class
│   │   ├── home-tabs.js  # Home tab patterns with HomeTabStorage
│   │   ├── settings.js   # User settings with Settings class
│   │   ├── themes.js     # Theme definitions and Themes API
│   │   ├── history.js    # History storage operations
│   │   ├── ui-helpers.js # pluralizeTabs, clearContainer, showToast, setLoading
│   │   ├── url-utils.js  # isSkippableUrl, getDomainFromUrl, normalizeUrl
│   │   └── import-export.js  # NEW v6: Netscape bookmark import/export
│   ├── popup/            # DEPRECATED: Unreachable (no default_popup in manifest)
│   │   ├── popup.html    # Archive candidate
│   │   ├── popup.css     # Archive candidate
│   │   └── popup.js      # Archive candidate (~75% duplicates sidepanel.js)
│   └── assets/           # Icons
├── context_items/        # Code reviews and context documents
├── documentation/        # User and developer docs
├── archive/              # Completed iteration documents
├── images_context_input/ # Reference images (palettes, screenshots)
├── PRD.md
├── TICKETS.md
├── PROMPT.md
└── README.md
```

## API Reference

### chrome.sidePanel

```javascript
// Open side panel on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Manifest configuration
{
  "permissions": ["sidePanel"],
  "side_panel": { "default_path": "src/sidepanel/sidepanel.html" }
}
```

### chrome.commands (v6)

```javascript
// Manifest configuration for keyboard shortcut
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

// Get current shortcut configuration
const commands = await chrome.commands.getAll();
const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
const shortcut = actionCommand?.shortcut || 'Not set';

// Open Chrome's shortcut configuration page
chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
```

### Message Passing

```javascript
// SidePanel to Service Worker
chrome.runtime.sendMessage({ action: 'shutdown-all' });

// Service Worker message handlers
'shutdown-tabs'           // Vault specific tabs
'shutdown-all'            // Vault all non-home tabs
'shutdown-tabs-by-domain' // Vault tabs grouped by domain
'shutdown-domain'         // Vault all tabs from a domain
'restore-group'           // Open and remove from vault
'restore-tabs'            // Open specific tabs
'duplicate-group'         // Open without removing
'duplicate-tabs'          // Open specific without removing
'get-domain-groups'       // Get live tabs grouped by domain
```

### Theme System (v3+)

```css
/* CSS custom properties */
:root {
  --bg: #ffffff;
  --bg-surface: #f9f9f9;
  --primary: #4A90D9;
  --text: #333333;
  /* ... */
}

/* Dark theme example */
[data-theme="midnight-glass"] {
  --bg: #0f172a;
  --primary: #0ea5e9;
  /* ... */
}

/* Light theme example (v5) */
[data-theme="daylight-glass"] {
  --bg: #ffffff;
  --bg-surface: #e0f2fe;
  --primary: #0284c7;
  /* ... */
}
```

```javascript
// Theme modes: 'system' | 'light' | 'dark' | 'custom'
// Apply theme
document.documentElement.setAttribute('data-theme', 'midnight-glass');
```

### Import/Export (v6)

```javascript
// Netscape Bookmark HTML format
const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Goblin Export</TITLE>
<H1>Tab Goblin Export</H1>
<DL><p>
    <DT><H3 ADD_DATE="${timestamp}">Group Name</H3>
    <DL><p>
        <DT><A HREF="url" ADD_DATE="${timestamp}">Title</A>
    </DL><p>
</DL><p>`;

// ADD_DATE is Unix timestamp (seconds since 1970)
const addDate = Math.floor(Date.now() / 1000);

// Parse imported bookmarks
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
```

### Tab Navigation (v3)

```javascript
// Navigate to a specific tab and focus its window
async function navigateToTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

// Listen for tab changes to update active indicators
chrome.tabs.onCreated.addListener(callback);
chrome.tabs.onRemoved.addListener(callback);
chrome.tabs.onUpdated.addListener(callback);
```

## Code Standards

- **Safe DOM** — Use createElement/textContent, never parse HTML with untrusted content
- **Async/await** — For all Chrome API calls
- **Error handling** — Try/catch on async operations
- **Input validation** — Validate message parameters and user input
- **CSS variables** — All colors via custom properties
- **No emojis** — Use text labels or Unicode symbols only
- **No console.log** — Remove debug statements before completion
- **D.R.Y.** — Extract shared logic to `src/common/` modules
- **Single source of truth** — One implementation per function across codebase
- **HTML escaping** — Escape user content when generating HTML for export

## v6 Implementation Notes

### Import/Export Feature
- Uses Netscape Bookmark HTML format (same as Chrome bookmark export)
- Export: vault groups become folders, tabs become bookmarks
- Import: parses Chrome/Firefox/Edge bookmark exports
- Nested folders flattened with "Parent > Child" naming
- Duplicate URLs skipped during import

### Keyboard Shortcut Feature
- Uses `_execute_action` command in manifest
- Default: Ctrl+Shift+G (Windows/Linux), Cmd+Shift+G (macOS)
- Settings displays current shortcut with OS-appropriate modifier
- Links to `chrome://extensions/shortcuts` for configuration
- `chrome.commands.getAll()` reads current user configuration

### OS Detection
```javascript
const isMac = navigator.platform.toLowerCase().includes('mac');
const modifier = isMac ? 'Cmd' : 'Ctrl';
```

## Context7 Usage

Use Context7 to look up Chrome Extension API documentation:

```
1. resolve-library-id: "chrome extension" + query
2. query-docs: libraryId + specific API question
```
