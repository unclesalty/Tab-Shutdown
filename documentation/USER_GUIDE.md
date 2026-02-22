# User Guide

Complete guide to using Tab Goblin effectively.

## Table of Contents

1. [Concepts](#concepts)
2. [The Popup Interface](#the-popup-interface)
3. [Vaulting Tabs](#vaulting-tabs)
4. [Restoring Tabs](#restoring-tabs)
5. [Managing Groups](#managing-groups)
6. [Home Tabs](#home-tabs)
7. [Searching](#searching)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Tips & Best Practices](#tips--best-practices)

---

## Concepts

### Tab States

In Tab Goblin, a tab exists in one of two states:

| State | Description | Resource Usage |
|-------|-------------|----------------|
| **Live** | Open in browser | Uses RAM/CPU |
| **Vaulted** | Closed, saved in vault | Zero resources |

There's no middle ground. Vaulted tabs are completely closed — not suspended, not discarded. This is what actually frees your system resources.

### Groups

Vaulted tabs are organized into **groups**:
- Each group has a name (e.g., "Work Research", "Shopping", "github.com")
- Groups contain one or more tabs
- Groups can be renamed, reordered, and deleted
- All groups persist across browser restarts

### Home Tabs

Home tabs are **protected** tabs that are never vaulted:
- They're excluded from "Shutdown All" operations
- Perfect for Gmail, Calendar, or any always-open pages
- Configured using URL patterns

---

## The Popup Interface

Click the Tab Goblin icon to open the main interface.

### Header

- **Tab Goblin** — Extension name
- **X tabs open** — Current count of open browser tabs

### Action Bar

- **Shutdown All** — Vault all tabs (except home tabs)
- **Select Tabs** — Choose specific tabs to vault
- **...** — Shutdown by domain (group tabs by website)

### Vault Groups

The main area shows your vaulted tab groups:
- Click a group header to expand/collapse
- **Restore** — Opens all tabs and removes group from vault
- **Copy** — Opens all tabs but keeps them in vault
- **⋮** — Menu with Rename, Delete, Move options

### Search

Type in the search box to filter tabs across all groups.

### Footer

- **Settings** — Configure home tab patterns

---

## Vaulting Tabs

### Shutdown All

Quickly vault every open tab (except home tabs):

1. Click the Tab Goblin icon
2. Click **Shutdown All**
3. Confirm the action
4. All non-home tabs close and appear in the vault

The group is named "All Tabs - [date]" by default.

### Shutdown Selected

Choose exactly which tabs to vault:

1. Click **Select Tabs**
2. Check/uncheck tabs to include
3. Optionally name the group
4. Optionally check "Auto-group by domain"
5. Click **Shutdown Selected**

Tips:
- Home tabs are pre-unchecked but can still be selected
- Click a row to toggle its checkbox
- Use "Auto-group by domain" to organize by website

### Shutdown by Domain

Vault all tabs from a specific website:

1. Click the **...** button in the action bar
2. See all domains with open tabs
3. Click **Vault** next to a domain
4. All tabs from that domain are vaulted

Example: Click "Vault" next to "github.com" to close all GitHub tabs at once.

### Keyboard Shortcut Vaulting

For quick vaulting without opening the popup:

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+V` | Vault the current tab only |
| `Alt+Shift+A` | Vault all tabs (except home tabs) |

Tabs vaulted via keyboard go into a "Quick Vault - [date]" group.

---

## Restoring Tabs

### Restore an Entire Group

1. Find the group in the vault list
2. Click **Restore**
3. All tabs open in new tabs
4. The group is removed from the vault

### Restore Individual Tabs

1. Click a group header to expand it
2. Find the specific tab
3. Click **Restore** next to it
4. That tab opens, others remain vaulted

### Copy (Open Without Removing)

Sometimes you want to open tabs but keep them in the vault:

- **Copy** (on group) — Opens all tabs, keeps group in vault
- **Copy** (on tab) — Opens that tab, keeps it in vault

Use cases:
- Reference material you access frequently
- Template tabs for recurring workflows
- Tabs you want to keep as bookmarks

### Large Group Warning

When restoring a group with 10+ tabs, you'll see a confirmation:
- This prevents accidentally flooding your browser
- You can disable this in the future (checkbox option)

---

## Managing Groups

### Rename a Group

1. Click the **⋮** menu on a group
2. Select **Rename**
3. Enter the new name
4. Press Enter or click OK

### Delete a Group

1. Click the **⋮** menu on a group
2. Select **Delete**
3. Confirm the deletion

**Warning**: Deleting a group permanently removes all tabs in it.

### Reorder Groups

1. Click the **⋮** menu on a group
2. Select **Move Up** or **Move Down**
3. The group moves in the list

Groups maintain their order across sessions.

### Empty Groups

When you restore all tabs from a group, the group is automatically removed. No need to clean up manually.

---

## Home Tabs

Home tabs are protected from vaulting. Perfect for:
- Email (Gmail, Outlook)
- Calendar
- Communication tools (Slack, Teams)
- Development servers (localhost)

### Adding Home Tabs

**Method 1: Add Current Tab**
1. Navigate to the page you want protected
2. Open Tab Goblin popup
3. Click **Settings**
4. Click **Add Current Tab**

**Method 2: Add URL Pattern**
1. Open Tab Goblin popup
2. Click **Settings**
3. Type a URL pattern
4. Click **Add**

### URL Pattern Syntax

Patterns use `*` as a wildcard:

| Pattern | Matches |
|---------|---------|
| `*://mail.google.com/*` | All Gmail pages (http and https) |
| `https://calendar.google.com/*` | Google Calendar (https only) |
| `*://localhost:*/*` | Any localhost with any port |
| `https://github.com/myorg/*` | Specific GitHub organization |
| `*://*.slack.com/*` | All Slack workspaces |

### Removing Home Tab Patterns

1. Open Tab Goblin popup
2. Click **Settings**
3. Find the pattern
4. Click the **×** button next to it

### Home Tab Indicators

In the "Select Tabs" view:
- Home tabs have a yellow **HOME** badge
- Home tabs are unchecked by default
- You can still select and vault them if you choose

---

## Searching

### Basic Search

1. Open the Tab Goblin popup
2. Type in the search box
3. Results filter in real-time

Search looks at:
- Tab titles
- Tab URLs

### Search Results

- Matching tabs are grouped by their vault group
- Groups auto-expand to show results
- "X results found" shows total matches
- Click **Clear search** to reset

### Search Tips

- Search is case-insensitive
- Partial matches work (e.g., "git" finds "github.com")
- Search across all groups simultaneously

---

## Keyboard Shortcuts

### Default Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+V` | Vault current tab |
| `Alt+Shift+A` | Vault all tabs |

### Customizing Shortcuts

1. Go to `chrome://extensions/shortcuts`
2. Find "Tab Goblin"
3. Click the pencil icon next to a command
4. Press your new key combination
5. Click OK

### Shortcut Conflicts

If a shortcut doesn't work:
- Check if another extension uses it
- Some system shortcuts take priority
- Try a different combination

---

## Tips & Best Practices

### Workflow: End of Day Cleanup

1. Press `Alt+Shift+A` to vault everything
2. Home tabs (email, calendar) stay open
3. Tomorrow, review the vault and restore what you need

### Workflow: Context Switching

When switching between projects:
1. Click **Select Tabs**
2. Select all tabs for the current project
3. Name the group (e.g., "Project Alpha - Sprint 3")
4. Click **Shutdown Selected**
5. Restore when you return to that project

### Workflow: Research Sessions

While researching a topic:
1. Open many reference tabs
2. When done, click **...** button
3. Use "Shutdown by Domain" to organize automatically
4. Related sites are grouped together

### Organizing Tips

- **Use descriptive group names** — "GitHub PRs to Review" is better than "Tabs"
- **Vault by domain** for automatic organization
- **Keep vault tidy** — Delete groups you no longer need
- **Use Home Tabs** for always-open essentials

### Performance Tips

- **Vault aggressively** — Each closed tab frees ~50-300MB of RAM
- **Vault before meetings** — Quick way to focus
- **Don't hoard in vault** — Periodically clean up old groups

### Data Safety

- Vault data persists across browser restarts
- Vault survives extension updates
- For extra safety, periodically export:
  ```javascript
  // In browser console
  chrome.storage.local.get('vault', d => console.log(JSON.stringify(d)))
  ```

---

## Frequently Asked Questions

### Can I recover a deleted group?

No. Once deleted, a group is permanently removed. Consider using "Copy" instead of "Restore" if you want to keep tabs in the vault.

### Does Tab Goblin sync across devices?

Not currently. Vault data is stored locally on each device.

### What happens to pinned tabs?

Pinned tabs are treated like any other tab. They will be vaulted unless protected by a home tab pattern.

### Can I vault incognito tabs?

Extensions typically don't have access to incognito windows unless explicitly allowed in `chrome://extensions`.

### Is my data private?

Yes. Tab Goblin stores everything locally in your browser. No data is sent to external servers.

### How much space does the vault use?

Minimal. Each tab stores only URL, title, and favicon URL — typically under 1KB per tab. Chrome's local storage limit is 5MB, enough for thousands of tabs.
