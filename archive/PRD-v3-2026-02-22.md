# PRD: Tab Goblin v3 — Chrome Extension

## Overview

**Tab Goblin** (formerly Tab Vault) is a Chrome extension that solves RAM/CPU drain from too many tabs while preserving them as workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## v3 Goals

1. **Bug Fix:** Resolve Live Tabs panel not displaying open tabs
2. **Rebrand:** Rename from "Tab Vault" to "Tab Goblin"
3. **Theme System:** Add light/dark/system/custom theme support
4. **UI Refinement:** Simplified header, consistent visual styling
5. **Navigation:** Click active tabs to navigate, auto-navigate on restore

---

## Core Concept

A tab exists in one of two states:
- **Live** — open in the browser, consuming resources
- **Vaulted** — fully closed, saved with URL/title/favicon, grouped by domain

Vaulted tabs are *closed*, not sleeping. This is what actually frees RAM/CPU.

---

## Features

### 1. Vault Groups

Tabs are organized into **groups** inside the vault.

- A group has a name and contains one or more vaulted tabs
- Users can create groups manually or let the extension auto-group by domain
- Groups can be renamed, reordered, and deleted
- Groups persist across browser restarts (`chrome.storage.local`)
- Drag-and-drop tabs between groups

### 2. Shutdown (Vault Tabs)

"Shutdown" closes live tabs and saves them to the vault.

- **Shutdown selected tabs** — user picks which tabs to vault
- **Shutdown all tabs** — vaults everything except home tabs
- **Shutdown by domain** — vault all tabs from a domain group
- Confirmation dialog for "Shutdown All" (always shown for 10+ tabs)
- Tabs auto-grouped by domain or into custom named group

### 3. Restore (Open Tabs)

"Restore" reopens vaulted tabs and removes them from the vault.

- **Restore a group** — reopens all tabs in a group, navigates to first tab
- **Restore individual tabs** — pick specific tabs, navigates to restored tab
- **Copy (Duplicate)** — open without removing from vault
- Confirmation for large restores (10+ tabs)
- **Auto-navigate** — browser automatically switches to restored tab(s)

### 4. Home Tabs (Protected)

Users designate certain tabs or URLs as "home tabs" that are never vaulted.

- Home tabs are excluded from "shutdown all" operations
- Supports URL wildcard patterns (e.g., `*://mail.google.com/*`)
- Quick add/remove from Live Tabs panel
- Distinct visual section in Live Tabs view

### 5. Side Panel UI

The side panel is the primary interface, opened by clicking the extension icon.

**Three-Tab Navigation:**
- **Vault** — Vaulted groups with search, restore/copy actions
- **Live Tabs** — Home section + open tabs grouped by domain
- **Settings** — Home tab pattern configuration, theme selection

**Header Area:**
- "Shutdown All" button (always visible)
- Clean, minimal design (same background as panel content)

**Status Bar:**
- Live tab count at bottom

### 6. Theme System

Users can select their preferred visual theme.

**Theme Modes:**
- **System** (default) — Follows OS light/dark preference
- **Light** — Light color scheme
- **Dark** — Dark color scheme
- **Custom** — User-selectable theme palette

**Built-in Theme Palettes (Dark):**
1. **Midnight Glass** — Cool, minimal, techy (blues)
2. **Neon Ember** — Warm, bold, high energy (oranges)
3. **Soft Lavender** — Calm, muted purple, zen
4. **Arctic Mint** — Fresh, clean, nature-tech (greens)
5. **Slate Minimal** — Neutral pro, pure function (grays/indigos)

**Light Mode Palettes:**
- Light versions of each palette with appropriate contrast

**Theme Variables:**
| Variable | Purpose |
|----------|---------|
| `--bg` | Main background |
| `--bg-surface` | Cards, sections |
| `--bg-hover` | Hover states |
| `--primary` | Primary action buttons |
| `--primary-hover` | Button hover |
| `--accent` | Active states, highlights |
| `--text` | Primary text |
| `--text-secondary` | Secondary/muted text |
| `--text-on-primary` | Text on primary buttons |
| `--border` | Borders, dividers |
| `--success` | Success toasts |
| `--error` | Error toasts, danger actions |
| `--warning` | Warning states |

**Implementation Requirements:**
- All colors via CSS custom properties
- Theme class on root element (e.g., `data-theme="midnight-glass"`)
- `prefers-color-scheme` media query for system mode
- Ensure text contrast meets WCAG AA (4.5:1 minimum)
- Icons/imagery must be visible in all themes

### 7. Keyboard Shortcuts

- `Alt+Shift+V` — Vault current tab
- `Alt+Shift+A` — Vault all tabs (except home)
- Standard keyboard navigation within panel

### 8. Tab Navigation

Navigate between vault and live tabs seamlessly.

**Active Tab Indicators:**
- Vault panel shows which vaulted tabs are currently open in the browser
- "Active" badge/indicator on tabs that match open browser tabs
- Real-time updates as tabs are opened/closed

**Click to Navigate:**
- Clicking an active vault tab navigates to that open tab
- Focuses both the tab and its containing window
- Works across multiple windows

**Auto-Navigate on Restore:**
- Restoring a single tab navigates to the restored tab
- Restoring a group navigates to the first restored tab
- Browser window is focused automatically

**Chrome APIs:**
```javascript
// Navigate to a tab
await chrome.tabs.update(tabId, { active: true });
await chrome.windows.update(windowId, { focused: true });
```

---

## UI Changes from v2

### Header
- **Remove:** Blue background banner with "Tab Vault" title
- **Keep:** "Shutdown All" button, repositioned
- **Result:** Clean, minimal header that matches panel background

### Emojis
- **Remove:** All emoji characters from UI
- **Replace with:** Text labels or placeholder for future icons
- Affected: Home tabs icon (house emoji), expand/collapse arrows

### Naming
- **Old:** Tab Vault
- **New:** Tab Goblin
- Update in: manifest.json, HTML titles, onboarding, documentation

---

## Technical Requirements

### Bug Fix: Live Tabs Not Displaying

**Symptom:** Live Tabs panel shows "Open Tabs: 0" but status bar shows actual count (e.g., 43)

**Investigation Areas:**
1. `chrome.tabs.query({})` may return tabs without `url` property
2. Need to check if `tabs` permission grants full URL access in side panel context
3. The `isSkippableUrl()` function returns true when `!url` — may be filtering all tabs

**Fix Approach:**
- Debug `chrome.tabs.query({})` response in side panel
- Verify tabs permission is sufficient
- Handle case where URL might be undefined initially
- Consider using `chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })` to filter

### Theme System Architecture

**Storage:**
```javascript
{
  settings: {
    themeMode: 'system' | 'light' | 'dark' | 'custom',
    themePalette: 'midnight-glass' | 'neon-ember' | 'soft-lavender' | 'arctic-mint' | 'slate-minimal',
    // ... other settings
  }
}
```

**CSS Structure:**
```css
/* Base variables (light mode defaults) */
:root {
  --bg: #ffffff;
  --text: #333333;
  /* ... */
}

/* Dark mode system preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg: #0f172a;
    /* ... */
  }
}

/* Explicit theme overrides */
[data-theme="midnight-glass"] {
  --bg: #0f172a;
  --bg-surface: #1e293b;
  --primary: #0ea5e9;
  --accent: #7dd3fc;
  --text: #e2e8f0;
  --text-secondary: #64748b;
  /* ... */
}
```

**Theme Application:**
- On load: Read setting, apply `data-theme` attribute
- On change: Update attribute, save to storage
- System mode: No attribute, let CSS handle via media query

---

## Non-Goals (v3)

- Cross-device sync
- Export/import vault data
- Chrome tab groups integration
- Multiple workspaces
- Tab preview thumbnails
- Analytics or usage tracking

---

## Success Criteria

- Live Tabs panel correctly displays all open browser tabs
- Theme switching works instantly with no flash
- All text readable in all themes (contrast ratio >= 4.5:1)
- 50 tabs shutdown in < 2 seconds
- 500+ tabs in vault loads without lag
- Zero data loss across restarts
- Home tabs never accidentally vaulted
- Keyboard fully accessible

---

## File Structure

```
chrome_tab_shutdown/
├── manifest.json           # Update name to "Tab Goblin"
├── src/
│   ├── sidepanel/
│   │   ├── sidepanel.html  # Update title, remove emojis
│   │   ├── sidepanel.css   # Theme system, header changes
│   │   └── sidepanel.js    # Bug fix, theme logic
│   ├── background/
│   │   └── service-worker.js
│   ├── common/
│   │   ├── storage.js
│   │   ├── home-tabs.js
│   │   ├── settings.js     # Add theme settings
│   │   └── themes.js       # NEW: Theme definitions
│   └── assets/
├── documentation/          # Update all docs
├── archive/               # Archived v1/v2 docs
├── PRD.md                 # This file
├── TICKETS.md             # Implementation tickets
├── PROMPT.md              # Ralph Loop instructions
└── CLAUDE.md              # AI assistant instructions
```
