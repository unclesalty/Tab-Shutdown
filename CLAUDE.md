# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tab Goblin** (formerly Tab Vault) — a Chrome extension (Manifest V3) that solves RAM/CPU drain from too many tabs while preserving them as ADHD workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## Current Status

**v8 Planning** — Modular Architecture Refactor:
- Break up `sidepanel.js` monolith (2,794 lines -> ~15 modules of ~150-300 lines each)
- Centralized state management
- Panel coordinators for Live Tabs, Vault, Settings
- Separation of concerns: rendering, state, events

**v7.1 Complete** — UI Polish:
- Home Tabs section persists across Live Tabs and Vault panels (fixed position)

**v7 Complete** (archived) — Live Tabs View Improvements:
- View toggle: switch between grouped (accordion) and ungrouped (flat list) views
- Ungrouped view: tabs sorted by domain, displayed with domain badges
- Button state management: Vault buttons disabled until tabs selected
- Group checkbox behavior: selecting group selects all tabs in group
- Multi-group vaulting: vault from multiple domains in one action

**v6 Complete** (archived):
- Import/Export in Netscape Bookmark HTML format (Chrome-compatible)
- Keyboard shortcut to toggle side panel (Ctrl/Cmd+Shift+G)
- OS-specific shortcut display in Settings (macOS shows Cmd, Windows shows Ctrl)
- Link to Chrome shortcut configuration page
- Code review fixes: concurrency locks, dialog consolidation, batch operations

**v5 Complete** (archived):
- Light mode themes (5 palettes matching dark themes)
- Vault UI improvements, history fixes

**v4 Complete** (archived):
- Architecture refactor, shared modules, concurrency protection

**v3 Complete** (archived):
- Theme system, tab navigation, rebrand to "Tab Goblin"

**v2 Complete** (archived):
- Side panel UI, drag-and-drop, home tab protection

## Key Documents

- **PRD.md** — Full product requirements for v8 (modular architecture refactor)
- **TICKETS.md** — Implementation tickets (check for `[DONE]` status)
- **PROMPT.md** — Ralph Loop instructions (ONLY used with `/ralph-loop` command)
- **context_items/claude_review.md** — Comprehensive code review (v6 baseline, fixes applied)
- **archive/** — Completed v1-v7 iteration documents
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
│   │   ├── sidepanel.css  # Theme system + component styles
│   │   └── sidepanel.js
│   ├── background/       # Service worker
│   │   └── service-worker.js
│   ├── common/           # Shared modules
│   │   ├── storage.js    # Vault storage with concurrency locking
│   │   ├── home-tabs.js  # Home tab patterns with batch operations
│   │   ├── settings.js   # User settings with concurrency locking
│   │   ├── history.js    # History storage with concurrency locking
│   │   ├── themes.js     # Theme definitions and Themes API
│   │   ├── dialog.js     # Unified dialog system (confirm/prompt)
│   │   ├── ui-helpers.js # pluralizeTabs, clearContainer, showToast
│   │   ├── url-utils.js  # isSkippableUrl, getDomainFromUrl, generateId
│   │   └── import-export.js  # Netscape bookmark import/export
│   └── assets/           # Icons
├── context_items/        # Code reviews and context documents
├── documentation/        # User and developer docs
├── archive/              # Completed iteration documents (v1-v6)
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

## v8 Architecture Notes

### Current Problem
`sidepanel.js` is a 2,794-line monolith with 79 functions and 12+ global variables. Hard to maintain, test, or extend.

### Target Structure
```
src/sidepanel/
├── sidepanel.js              # Entry point only (~200 lines)
├── modules/
│   ├── state.js              # Centralized state management
│   ├── navigation.js         # Tab bar, panel switching
│   ├── search.js             # Global search
│   ├── theme-ui.js           # Theme initialization
│   │
│   ├── live-tabs/            # Live Tabs panel
│   │   ├── index.js          # Coordinator
│   │   ├── home-tabs-ui.js
│   │   ├── open-tabs-ui.js
│   │   ├── tab-item.js
│   │   └── view-toggle.js
│   │
│   ├── vault/                # Vault panel
│   │   ├── index.js          # Coordinator
│   │   ├── group-card.js
│   │   ├── tab-item.js
│   │   ├── history-ui.js
│   │   └── drag-drop.js
│   │
│   └── settings/             # Settings panel
│       ├── index.js          # Coordinator
│       ├── theme-settings.js
│       ├── shortcut-ui.js
│       ├── data-settings.js
│       └── patterns-ui.js
```

### Module Pattern
Using revealing module pattern (no bundler):
```javascript
const ModuleName = (function() {
  // Private state and functions

  return {
    // Public API
    init() { },
    render() { },
  };
})();
```

### State Management
Centralized State module with subscription system:
```javascript
State.subscribe('selection', callback);
State.addSelectedTab(id); // Triggers 'selection' event
```

## v7 Implementation Notes (Archived)

### Live Tabs View Toggle
- Two view modes: `'grouped'` (default) and `'ungrouped'`
- Setting: `liveTabsView` in Settings storage

### Home Tabs Persistence (v7.1)
- Home Tabs section moved outside panel divs
- Visible on Live Tabs and Vault, hidden on Settings
- CSS: `main-content` is flex column, panels use `flex: 1`

## v6 Implementation Notes (Archived)

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
