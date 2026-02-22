# Developer Guide

Technical documentation for developers working on Tab Vault.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Modules](#core-modules)
4. [Chrome APIs Used](#chrome-apis-used)
5. [Data Flow](#data-flow)
6. [Message Passing](#message-passing)
7. [Storage Schema](#storage-schema)
8. [Testing](#testing)
9. [Debugging](#debugging)
10. [Common Tasks](#common-tasks)

---

## Architecture Overview

Tab Vault follows the Chrome Extension Manifest V3 architecture:

```
┌─────────────────────────────────────────────────────────┐
│                      Chrome Browser                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     Messages      ┌─────────────────┐ │
│  │              │ ◄───────────────► │                 │ │
│  │    Popup     │                   │ Service Worker  │ │
│  │  (popup.js)  │                   │  (background)   │ │
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
| Popup | `src/popup/*` | User interface |
| Service Worker | `src/background/service-worker.js` | Tab operations (shutdown/restore) |
| Storage Module | `src/common/storage.js` | Vault data CRUD |
| Home Tabs Module | `src/common/home-tabs.js` | URL pattern matching |
| Settings Module | `src/common/settings.js` | User preferences |

---

## Project Structure

```
chrome_tab_shutdown/
├── manifest.json                 # Extension configuration
├── src/
│   ├── assets/
│   │   ├── icon16.png           # 16x16 toolbar icon
│   │   └── icon48.png           # 48x48 extension icon
│   ├── background/
│   │   └── service-worker.js    # Background script (MV3)
│   ├── common/
│   │   ├── storage.js           # Vault storage operations
│   │   ├── home-tabs.js         # Home tab pattern matching
│   │   └── settings.js          # User settings storage
│   └── popup/
│       ├── popup.html           # Popup structure
│       ├── popup.css            # Popup styles
│       └── popup.js             # Popup logic
├── documentation/               # This documentation
├── PRD.md                       # Product requirements
├── TICKETS.md                   # Implementation tickets
└── CLAUDE.md                    # AI assistant context
```

---

## Core Modules

### storage.js

Manages vault data persistence.

```javascript
// Key functions
VaultStorage.getVault()                    // Get full vault object
VaultStorage.saveVault(vault)              // Save full vault
VaultStorage.addGroup(name, tabs)          // Create new group
VaultStorage.removeGroup(groupId)          // Delete group
VaultStorage.addTabsToGroup(groupId, tabs) // Append tabs
VaultStorage.removeTabsFromGroup(groupId, tabIds) // Remove specific tabs
VaultStorage.getGroup(groupId)             // Get single group
VaultStorage.updateGroup(groupId, updates) // Update group properties
```

### home-tabs.js

Handles home tab URL pattern matching.

```javascript
// Key functions
HomeTabs.getHomePatterns()                 // Get all patterns
HomeTabs.saveHomePatterns(patterns)        // Save patterns
HomeTabs.addHomePattern(pattern)           // Add new pattern
HomeTabs.removeHomePattern(pattern)        // Remove pattern
HomeTabs.isHomeTab(url)                    // Async check
HomeTabs.isHomeTabSync(url, patterns)      // Sync check (patterns pre-loaded)
HomeTabs.patternToRegex(pattern)           // Convert wildcard to regex
```

### settings.js

Manages user preferences.

```javascript
// Key functions
Settings.getSettings()                     // Get all settings
Settings.saveSettings(settings)            // Save settings
Settings.getSetting(key)                   // Get single setting
Settings.updateSetting(key, value)         // Update single setting

// Settings keys
{
  skipShutdownAllConfirm: boolean,  // Skip confirmation for Shutdown All
  skipLargeRestoreConfirm: boolean, // Skip confirmation for large restores
  onboardingComplete: boolean        // First-run onboarding shown
}
```

### service-worker.js

Background script handling tab operations.

```javascript
// Message handlers
'shutdown-tabs'      // Vault specific tabs
'shutdown-all'       // Vault all non-home tabs
'shutdown-tabs-by-domain' // Vault tabs, group by domain
'shutdown-domain'    // Vault all tabs from a domain
'restore-group'      // Open group tabs, remove from vault
'restore-tabs'       // Open specific tabs, remove from vault
'duplicate-group'    // Open group tabs, keep in vault
'duplicate-tabs'     // Open specific tabs, keep in vault
'get-domain-groups'  // Get open tabs grouped by domain
```

### popup.js

UI logic and user interaction.

Key functions:
- `init()` — Initialize popup on load
- `renderVaultGroups()` — Display vault groups
- `showSelectTabsView()` — Tab selection UI
- `shutdownAll()` — Vault all tabs
- `restoreGroup(groupId)` — Restore a group
- `showToast(message, type)` — Show notification

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
})
```

---

## Data Flow

### Shutdown Flow

```
User clicks "Shutdown All"
        │
        ▼
popup.js: shutdownAll()
        │
        ├─► Check skipShutdownAllConfirm setting
        ├─► Query all tabs
        ├─► Filter out home tabs
        ├─► Show confirmation (if enabled)
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
        ├─► chrome.tabs.remove(tabIds)
        │
        ▼
Return { success: true, count: N }
        │
        ▼
popup.js: showToast(), updateLiveTabCount(), renderVaultGroups()
```

### Restore Flow

```
User clicks "Restore" on group
        │
        ▼
popup.js: restoreGroup(groupId)
        │
        ├─► Check group size
        ├─► Show confirmation (if 10+ tabs)
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
popup.js: showToast(), updateLiveTabCount(), renderVaultGroups()
```

---

## Message Passing

### Popup → Service Worker

```javascript
// In popup.js
const response = await chrome.runtime.sendMessage({
  action: 'shutdown-tabs',
  tabIds: [1, 2, 3],
  groupName: 'My Group'
});

if (response.success) {
  console.log(`Vaulted ${response.count} tabs`);
} else {
  console.error(response.error);
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
    "skipShutdownAllConfirm": false,
    "skipLargeRestoreConfirm": false,
    "onboardingComplete": true
  }
}
```

---

## Testing

### Manual Testing Checklist

1. **Load extension**
   - [ ] No errors in `chrome://extensions`
   - [ ] Icon appears in toolbar
   - [ ] Popup opens on click

2. **Vault operations**
   - [ ] Shutdown All closes tabs
   - [ ] Tabs appear in vault
   - [ ] Home tabs are preserved
   - [ ] Restore opens tabs
   - [ ] Group is removed after restore

3. **Data persistence**
   - [ ] Vault survives popup close
   - [ ] Vault survives browser restart
   - [ ] Vault survives extension reload

4. **Edge cases**
   - [ ] Empty vault displays message
   - [ ] Search with no results shows message
   - [ ] Large groups (50+ tabs) perform well

### Console Testing

Open popup, right-click → Inspect, then:

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
2. Find Tab Vault
3. Click "service worker" link
4. DevTools opens for background script

### Popup Debugging

1. Open the popup
2. Right-click inside popup
3. Select "Inspect"
4. DevTools opens for popup

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

3. Call from popup:
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

3. Add UI toggle in popup if needed.

### Adding a New View

1. Add HTML structure in popup.html:
```html
<div id="myView" class="view hidden">
  <!-- content -->
</div>
```

2. Add show function in popup.js:
```javascript
function showMyView() {
  showView('myView');
  // initialize view
}
```

3. Add styles in popup.css.

---

## Code Style Guidelines

- **No frameworks** — Vanilla JavaScript only
- **ES6+** — Use modern syntax (async/await, arrow functions, destructuring)
- **Safe DOM** — Never use innerHTML with untrusted content
- **Error handling** — Wrap async operations in try/catch
- **Comments** — Document complex logic, not obvious code
- **Naming** — camelCase for functions/variables, UPPER_CASE for constants
