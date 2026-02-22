# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tab Vault** — a Chrome extension (Manifest V3) that solves RAM/CPU drain from too many tabs while preserving them as ADHD workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## Current Status

**v2 Complete** — Side panel UI with full feature set:
- Side panel replaces popup (chrome.sidePanel API)
- Tab-based navigation (Vault, Live Tabs, Settings)
- Unified accordion display for live tabs by domain
- Drag-and-drop between vault groups
- Home tab protection with quick-add/remove
- Keyboard navigation and accessibility
- All v1 features preserved

## Key Documents

- **PRD.md** — Full product requirements and feature specs
- **TICKETS.md** — Implementation tickets (check for `[DONE]` status)
- **PROMPT.md** — Ralph Loop instructions (ONLY used with `/ralph-loop` command)
- **archive/** — Completed iteration documents
- **documentation/** — User guide, developer guide, contributing guide

## Important: Ralph Loop Usage

**DO NOT** read or follow PROMPT.md unless explicitly running a Ralph Loop via the `/ralph-loop` slash command. PROMPT.md contains autonomous execution instructions that should only be triggered intentionally.

For normal conversation and assistance, ignore PROMPT.md entirely.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla HTML/CSS/JS (no frameworks, no bundlers)
- `chrome.storage.local` for persistence
- `chrome.sidePanel` for UI (v2)
- Background service worker for tab operations

## File Structure

```
chrome_tab_shutdown/
├── manifest.json
├── src/
│   ├── sidepanel/        # Side panel UI (v2)
│   ├── popup/            # Popup UI (v1, deprecated in v2)
│   ├── background/       # Service worker
│   ├── common/           # Shared modules (storage, home-tabs, settings)
│   └── assets/           # Icons
├── documentation/        # User and developer docs
├── archive/              # Completed iteration documents
├── PRD.md
├── TICKETS.md
├── PROMPT.md
└── README.md
```

## API Reference

### chrome.sidePanel (v2)

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
// Popup/SidePanel → Service Worker
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

## Code Standards

- **Safe DOM** — Use createElement/textContent, never parse HTML with untrusted content
- **Async/await** — For all Chrome API calls
- **Error handling** — Try/catch on async operations
- **Input validation** — Validate message parameters and user input
- **No console.log** — Remove debug statements before completion

## Context7 Usage

Use Context7 to look up Chrome Extension API documentation:

```
1. resolve-library-id: "chrome extension" + query
2. query-docs: libraryId + specific API question
```
