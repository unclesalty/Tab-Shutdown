# Developer Guide

Technical documentation for developers working on Tab Goblin.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Modules](#core-modules)
4. [Concurrency & Locking](#concurrency--locking)
5. [Chrome APIs Used](#chrome-apis-used)
6. [Data Flow](#data-flow)
7. [Message Passing](#message-passing)
8. [Storage Schema](#storage-schema)
9. [Testing](#testing)
10. [Debugging](#debugging)
11. [Common Tasks](#common-tasks)

---

## Architecture Overview

Tab Goblin follows the Chrome Extension Manifest V3 architecture:

```
┌─────────────────────────────────────────────────────────┐
│                      Chrome Browser                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     Messages      ┌─────────────────┐ │
│  │              │ ◄───────────────► │                 │ │
│  │  Side Panel  │                   │ Service Worker  │ │
│  │(sidepanel.js)│                   │  (background)   │ │
│  │              │                   │                 │ │
│  └──────┬───────┘                   └────────┬────────┘ │
│         │                                    │          │
│         │ imports                            │ imports  │
│         ▼                                    ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                 Common Modules                   │    │
│  │  ┌───────────┐ ┌────────────┐ ┌──────────────┐  │    │
│  │  │ storage.js│ │home-tabs.js│ │ settings.js  │  │    │
│  │  └───────────┘ └────────────┘ └──────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│              ┌───────────────────────┐                  │
│              │ chrome.storage.local  │                  │
│              └───────────────────────┘                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Side Panel | `src/sidepanel/*` | User interface |
| Service Worker | `src/background/service-worker.js` | Tab operations (shutdown/restore) |
| Storage Module | `src/common/storage.js` | Vault data CRUD |
| Home Tabs Module | `src/common/home-tabs.js` | URL pattern matching |
| Settings Module | `src/common/settings.js` | User preferences |

---

---

## Project Structure

```
chrome_tab_shutdown/
├── manifest.json                 # Extension configuration (permissions, commands)
├── src/
│   ├── assets/
│   │   ├── icon16.png           # 16x16 toolbar icon
│   │   └── icon48.png           # 48x48 extension icon
│   ├── background/
│   │   └── service-worker.js    # Background script (MV3)
│   ├── common/
│   │   ├── storage.js           # Vault storage with concurrency locking
│   │   ├── home-tabs.js         # Home tab pattern matching
│   │   ├── settings.js          # User settings with locking
│   │   ├── history.js           # History storage with locking
│   │   ├── themes.js            # Theme definitions and API
│   │   ├── dialog.js            # Unified dialog system
│   │   ├── url-utils.js         # URL validation, generateId, getDomainFromUrl
│   │   ├── ui-helpers.js        # pluralizeTabs, clearContainer, showToast
│   │   └── import-export.js     # Netscape bookmark import/export
│   └── sidepanel/
│       ├── sidepanel.html       # Side panel structure
│       ├── sidepanel.css        # Side panel styles + theme variables
│       └── sidepanel.js         # Side panel logic
├── documentation/               # This documentation
├── archive/                     # Previous version documents
├── PRD.md                       # Product requirements
├── TICKETS.md                   # Implementation tickets
└── CLAUDE.md                    # AI assistant context
```

---

## Core Modules

### storage.js

Manages vault data persistence with concurrency locking.

```javascript
// Key functions
VaultStorage.getVault()                    // Get full vault object
VaultStorage.saveVault(vault)              // Save full vault
VaultStorage.addGroup(name, tabs)          // Create new group (locked)
VaultStorage.removeGroup(groupId)          // Delete group (locked)
VaultStorage.addTabsToGroup(groupId, tabs) // Append tabs (locked)
VaultStorage.removeTabsFromGroup(groupId, tabIds) // Remove specific tabs (locked)
VaultStorage.getGroup(groupId)             // Get single group
VaultStorage.updateGroup(groupId, updates) // Update group properties (locked)
VaultStorage.moveTab(sourceGroupId, tabId, targetGroupId, beforeTabId) // Move tab (locked)
VaultStorage.moveGroup(sourceGroupId, targetGroupId, insertBefore) // Reorder groups (locked)
```

### history.js

Manages recently closed tabs with concurrency locking.

```javascript
// Key functions
History.getHistory()                       // Get history object
History.addToHistory(tab)                  // Add single tab (locked, deduplicates)
History.addManyToHistory(tabs)             // Add multiple tabs (locked, deduplicates)
History.removeFromHistory(tabId)           // Remove single tab (locked)
History.clearHistory()                     // Clear all history (locked)
```

### home-tabs.js

Handles home tab URL pattern matching with batch operations.

```javascript
// Key functions
HomeTabs.getHomePatterns()                 // Get all patterns
HomeTabs.addHomePattern(pattern)           // Add new pattern
HomeTabs.removeHomePattern(pattern)        // Remove pattern
HomeTabs.isHomeTab(url)                    // Async check
HomeTabs.isHomeTabSync(url, patterns)      // Sync check (patterns pre-loaded)
HomeTabs.patternToRegex(pattern)           // Convert wildcard to regex (ReDoS-safe)
HomeTabs.trackManyHomeInstances(tabInfos)  // Batch track multiple tabs
```

### settings.js

Manages user preferences with concurrency locking.

```javascript
// Key functions
Settings.getSettings()                     // Get all settings
Settings.getSetting(key)                   // Get single setting
Settings.updateSetting(key, value)         // Update single setting (locked)

// Settings keys
{
  themeMode: 'system' | 'light' | 'dark',
  lightPalette: string,
  darkPalette: string,
  skipShutdownAllConfirm: boolean,
  skipLargeRestoreConfirm: boolean,
  onboardingComplete: boolean
}
```

### dialog.js

Unified dialog system for confirms and prompts.

```javascript
// Key functions
Dialog.showConfirm(options)                // Show confirmation dialog
Dialog.showPrompt(options)                 // Show input prompt dialog
Dialog.hide()                              // Hide current dialog
```

### url-utils.js

URL validation and utility functions.

```javascript
// Key functions
UrlUtils.isSkippableUrl(url)               // Check if URL should be skipped (chrome://, etc.)
UrlUtils.isValidUrlForOpening(url)         // Validate URL is safe to open
UrlUtils.getDomainFromUrl(url)             // Extract domain from URL
UrlUtils.normalizeUrl(url)                 // Normalize URL for comparison
UrlUtils.generateId()                      // Generate unique ID (timestamp + random)
```

### import-export.js

Netscape Bookmark HTML import/export.

```javascript
// Key functions
ImportExport.generateNetscapeBookmarks(vault) // Generate HTML from vault
ImportExport.parseNetscapeBookmarks(html)     // Parse HTML to groups
ImportExport.downloadExport(vault)            // Download vault as HTML file
ImportExport.importToVault(parsedGroups)      // Import groups to vault
```

### themes.js

Theme definitions and application.

```javascript
// Key functions
Themes.applyTheme(palette)                 // Apply a theme palette
Themes.getDarkPalettes()                   // Get list of dark palettes
Themes.getLightPalettes()                  // Get list of light palettes
```

### service-worker.js

Background script handling tab operations.

```javascript
// Message handlers
'shutdown-tabs'           // Vault specific tabs
'shutdown-all'            // Vault all non-home tabs
'shutdown-tabs-by-domain' // Vault tabs, group by domain
'shutdown-domain'         // Vault all tabs from a domain
'restore-group'           // Open group tabs, remove from vault
'restore-tabs'            // Open specific tabs, remove from vault
'duplicate-group'         // Open group tabs, keep in vault
'duplicate-tabs'          // Open specific tabs, keep in vault
'get-domain-groups'       // Get open tabs grouped by domain
```

---

## Concurrency & Locking

All storage modules use a locking mechanism to prevent race conditions during read-modify-write operations.

### Why Locking?

When "Vault All" closes 20 tabs rapidly, 20 concurrent calls to storage can interleave:
1. Read A, Read B (both see same state)
2. Modify A, Modify B (both modify independently)
3. Write A, Write B (B overwrites A's changes)

This causes data loss. Locking ensures sequential execution.

### Lock Implementation

Each module uses a `withLock()` pattern:

```javascript
let lockPromise = Promise.resolve();

async function withLock(operation) {
  const previousLock = lockPromise;
  let resolve;
  lockPromise = new Promise(r => { resolve = r; });

  try {
    await previousLock;
    return await operation();
  } finally {
    resolve();
  }
}

// Usage in methods
async function addGroup(name, tabs) {
  return withLock(async () => {
    const vault = await getVault();
    // ... modify vault ...
    await saveVault(vault);
    return group;
  });
}
```

### Modules with Locking

| Module | Lock Function | Operations Protected |
|--------|---------------|---------------------|
| storage.js | `withLock()` | All vault mutations |
| history.js | `withHistoryLock()` | All history mutations |
| settings.js | `withSettingsLock()` | Settings updates |

### Important: Always Use Locked Methods

Never bypass locked methods by calling `getVault()` + direct mutation + `saveVault()`. Always use the provided methods like `addGroup()`, `moveTab()`, etc.

---

## Chrome APIs Used

### chrome.tabs

```javascript
// Query tabs
chrome.tabs.query({})                      // All tabs
chrome.tabs.query({ active: true, currentWindow: true }) // Current tab

// Manipulate tabs
chrome.tabs.create({ url, active: false }) // Open new tab
chrome.tabs.remove(tabId)                  // Close tab
chrome.tabs.remove([tabIds])               // Close multiple tabs
chrome.tabs.get(tabId)                     // Get tab info
```

### chrome.storage.local

```javascript
// Read
chrome.storage.local.get('vault')          // Get specific key
chrome.storage.local.get(null)             // Get all data

// Write
chrome.storage.local.set({ vault: data })  // Set data
```

### chrome.runtime

```javascript
// Messaging
chrome.runtime.sendMessage({ action, ...params })  // Send to background
chrome.runtime.onMessage.addListener(handler)      // Listen in background

// Lifecycle
chrome.runtime.onInstalled.addListener(handler)    // Extension installed/updated
```

### chrome.commands

```javascript
// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  // command: 'shutdown-current-tab' or 'shutdown-all-tabs'
});

// Get current shortcut configuration
const commands = await chrome.commands.getAll();
const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
const shortcut = actionCommand?.shortcut || 'Not set';
```

### chrome.sidePanel

```javascript
// Open side panel programmatically
chrome.sidePanel.open({ windowId: tab.windowId });

// Set default behavior (open on action click)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

---

## Data Flow

### Shutdown Flow

```
User clicks "Vault All"
        │
        ▼
sidepanel.js: executeShutdownAll()
        │
        ├─► Check skipShutdownAllConfirm setting
        ├─► Query all tabs
        ├─► Filter out home tabs
        ├─► Show confirmation dialog (if enabled)
        │
        ▼
chrome.runtime.sendMessage({ action: 'shutdown-all' })
        │
        ▼
service-worker.js: handleMessage()
        │
        ├─► Query all tabs
        ├─► Filter skippable URLs (chrome://)
        ├─► Filter home tabs
        ├─► VaultStorage.addGroup(name, tabs)
        ├─► History.addManyToHistory(tabs)
        ├─► chrome.tabs.remove(tabIds)
        │
        ▼
Return { success: true, count: N }
        │
        ▼
sidepanel.js: showToast(), renderVaultGroups()
```

### Restore Flow

```
User clicks "Restore" on group
        │
        ▼
sidepanel.js: restoreGroup(groupId)
        │
        ├─► Check group size
        ├─► Show confirmation dialog (if 10+ tabs)
        │
        ▼
chrome.runtime.sendMessage({ action: 'restore-group', groupId })
        │
        ▼
service-worker.js: restoreGroup()
        │
        ├─► VaultStorage.getGroup(groupId)
        ├─► chrome.tabs.create() for each tab
        ├─► VaultStorage.removeGroup(groupId)
        │
        ▼
Return { success: true, count: N }
        │
        ▼
sidepanel.js: showToast(), renderVaultGroups()
```

---

## Message Passing

### Side Panel → Service Worker

```javascript
// In sidepanel.js
const response = await chrome.runtime.sendMessage({
  action: 'shutdown-tabs',
  tabIds: [1, 2, 3],
  groupName: 'My Group'
});

if (response.success) {
  showToast(`Vaulted ${response.count} tabs`);
} else {
  showToast(response.error, 'error');
}
```

### Service Worker Handler

```javascript
// In service-worker.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.action) {
    case 'shutdown-tabs':
      return await shutdownTabs(message.tabIds, message.groupName);
    // ... other actions
  }
}
```

---

## Storage Schema

### Vault Structure

```javascript
{
  "vault": {
    "groups": [
      {
        "id": "lxyz123abc",           // Unique ID (timestamp + random)
        "name": "Research",            // Display name
        "createdAt": 1708617600000,    // Unix timestamp
        "tabs": [
          {
            "id": "lxyz456def",        // Unique tab ID
            "url": "https://example.com/page",
            "title": "Example Page Title",
            "favIconUrl": "https://example.com/favicon.ico",
            "vaultedAt": 1708617600000
          }
        ]
      }
    ]
  }
}
```

### Home Patterns

```javascript
{
  "homeTabPatterns": [
    "*://mail.google.com/*",
    "https://calendar.google.com/*",
    "*://localhost:*/*"
  ]
}
```

### Settings

```javascript
{
  "settings": {
    "themeMode": "system",         // 'system' | 'light' | 'dark'
    "lightPalette": "daylight-glass",
    "darkPalette": "slate-minimal",
    "skipShutdownAllConfirm": false,
    "skipLargeRestoreConfirm": false,
    "onboardingComplete": true
  }
}
```

### History

```javascript
{
  "history": {
    "tabs": [
      {
        "id": "lxyz789ghi",
        "url": "https://example.com/page",
        "title": "Example Page",
        "favIconUrl": "https://example.com/favicon.ico",
        "closedAt": 1708617600000
      }
    ]
  }
}
```

---

## Testing

### Manual Testing Checklist

1. **Load extension**
   - [ ] No errors in `chrome://extensions`
   - [ ] Icon appears in toolbar
   - [ ] Side panel opens on click
   - [ ] Keyboard shortcut (Ctrl/Cmd+Shift+G) toggles panel

2. **Vault operations**
   - [ ] Vault All closes tabs
   - [ ] Tabs appear in vault
   - [ ] Home tabs are preserved
   - [ ] Restore opens tabs
   - [ ] Group is removed after restore
   - [ ] Drag-and-drop moves tabs between groups

3. **Data persistence**
   - [ ] Vault survives panel close
   - [ ] Vault survives browser restart
   - [ ] Vault survives extension reload

4. **Import/Export**
   - [ ] Export downloads valid HTML file
   - [ ] Exported file imports into Chrome bookmarks
   - [ ] Import parses Chrome bookmark exports
   - [ ] Round-trip: export then import preserves data

5. **Themes**
   - [ ] System mode follows OS preference
   - [ ] Light/Dark mode switches correctly
   - [ ] All palettes apply without errors

6. **Edge cases**
   - [ ] Empty vault displays message
   - [ ] Search with no results shows message
   - [ ] Large groups (50+ tabs) perform well

### Console Testing

Open side panel, right-click → Inspect, then:

```javascript
// Check vault contents
chrome.storage.local.get('vault', d => console.log(d));

// Check home patterns
chrome.storage.local.get('homeTabPatterns', d => console.log(d));

// Manually add test data
VaultStorage.addGroup('Test Group', [
  { url: 'https://example.com', title: 'Test' }
]);
```

---

## Debugging

### Service Worker Debugging

1. Go to `chrome://extensions`
2. Find Tab Goblin
3. Click "service worker" link
4. DevTools opens for background script

### Side Panel Debugging

1. Open the side panel (click icon or press Ctrl/Cmd+Shift+G)
2. Right-click inside side panel
3. Select "Inspect"
4. DevTools opens for side panel

### Common Issues

**"Cannot read property of undefined"**
- Check if storage data exists
- Ensure async operations are awaited

**Message not received**
- Verify `return true` in listener
- Check action name spelling

**Tabs not closing**
- Check for chrome:// URLs (can't close)
- Verify tab IDs are valid numbers

---

## Common Tasks

### Adding a New Message Handler

1. Define action in service-worker.js:
```javascript
case 'my-new-action':
  return await myNewFunction(message.param);
```

2. Implement the function:
```javascript
async function myNewFunction(param) {
  try {
    // ... logic
    return { success: true, result: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

3. Call from sidepanel.js:
```javascript
const response = await chrome.runtime.sendMessage({
  action: 'my-new-action',
  param: value
});
```

### Adding a New Setting

1. Add default in settings.js:
```javascript
const DEFAULT_SETTINGS = {
  // ... existing
  myNewSetting: false
};
```

2. Use in code:
```javascript
const value = await Settings.getSetting('myNewSetting');
```

3. Add UI toggle in Settings panel if needed.

### Adding a New Panel Section

1. Add HTML structure in sidepanel.html within the appropriate tab panel.

2. Add render function in sidepanel.js:
```javascript
function renderMySection() {
  const container = document.getElementById('mySection');
  // ... build DOM elements
}
```

3. Add styles in sidepanel.css using CSS custom properties for theming.

---

## Code Style Guidelines

- **No frameworks** — Vanilla JavaScript only
- **ES6+** — Use modern syntax (async/await, arrow functions, destructuring)
- **Safe DOM** — Never use innerHTML with untrusted content
- **Error handling** — Wrap async operations in try/catch
- **Comments** — Document complex logic, not obvious code
- **Naming** — camelCase for functions/variables, UPPER_CASE for constants
