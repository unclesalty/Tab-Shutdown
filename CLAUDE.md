# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tab Goblin** (formerly Tab Vault) — a Chrome extension (Manifest V3) that solves RAM/CPU drain from too many tabs while preserving them as ADHD workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## Current Status

**v5 In Progress** — Bug fixes and UI polish:
- Fix home tab manual close and pattern cleanup on removal
- Fix history behavior: duplicates, vault match prevention, collapsed default, bottom position
- Vault UI: icon buttons for items/groups, fix copy behavior (clipboard), fix drag-drop refresh
- Add 5 light mode theme palettes (matching dark themes)
- Remove deprecated UI: Move Up/Down buttons, Edit Patterns from Live Tabs

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

- **PRD.md** — Full product requirements for v4
- **TICKETS.md** — Implementation tickets (check for `[DONE]` status)
- **PROMPT.md** — Ralph Loop instructions (ONLY used with `/ralph-loop` command)
- **context_items/opus-cursor-review.md** — Comprehensive code review (v3 baseline)
- **archive/** — Completed v1/v2/v3 iteration documents
- **documentation/** — User guide, developer guide, contributing guide

## Important: Ralph Loop Usage

**DO NOT** read or follow PROMPT.md unless explicitly running a Ralph Loop via the `/ralph-loop` slash command. PROMPT.md contains autonomous execution instructions that should only be triggered intentionally.

For normal conversation and assistance, ignore PROMPT.md entirely.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla HTML/CSS/JS (no frameworks, no bundlers)
- `chrome.storage.local` for persistence
- `chrome.sidePanel` for UI
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
│   │   └── themes.js     # Theme definitions and Themes API
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

### Theme System (v3)

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
```

```javascript
// Theme modes: 'system' | 'light' | 'dark' | 'custom'
// Apply theme
document.documentElement.setAttribute('data-theme', 'midnight-glass');
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

## Known Issues (v5 Focus)

See `TICKETS.md` for detailed bug tickets.

**High:**
- Home tab pattern not removed when home tab is removed from UI
- Manual home tab close behavior inconsistent
- Copy button opens tabs instead of copying to clipboard
- Drag-and-drop shows success but UI doesn't update
- History contains duplicates and restored tabs

**Medium:**
- History expanded by default (should be collapsed)
- History position and accordion direction
- Vault buttons use text instead of icons
- Light mode has no theme palette options (dark has 5)

**Low:**
- Move Up/Down buttons add clutter (remove)
- Edit Patterns link on Live Tabs redundant (remove)

**Shared Modules (Created in v4):**
- `src/common/ui-helpers.js` — pluralizeTabs, clearContainer, showToast, setLoading
- `src/common/url-utils.js` — isSkippableUrl, getDomainFromUrl, normalizeUrl
- `src/common/history.js` — History storage operations

## Context7 Usage

Use Context7 to look up Chrome Extension API documentation:

```
1. resolve-library-id: "chrome extension" + query
2. query-docs: libraryId + specific API question
```
