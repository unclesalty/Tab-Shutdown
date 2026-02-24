# PRD: Tab Goblin v7 — Live Tabs View Improvements

## Overview

**Tab Goblin** is a Chrome extension that solves RAM/CPU drain from too many tabs while preserving them as workflow aids. Tabs are either live (open) or vaulted (fully closed and saved). No suspension, no halfway — closed is closed.

## v7 Goals

This release improves the **Live Tabs panel** with better view options and fixes selection/vault button behavior:

1. **View Toggle** — Switch between grouped and ungrouped views of live tabs
2. **Selection Behavior** — Fix group checkbox and vault button interactions
3. **Button State Management** — Disable vault buttons until tabs are selected

---

## Problem Statement

**View Flexibility:**
- Users may prefer to see all tabs in a flat list rather than grouped by domain
- The grouped view works well for domain-focused workflows but not for scanning all tabs quickly
- No way to toggle between views

**Selection & Vault Button Issues:**
- Domain "Vault" button behavior is unclear when nothing is selected
- "Vault Selected" button at the bottom is always enabled even when no tabs are selected
- Users expect disabled buttons to indicate "nothing to do"

---

## Feature 1: Live Tabs View Toggle

### 1.1 View Options

**Requirement:** Add toggle to switch between grouped and ungrouped views.

**View Modes:**
| Mode | Description |
|------|-------------|
| **Grouped** (default) | Tabs organized in collapsible domain accordions |
| **Ungrouped** | Flat list of all tabs, sorted by domain for visual grouping |

### 1.2 Toggle UI

**Location:** Live Tabs panel, above the tabs list (below search)

**Implementation:**
- Two icon buttons in a toggle group (radio behavior)
- Icons: Grid/grouped icon + List icon
- Visual indicator for active state
- Persist preference to settings

**HTML Structure:**
```html
<div class="view-toggle">
  <button class="view-toggle-btn active" data-view="grouped" title="Grouped view">
    <!-- Grid icon -->
  </button>
  <button class="view-toggle-btn" data-view="ungrouped" title="List view">
    <!-- List icon -->
  </button>
</div>
```

### 1.3 Ungrouped View Behavior

**Tab Sorting:**
- Sort by domain (alphabetically), then by title within domain
- Tabs from the same domain appear consecutively (visual grouping without accordions)
- Include subtle domain separator or domain badge on each tab

**Tab Item Display:**
- Same tab item component as grouped view
- Add domain badge/label to each tab item
- Checkbox for selection
- Same action buttons (Protect, Vault, Close)

### 1.4 Settings Persistence

**Setting Key:** `liveTabsView`
**Values:** `'grouped'` | `'ungrouped'`
**Default:** `'grouped'`

---

## Feature 2: Selection Behavior Fixes

### 2.1 Group Checkbox Behavior

**Requirement:** Group checkbox should select/deselect all items in the group.

**Current Behavior:** This already works correctly in the code.

**Expected Behavior:**
- Checking group checkbox → all tabs in group become selected
- Unchecking group checkbox → all tabs in group become deselected
- Mixed selection → group checkbox shows indeterminate state

### 2.2 Vault Button States

**Requirement:** Vault buttons should be disabled until tabs are selected.

**Domain "Vault" Button:**
| State | Button |
|-------|--------|
| Nothing selected in group | Disabled |
| Some/all tabs selected | Enabled |

**"Vault Selected" Button (bottom):**
| State | Button |
|-------|--------|
| No tabs selected anywhere | Disabled |
| Any tabs selected | Enabled |

### 2.3 Visual Disabled State

```css
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## Feature 3: Multi-Group Vaulting

### 3.1 Vault Selected Across Groups

**Requirement:** "Vault Selected" should handle tabs from multiple domain groups.

**Current Behavior:** Already works — `shutdown-tabs-by-domain` groups selected tabs by domain.

**Expected Behavior:**
- Select tabs from multiple domains
- Click "Vault Selected"
- Each domain gets its own vault group

### 3.2 Vault Multiple Groups at Once

**Requirement:** Selecting multiple group checkboxes should vault all those groups.

**Behavior:**
- Select group A checkbox (all A tabs selected)
- Select group B checkbox (all B tabs selected)
- Click "Vault Selected" → vaults A and B as separate groups

---

## UI Specifications

### Live Tabs Panel Layout (Updated)

```
Live Tabs
─────────────────────────────
[Search open tabs...]

[View: ▣ Grouped | ☰ List]

Home Tabs (3)
  [Home tab items...]

Open Tabs (15)
  [Domain groups or flat list based on view]

─────────────────────────────
[X selected]  [Vault Selected]
```

### View Toggle Styling

```css
.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--bg-surface);
  border-radius: 6px;
  padding: 2px;
}

.view-toggle-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
}

.view-toggle-btn.active {
  background: var(--bg);
  color: var(--primary);
}
```

### Icon Options

**Grouped View Icon:**
- Unicode: `⊞` (U+229E) or `▦` (U+25A6)
- Or SVG grid icon

**Ungrouped View Icon:**
- Unicode: `☰` (U+2630) hamburger menu
- Or `≡` (U+2261) identical to
- Or SVG list icon

---

## Technical Notes

### Settings Update

Add to `DEFAULT_SETTINGS`:
```javascript
{
  // ... existing
  liveTabsView: 'grouped'
}
```

### Render Logic

```javascript
async function renderOpenTabsList(tabs) {
  const viewMode = await Settings.getSetting('liveTabsView') || 'grouped';

  if (viewMode === 'grouped') {
    renderGroupedView(tabs);
  } else {
    renderUngroupedView(tabs);
  }
}

function renderUngroupedView(tabs) {
  // Sort by domain, then by title
  const sorted = [...tabs].sort((a, b) => {
    const domainA = UrlUtils.getDomainFromUrl(a.url);
    const domainB = UrlUtils.getDomainFromUrl(b.url);
    if (domainA !== domainB) return domainA.localeCompare(domainB);
    return a.title.localeCompare(b.title);
  });

  // Render flat list with domain badges
  for (const tab of sorted) {
    container.appendChild(createUngroupedTabItem(tab));
  }
}
```

### Button State Management

```javascript
function updateVaultButtonStates() {
  const vaultSelectedBtn = document.getElementById('vaultSelectedBtn');
  vaultSelectedBtn.disabled = selectedTabIds.size === 0;

  // Update domain vault buttons
  document.querySelectorAll('.domain-group-card').forEach(card => {
    const vaultBtn = card.querySelector('.domain-vault-btn');
    const hasSelectedTabs = Array.from(card.querySelectorAll('.domain-tab-checkbox'))
      .some(cb => cb.checked);
    vaultBtn.disabled = !hasSelectedTabs;
  });
}
```

---

## Non-Goals (v7)

- Tab sorting options (by title, by most recently used, etc.)
- Tab filtering by other criteria
- Batch close without vaulting
- Drag-and-drop reordering of live tabs

---

## Success Criteria

- [ ] View toggle appears in Live Tabs panel
- [ ] Grouped view shows domain accordions (current behavior)
- [ ] Ungrouped view shows flat list sorted by domain
- [ ] View preference persists across sessions
- [ ] "Vault Selected" button disabled when nothing selected
- [ ] Domain "Vault" button disabled when no tabs selected in that group
- [ ] Selecting group checkbox selects all tabs in group
- [ ] Can vault tabs from multiple groups with single "Vault Selected" click

---

## File Structure Impact

```
src/
├── common/
│   └── settings.js          # Add liveTabsView setting
├── sidepanel/
│   ├── sidepanel.js        # View toggle, ungrouped rendering, button states
│   ├── sidepanel.css       # View toggle styles, disabled button styles
│   └── sidepanel.html      # View toggle HTML
```

---

## References

- **v6 PRD (archived):** `archive/PRD-v6-2026-02-22.md`
- **v6 TICKETS (archived):** `archive/TICKETS-v6-2026-02-22.md`
