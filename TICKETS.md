# TICKETS: Tab Goblin v7 — Live Tabs View Improvements

Each ticket includes a **Completion Promise** — the concrete condition to verify the ticket is done.

**Previous Version:** v6 archived at `archive/TICKETS-v6-2026-02-22.md`
**PRD Reference:** `PRD.md`

---

## Phase 1: View Toggle Infrastructure

### TG7-001: Add View Toggle Setting [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.4

**Goal:** Add setting for live tabs view preference.

**Tasks:**
- Add `liveTabsView` to `DEFAULT_SETTINGS` in `settings.js`
- Default value: `'grouped'`
- Valid values: `'grouped'` | `'ungrouped'`
- Ensure setting persists across sessions

**Files to Modify:**
- `src/common/settings.js`

**Completion Promise:** `Settings.getSetting('liveTabsView')` returns `'grouped'` by default. Setting can be updated and persists.

---

### TG7-002: Create View Toggle UI [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.2

**Goal:** Add view toggle buttons to Live Tabs panel.

**Tasks:**
- Add view toggle container to `sidepanel.html` (in Live Tabs panel)
- Position above the Open Tabs section, below Home Tabs
- Create two icon buttons with radio behavior
- Grouped icon: `▦` or grid SVG
- Ungrouped icon: `☰` or list SVG
- Add `.active` class to current view button
- Wire up click handlers to switch view and save setting

**HTML Structure:**
```html
<div class="view-toggle" role="radiogroup" aria-label="View mode">
  <button class="view-toggle-btn active" data-view="grouped"
          role="radio" aria-checked="true" title="Grouped by domain">
    <span aria-hidden="true">▦</span>
  </button>
  <button class="view-toggle-btn" data-view="ungrouped"
          role="radio" aria-checked="false" title="List view">
    <span aria-hidden="true">☰</span>
  </button>
</div>
```

**Files to Modify:**
- `src/sidepanel/sidepanel.html`
- `src/sidepanel/sidepanel.js` (event handlers)

**Completion Promise:** View toggle appears in Live Tabs panel. Clicking buttons switches active state and saves setting.

---

### TG7-003: Style View Toggle [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.2

**Goal:** Style the view toggle to match the Tab Goblin design system.

**Tasks:**
- Add `.view-toggle` container styles
- Add `.view-toggle-btn` button styles
- Add `.view-toggle-btn.active` active state
- Use CSS variables for theming
- Ensure hover/focus states for accessibility

**CSS:**
```css
.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-surface);
  border-radius: 6px;
  padding: 2px;
  margin-bottom: 12px;
}

.view-toggle-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 16px;
  transition: background-color 0.15s, color 0.15s;
}

.view-toggle-btn:hover {
  color: var(--text);
}

.view-toggle-btn.active {
  background: var(--bg);
  color: var(--primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.view-toggle-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.css`

**Completion Promise:** Toggle looks good in both light and dark themes. Active state is clear. Focus states work for keyboard navigation.

---

## Phase 2: Ungrouped View Implementation

### TG7-004: Refactor renderOpenTabsList for View Modes [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.1, 1.3

**Goal:** Update render function to support both view modes.

**Tasks:**
- Read view mode setting at render time
- Extract current grouped rendering to `renderGroupedView(tabs, container)`
- Create `renderUngroupedView(tabs, container)` function
- Call appropriate function based on view mode
- Ensure view toggle updates when switching

**Code Structure:**
```javascript
async function renderOpenTabsList(tabs) {
  const container = document.getElementById('domainGroupsList');
  const viewMode = await Settings.getSetting('liveTabsView') || 'grouped';

  clearContainer(container);

  if (viewMode === 'grouped') {
    renderGroupedView(tabs, container);
  } else {
    renderUngroupedView(tabs, container);
  }

  updateViewToggleUI(viewMode);
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`

**Completion Promise:** Changing view setting causes different render function to be called. Grouped view works same as before.

---

### TG7-005: Implement Ungrouped View Rendering [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.3

**Goal:** Render tabs in a flat list sorted by domain.

**Tasks:**
- Sort tabs by domain (alphabetically), then by title
- Create flat list without accordion wrappers
- Add domain badge to each tab item
- Reuse existing tab item components where possible
- Include checkbox, favicon, title, URL, action buttons

**Tab Sorting:**
```javascript
function renderUngroupedView(tabs, container) {
  const sorted = [...tabs].sort((a, b) => {
    const domainA = UrlUtils.getDomainFromUrl(a.url) || '';
    const domainB = UrlUtils.getDomainFromUrl(b.url) || '';
    const domainCompare = domainA.localeCompare(domainB);
    if (domainCompare !== 0) return domainCompare;
    return (a.title || '').localeCompare(b.title || '');
  });

  for (const tab of sorted) {
    container.appendChild(createUngroupedTabItem(tab));
  }
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`

**Completion Promise:** Ungrouped view shows flat list of tabs. Tabs sorted by domain then title. Domain badge visible on each tab.

---

### TG7-006: Create Ungrouped Tab Item Component [DONE]

**Priority:** HIGH
**PRD Reference:** Section 1.3

**Goal:** Create tab item component for ungrouped view.

**Tasks:**
- Create `createUngroupedTabItem(tab)` function
- Include: checkbox, favicon, title (truncated), domain badge, actions
- Actions: Protect button, Vault button, Close button
- Wire checkbox to `selectedTabIds` tracking
- Match styling with grouped view tab items

**HTML Structure:**
```html
<div class="ungrouped-tab-item">
  <input type="checkbox" class="tab-checkbox">
  <img class="tab-favicon">
  <div class="tab-info">
    <div class="tab-title">Page Title</div>
    <div class="tab-domain">example.com</div>
  </div>
  <div class="tab-actions">
    <button class="protect-btn">Shield</button>
    <button class="vault-btn">Vault</button>
    <button class="close-btn">X</button>
  </div>
</div>
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.css` (ungrouped item styles)

**Completion Promise:** Ungrouped tab items display with all expected elements. Checkboxes work. Action buttons work.

---

### TG7-007: Style Ungrouped Tab Items [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 1.3

**Goal:** Style ungrouped tab items to match design system.

**Tasks:**
- Style `.ungrouped-tab-item` container
- Style domain badge (small, muted text)
- Ensure consistent spacing with grouped items
- Add hover and selected states
- Support both light and dark themes

**Files to Modify:**
- `src/sidepanel/sidepanel.css`

**Completion Promise:** Ungrouped items look consistent with grouped view. Domain badge is visible but not prominent. Hover and selection states work.

---

## Phase 3: Button State Management

### TG7-008: Disable Vault Selected When Empty [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.2

**Goal:** Disable "Vault Selected" button when no tabs are selected.

**Tasks:**
- Add `disabled` attribute management to button
- Update button state in `updateSelectedCount()` function
- Set initial state to disabled on render
- Enable when `selectedTabIds.size > 0`
- Style disabled state

**Code:**
```javascript
function updateSelectedCount() {
  const count = selectedTabIds.size;
  document.getElementById('selectedCount').textContent = `${count} selected`;

  const vaultSelectedBtn = document.getElementById('vaultSelectedBtn');
  vaultSelectedBtn.disabled = count === 0;
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.css` (disabled button styles)

**Completion Promise:** "Vault Selected" button is disabled when 0 tabs selected. Enabled when any tab selected. Visual disabled state is clear.

---

### TG7-009: Disable Domain Vault Button When Empty [DONE]

**Priority:** HIGH
**PRD Reference:** Section 2.2

**Goal:** Disable domain "Vault" button when no tabs selected in that group.

**Tasks:**
- Add class to domain vault button for selection (e.g., `.domain-vault-btn`)
- Create `updateDomainVaultButton(groupCard)` function
- Check if any tabs in group are selected
- Disable button if none selected, enable if any selected
- Call on checkbox change events
- Call on initial render

**Code:**
```javascript
function updateDomainVaultButton(groupCard) {
  const vaultBtn = groupCard.querySelector('.domain-vault-btn');
  const anySelected = Array.from(groupCard.querySelectorAll('.domain-tab-checkbox'))
    .some(cb => cb.checked);
  vaultBtn.disabled = !anySelected;
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js`

**Completion Promise:** Domain "Vault" buttons are disabled by default. Enable when any tab in that group is selected.

---

### TG7-010: Style Disabled Buttons [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 2.3

**Goal:** Ensure disabled buttons have clear visual indicator.

**Tasks:**
- Add `.btn:disabled` styles
- Reduce opacity
- Change cursor to `not-allowed`
- Test in both light and dark themes

**CSS:**
```css
.btn:disabled,
.btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.css`

**Completion Promise:** Disabled buttons are visually distinct. Cursor shows they're not clickable. Works in all themes.

---

## Phase 4: Selection Behavior Verification

### TG7-011: Verify Group Checkbox Behavior [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 2.1

**Goal:** Verify and document that group checkbox selects all tabs.

**Current Behavior (verify still works):**
- Group checkbox checked → all child checkboxes checked
- Group checkbox unchecked → all child checkboxes unchecked
- Some children checked → group checkbox shows indeterminate

**Tasks:**
- Test group checkbox behavior manually
- Verify `updateDomainGroupCheckbox` function works correctly
- Ensure checkbox state syncs with `selectedTabIds`
- Fix any issues discovered

**Test Cases:**
- [ ] Check group checkbox → all tabs selected, count updates
- [ ] Uncheck group checkbox → all tabs deselected, count updates
- [ ] Check some tabs → group shows indeterminate
- [ ] Check all tabs manually → group checkbox becomes checked

**Files to Modify:**
- `src/sidepanel/sidepanel.js` (if fixes needed)

**Completion Promise:** Group checkbox selects/deselects all tabs. Indeterminate state shows for partial selection.

---

### TG7-012: Multi-Group Selection Test [DONE]

**Priority:** MEDIUM
**PRD Reference:** Section 3.2

**Goal:** Verify vaulting tabs from multiple groups works.

**Test Steps:**
1. Open tabs from 3+ different domains
2. Select group A checkbox (all A tabs)
3. Select group B checkbox (all B tabs)
4. Click "Vault Selected"
5. Verify: A and B tabs vaulted as separate groups in vault

**Tasks:**
- Test manually
- Fix any issues discovered
- Document expected behavior

**Completion Promise:** Selecting multiple group checkboxes and clicking "Vault Selected" creates separate vault groups per domain.

---

## Phase 5: Polish and Testing

### TG7-013: View Toggle Keyboard Navigation [DONE]

**Priority:** MEDIUM

**Goal:** Ensure view toggle is keyboard accessible.

**Tasks:**
- Verify arrow keys switch between toggle buttons
- Verify Enter/Space activates buttons
- Verify focus indicators are visible
- Add proper ARIA attributes

**ARIA Requirements:**
- `role="radiogroup"` on container
- `role="radio"` on buttons
- `aria-checked="true/false"` updated on toggle

**Files to Modify:**
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.html`

**Completion Promise:** View toggle is fully keyboard navigable. Screen readers announce state correctly.

---

### TG7-014: Integration Testing [DONE]

**Priority:** HIGH

**Goal:** Test all features work together.

**Test Matrix:**

| Scenario | Expected Result |
|----------|-----------------|
| Switch to ungrouped, select tabs, vault | Tabs vaulted, correct groups created |
| Switch back to grouped, verify selection | Selection cleared on view change |
| Grouped: select group, vault | All group tabs vaulted |
| Ungrouped: select multiple domains' tabs | Vaulted as separate domain groups |
| No selection, both buttons disabled | Vault buttons disabled |
| Select 1 tab, buttons enabled | Vault Selected and domain Vault enabled |

**Completion Promise:** All test scenarios pass. No regressions from v6.

---

### TG7-015: Code Cleanup [DONE]

**Priority:** LOW

**Goal:** Clean up code and remove any debug statements.

**Tasks:**
- Remove any `console.log` debug statements
- Ensure consistent code style
- Add comments for complex logic
- Verify no unused code

**Completion Promise:** No debug statements in production code. Code is clean and consistent.

---

## Summary by Priority

| Priority | Tickets | Description |
|----------|---------|-------------|
| HIGH | TG7-001 to TG7-006, TG7-008, TG7-009, TG7-014 | Core features, button states, testing |
| MEDIUM | TG7-007, TG7-010 to TG7-013 | Styling, verification, accessibility |
| LOW | TG7-015 | Code cleanup |

---

## Dependency Graph

```
TG7-001 (setting) ─┬─► TG7-002 (toggle UI) → TG7-003 (toggle styles)
                   │
                   └─► TG7-004 (refactor) → TG7-005 (ungrouped render) → TG7-006 (tab item) → TG7-007 (item styles)

TG7-008 (vault selected disabled) ─┐
TG7-009 (domain vault disabled) ───┼─► TG7-010 (disabled styles)
                                   │
TG7-011 (group checkbox verify) ───┴─► TG7-012 (multi-group test)

TG7-002 → TG7-013 (keyboard nav)

All → TG7-014 (integration test) → TG7-015 (cleanup)
```

---

## Recommended Order

1. **TG7-001** — Add view toggle setting
2. **TG7-002** — Create view toggle UI
3. **TG7-003** — Style view toggle
4. **TG7-004** — Refactor render for view modes
5. **TG7-005** — Implement ungrouped rendering
6. **TG7-006** — Create ungrouped tab item
7. **TG7-007** — Style ungrouped items
8. **TG7-008** — Disable Vault Selected when empty
9. **TG7-009** — Disable domain Vault when empty
10. **TG7-010** — Style disabled buttons
11. **TG7-011** — Verify group checkbox behavior
12. **TG7-012** — Test multi-group selection
13. **TG7-013** — View toggle keyboard nav
14. **TG7-014** — Integration testing
15. **TG7-015** — Code cleanup
