# PRD: Tab Vault — Chrome Extension

## Problem

Too many open Chrome tabs destroy RAM/CPU and slow everything down. But for ADHD workflows, open tabs serve as visual reminders and context anchors — closing them means losing track of what you were doing.

**Tab Vault** solves this by letting you fully close tabs to reclaim resources while preserving them in an organized vault you can restore from at any time.

## Core Concept

A tab is in one of two states:
- **Live** — open in the browser, consuming resources
- **Vaulted** — fully closed (not suspended/discarded), saved in the vault with its URL, title, and group

There is no middle ground. Vaulted tabs are *closed*, not sleeping. This is what actually frees RAM/CPU.

## Features

### 1. Vault Groups

Tabs are organized into **groups** inside the vault.

- A group has a name and contains one or more vaulted tabs
- Users can create groups manually or let the extension auto-group by domain
- Groups can be renamed and reordered
- Groups persist across browser restarts (stored in `chrome.storage.local`)

### 2. Shutdown (Vault Tabs)

"Shutdown" closes live tabs and saves them to the vault.

- **Shutdown selected tabs** — user picks which tabs to vault
- **Shutdown all tabs** — vaults everything except home tabs
- **Shutdown by domain** — vault all tabs matching a domain
- Shutdown assigns tabs to a group (existing or new)
- A confirmation step shows what will be closed before executing

### 3. Restore (Open Tabs)

"Restore" reopens vaulted tabs and removes them from the vault.

- **Restore a group** — reopens all tabs in a group
- **Restore individual tabs** — pick specific tabs from a group
- Restored tabs are removed from the vault (they're live again)
- Option to restore without removing from vault (duplicate)

### 4. Home Tabs (Protected)

Users designate certain tabs or URLs as "home tabs" that are never vaulted.

- Home tabs are excluded from "shutdown all" operations
- Configured via the extension popup or options page
- Supports URL patterns (e.g., `*://mail.google.com/*`)
- Home tabs are visually indicated in the popup

### 5. Extension Popup (Main UI)

The popup is the primary interface, opened by clicking the extension icon.

- Shows live tab count and resource usage estimate
- Lists vault groups with tab counts
- Quick actions: Shutdown All, Restore Group
- Search/filter across vaulted tabs
- Manage home tab patterns

### 6. Keyboard Shortcuts

- Shutdown current tab: configurable shortcut
- Shutdown all (except home): configurable shortcut
- Open popup: default Chrome extension shortcut

## Non-Goals (v1)

- Tab suspension/discarding (we fully close, period)
- Syncing vaults across devices
- Session history or undo beyond the vault itself
- Integration with Chrome tab groups (future consideration)
- Analytics or usage tracking

## Technical Constraints

- Chrome Extension Manifest V3
- Storage: `chrome.storage.local` (vault data, home tab patterns, settings)
- No external services or network calls
- Popup UI: vanilla HTML/CSS/JS or lightweight framework (TBD in tickets)
- Background service worker for shutdown/restore operations

## Success Criteria

- Shutting down 50 tabs should take < 2 seconds
- Vault with 500+ tabs should load and render in the popup without lag
- Zero data loss — vaulted tabs must survive browser restarts and extension updates
- Home tabs are never accidentally vaulted
