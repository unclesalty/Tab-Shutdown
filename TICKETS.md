# TICKETS: Tab Vault Implementation

Each ticket includes a **Completion Promise** — the concrete condition Ralph Loop checks to know the ticket is done.

---

## TV-001: Project Scaffolding & Manifest V3 Setup

**Goal:** Create the Chrome extension skeleton with Manifest V3, folder structure, and a loadable (but empty) extension.

**Tasks:**
- Create `manifest.json` (MV3) with required permissions: `tabs`, `storage`, `activeTab`
- Create folder structure: `src/`, `src/popup/`, `src/background/`, `src/common/`, `src/assets/`
- Create empty `src/background/service-worker.js`
- Create minimal `src/popup/popup.html`, `popup.css`, `popup.js`
- Add a 16x16 and 48x48 placeholder icon

**Completion Promise:** The extension loads in `chrome://extensions` with no errors, and clicking the icon opens an empty popup.

---

## TV-002: Storage Layer — Vault Data Model

**Goal:** Implement the storage module for reading/writing vault data using `chrome.storage.local`.

**Tasks:**
- Define vault data schema: `{ groups: [{ id, name, createdAt, tabs: [{ id, url, title, favIconUrl, vaultedAt }] }] }`
- Create `src/common/storage.js` with functions:
  - `getVault()` — returns full vault object
  - `saveVault(vault)` — writes full vault object
  - `addGroup(name, tabs)` — creates a group with tabs
  - `removeGroup(groupId)` — deletes a group
  - `addTabsToGroup(groupId, tabs)` — appends tabs to existing group
  - `removeTabsFromGroup(groupId, tabIds)` — removes specific tabs
- All functions are async and handle missing/corrupt data gracefully

**Completion Promise:** Unit-style manual tests in the console confirm: create a group, add tabs, remove tabs, remove group, and data persists after closing/reopening the popup.

---

## TV-003: Storage Layer — Home Tab Patterns

**Goal:** Implement storage for home tab URL patterns and a matcher function.

**Tasks:**
- Store home tab patterns in `chrome.storage.local` under key `homeTabPatterns`
- Create `src/common/home-tabs.js` with functions:
  - `getHomePatterns()` — returns array of pattern strings
  - `saveHomePatterns(patterns)` — writes pattern array
  - `addHomePattern(pattern)` — appends a pattern
  - `removeHomePattern(pattern)` — removes a pattern
  - `isHomeTab(url)` — returns boolean, matching against all patterns
- Pattern matching supports `*` wildcards (e.g., `*://mail.google.com/*`)

**Completion Promise:** `isHomeTab()` correctly matches and rejects URLs against saved patterns, verified via console testing.

---

## TV-004: Background Service Worker — Shutdown Operations

**Goal:** Implement the shutdown (vault) logic in the background service worker.

**Tasks:**
- Create `src/background/service-worker.js` with message handlers:
  - `shutdown-tabs` — receives tab IDs, a group name; vaults tabs and closes them
  - `shutdown-all` — vaults all tabs except home tabs, assigns to a named group
  - `shutdown-domain` — vaults all tabs matching a domain
- Each handler: saves tabs to vault via storage module, then calls `chrome.tabs.remove()`
- Home tabs are filtered out using `isHomeTab()` before any shutdown
- Sends response back with count of tabs vaulted

**Completion Promise:** Sending a `shutdown-all` message from the popup console correctly closes non-home tabs and they appear in the vault via `getVault()`.

---

## TV-005: Background Service Worker — Restore Operations

**Goal:** Implement the restore logic in the background service worker.

**Tasks:**
- Add message handlers to service worker:
  - `restore-group` — opens all tabs in a group, removes group from vault
  - `restore-tabs` — opens specific tabs from a group, removes them from vault
  - `duplicate-group` — opens all tabs in a group WITHOUT removing from vault
- Uses `chrome.tabs.create()` to open restored tabs
- Sends response back with count of tabs restored

**Completion Promise:** Restoring a vaulted group reopens all its tabs and the group is removed from the vault (or preserved if duplicating).

---

## TV-006: Popup UI — Layout & Live Tab Info

**Goal:** Build the popup shell with live tab count and basic layout.

**Tasks:**
- Design popup layout in `popup.html`:
  - Header with extension name and live tab count
  - Action bar with Shutdown All / Restore buttons
  - Main area (placeholder for vault group list)
  - Footer with settings link
- Style in `popup.css` — clean, compact design suitable for a popup (400px wide, max 500px tall)
- `popup.js` queries `chrome.tabs.query({})` on load to show live tab count
- Wire up Shutdown All button to send `shutdown-all` message to service worker

**Completion Promise:** Popup opens showing correct live tab count, and clicking Shutdown All closes non-home tabs.

---

## TV-007: Popup UI — Vault Group List & Restore

**Goal:** Display vault groups in the popup with restore actions.

**Tasks:**
- On popup load, call `getVault()` and render groups as expandable cards
- Each group card shows: name, tab count, Restore Group button
- Expanding a group shows individual tabs with title, URL snippet, and individual Restore button
- Restore Group button sends `restore-group` message and refreshes the list
- Individual restore sends `restore-tabs` message and refreshes
- Empty state message when vault is empty

**Completion Promise:** Vault groups render in the popup, expanding shows tabs, and restore buttons work correctly.

---

## TV-008: Popup UI — Shutdown Selected Tabs

**Goal:** Let users pick which live tabs to vault instead of shutting down all.

**Tasks:**
- Add a "Shutdown Selected" view/mode to the popup
- Query and list all live tabs with checkboxes
- Home tabs are visually marked and unchecked by default (but still selectable)
- User enters or selects a group name for the vaulted tabs
- Confirm button sends `shutdown-tabs` message with selected tab IDs
- Confirmation step shows count of tabs about to be closed

**Completion Promise:** User can select specific tabs, assign them to a group, confirm, and those tabs are closed and appear in the vault.

---

## TV-009: Popup UI — Home Tab Management

**Goal:** Let users view and manage home tab patterns from the popup.

**Tasks:**
- Add a settings/home-tabs section accessible from the popup
- List current home tab patterns with delete buttons
- Input field + add button for new patterns
- "Add current tab" quick button that adds the active tab's URL as a pattern
- Validate pattern format before saving
- Changes take effect immediately (no restart needed)

**Completion Promise:** Users can add/remove home tab patterns from the popup, and shutdown operations immediately respect the changes.

---

## TV-010: Search & Filter Vaulted Tabs

**Goal:** Add search functionality across all vaulted tabs.

**Tasks:**
- Add a search input at the top of the vault section in the popup
- Search filters across all groups by tab title and URL (case-insensitive)
- Results show matching tabs grouped by their vault group
- Restore button works on search results
- Clear search returns to normal group view
- Debounce input (200ms) for smooth filtering

**Completion Promise:** Typing in the search box filters vaulted tabs across all groups by title/URL, and restore works from search results.

---

## TV-011: Keyboard Shortcuts

**Goal:** Add configurable keyboard shortcuts for common actions.

**Tasks:**
- Define commands in `manifest.json`:
  - `shutdown-current-tab` — vault the active tab
  - `shutdown-all-tabs` — vault all except home tabs
- Handle `chrome.commands.onCommand` in the service worker
- Prompt user for group name or use a default ("Quick Vault" + date)
- Document default shortcuts in popup footer or settings

**Completion Promise:** Keyboard shortcuts trigger shutdown of current tab or all tabs, and vaulted tabs appear in the vault.

---

## TV-012: Polish & Edge Cases

**Goal:** Handle edge cases, improve UX, and finalize for v1.

**Tasks:**
- Handle `chrome://` and `chrome-extension://` URLs (can't reopen — warn or skip)
- Handle duplicate tabs in vault (same URL vaulted multiple times is fine)
- Graceful handling of storage quota limits (warn user)
- Ensure vault data survives extension updates (`chrome.runtime.onInstalled`)
- Add favicons to vaulted tab list items where available
- Add a "Shutdown by domain" option in the popup (group live tabs by domain, one-click vault)
- Loading states for async operations
- Error toasts for failed operations

**Completion Promise:** All edge cases listed above are handled, no console errors during normal operation, and the extension feels polished and responsive.
