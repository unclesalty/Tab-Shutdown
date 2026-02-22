# TICKETS: Tab Goblin v3 — Theme System, Navigation & Bug Fixes

Each ticket includes a **Completion Promise** — the concrete condition to verify the ticket is done.

**Previous Version:** v2 archived at `archive/TICKETS-v2-2026-02-22.md`

---

## [DONE] TG3-001: Fix Live Tabs Panel Not Displaying Tabs

**Goal:** Resolve the bug where Live Tabs panel shows 0 tabs while the status bar shows the correct count (e.g., 43).

**Investigation:**
- Status bar uses `chrome.tabs.query({})` which returns all tabs correctly
- Live Tabs panel uses same query but filters with `isSkippableUrl()`
- `isSkippableUrl()` returns `true` when `!url` — if tabs lack URL property, all are skipped
- Chrome may not provide `url` property without proper permission handling

**Tasks:**
- Add debug logging to `renderLiveTabsPanel()` to inspect tab objects
- Check if `tab.url` is undefined for any tabs returned by `chrome.tabs.query({})`
- Verify the `tabs` permission grants URL access in side panel context
- Modify `isSkippableUrl()` to handle undefined URL gracefully (skip silently, don't filter all)
- Consider querying with explicit URL patterns: `chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })`
- Test with various tab types (normal, pinned, grouped, etc.)
- Remove debug logging after fix confirmed

**Technical Notes:**
```javascript
// Current problematic code
function isSkippableUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
}

// If url is undefined, ALL tabs are skipped
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js` — Fix `renderLiveTabsPanel()` and `isSkippableUrl()`

**Completion Promise:** Live Tabs panel displays all open browser tabs (excluding chrome:// and extension pages). The count in "Open Tabs" badge matches the actual number of displayable tabs. Status bar count matches query results.

---

## [DONE] TG3-002: Rebrand to Tab Goblin

**Goal:** Update all references from "Tab Vault" to "Tab Goblin" throughout the codebase.

**Tasks:**
- Update `manifest.json`:
  - `"name": "Tab Goblin"`
  - `"description":` Update if needed
- Update `src/sidepanel/sidepanel.html`:
  - `<title>Tab Goblin</title>`
  - Remove header title text (see TG3-004)
- Update onboarding text in `sidepanel.js`:
  - "Welcome to Tab Goblin!"
- Update all documentation:
  - `README.md`
  - `documentation/USER_GUIDE.md`
  - `documentation/DEVELOPER_GUIDE.md`
  - `documentation/CONTRIBUTING.md`
  - `documentation/INSTALLATION.md`
- Update `CLAUDE.md` project description

**Files to Modify:**
- `manifest.json`
- `src/sidepanel/sidepanel.html`
- `src/sidepanel/sidepanel.js`
- `README.md`
- `CLAUDE.md`
- `documentation/*.md`

**Completion Promise:** All user-visible text and documentation references "Tab Goblin" instead of "Tab Vault". The extension name in Chrome shows "Tab Goblin".

---

## [DONE] TG3-003: Remove Emojis from UI

**Goal:** Replace all emoji characters with text labels or semantic alternatives.

**Tasks:**
- **Home Tabs Section:**
  - Remove house emoji (`&#127968;` / `🏠`) from home tabs header
  - Replace with text "Home Tabs" only (icon to be added later)
- **Expand/Collapse Arrows:**
  - Keep Unicode arrows (`▶` `▼`) — these are symbols, not emojis
- **Pin to Home Button:**
  - Remove house emoji from button
  - Use text "Protect" or icon placeholder
- **Unprotect Button:**
  - Keep `×` (multiplication sign) — this is a symbol, not emoji
- **Review all JS files for emoji usage:**
  - `sidepanel.js` — check toast messages, button text
  - Check for any `\u{1F...}` Unicode escape sequences

**Affected Elements:**
```html
<!-- Current -->
<span class="home-tabs-icon" aria-hidden="true">&#127968;</span>

<!-- Updated -->
<span class="home-tabs-icon" aria-hidden="true"></span> <!-- Empty, style with CSS later -->
```

```javascript
// Current
pinBtn.textContent = '\u{1F3E0}'; // House emoji

// Updated
pinBtn.textContent = 'Protect';
pinBtn.className = 'protect-btn';
```

**Files to Modify:**
- `src/sidepanel/sidepanel.html`
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.css` (update button styles)

**Completion Promise:** No emoji characters appear in the UI. All interactive elements use text labels or Unicode symbols. Visual scanning of the extension shows no emoji.

---

## [DONE] TG3-004: Simplify Header Design

**Goal:** Remove the blue header banner and integrate "Shutdown All" button into a cleaner layout.

**Tasks:**
- Remove `.header` blue background styling
- Remove "Tab Vault" / "Tab Goblin" title from header
- Keep "Shutdown All" button, restyle to match new design
- Position button appropriately (top-right of panel or integrated with tab bar)
- Ensure header background matches main content background
- Update CSS to use theme variables (for future theme support)

**Current Structure:**
```html
<header class="header">
  <h1 class="header-title">Tab Vault</h1>
  <div class="header-actions">
    <button id="shutdownAllBtn">Shutdown All</button>
  </div>
</header>
```

**New Structure:**
```html
<header class="header">
  <div class="header-actions">
    <button id="shutdownAllBtn" class="btn btn-danger">Shutdown All</button>
  </div>
</header>
```

**CSS Changes:**
```css
/* Remove */
.header {
  background: #4A90D9;  /* Remove blue background */
  color: #fff;          /* Remove white text */
}

/* Update */
.header {
  background: var(--bg);  /* Match content background */
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;  /* Align button right */
}
```

**Files to Modify:**
- `src/sidepanel/sidepanel.html`
- `src/sidepanel/sidepanel.css`

**Completion Promise:** The header area has no colored banner. "Shutdown All" button is visible and accessible. The top of the panel has a clean, minimal appearance matching the content area background.

---

## [DONE] TG3-005: Create Theme System Infrastructure

**Goal:** Set up the foundation for the theme system with CSS custom properties and settings storage.

**Tasks:**
- Create `src/common/themes.js` with theme definitions:
  ```javascript
  const THEMES = {
    'midnight-glass': {
      name: 'Midnight Glass',
      type: 'dark',
      colors: {
        bg: '#0f172a',
        bgSurface: '#1e293b',
        primary: '#0ea5e9',
        accent: '#7dd3fc',
        text: '#e2e8f0',
        textSecondary: '#64748b',
        // ... etc
      }
    },
    // ... other themes
  };
  ```
- Update `src/common/settings.js` to include theme settings:
  - `themeMode`: 'system' | 'light' | 'dark' | 'custom'
  - `themePalette`: theme key string
- Create base CSS custom properties in `sidepanel.css`:
  - Define all variables with light mode defaults
  - Add `@media (prefers-color-scheme: dark)` for system dark mode
- Add `data-theme` attribute handling in `sidepanel.js`:
  - `applyTheme()` function
  - `initTheme()` on load
  - Listen for system preference changes

**Theme Variable List:**
| Variable | Light Default | Purpose |
|----------|---------------|---------|
| `--bg` | `#ffffff` | Main background |
| `--bg-surface` | `#f9f9f9` | Card backgrounds |
| `--bg-hover` | `#f5f5f5` | Hover states |
| `--primary` | `#4A90D9` | Primary buttons |
| `--primary-hover` | `#3a7bc8` | Button hover |
| `--accent` | `#4A90D9` | Active/selected |
| `--text` | `#333333` | Primary text |
| `--text-secondary` | `#666666` | Muted text |
| `--text-on-primary` | `#ffffff` | Text on primary bg |
| `--border` | `#e0e0e0` | Borders |
| `--success` | `#28a745` | Success states |
| `--error` | `#dc3545` | Error/danger |
| `--warning` | `#ffc107` | Warning (home tabs) |

**Files to Create:**
- `src/common/themes.js`

**Files to Modify:**
- `src/common/settings.js`
- `src/sidepanel/sidepanel.css`
- `src/sidepanel/sidepanel.js`
- `src/sidepanel/sidepanel.html` (add script)

**Completion Promise:** CSS custom properties are defined for all colors. The `themes.js` module exports theme definitions. Settings can store theme preferences. The `applyTheme()` function can set `data-theme` attribute.

---

## [DONE] TG3-006: Implement Light Mode Theme

**Goal:** Create a polished light mode theme as the default.

**Tasks:**
- Define complete light mode color values in CSS `:root`
- Ensure all elements use CSS variables (no hardcoded colors)
- Audit all components for light mode appearance:
  - Header and tab bar
  - Vault groups and tab items
  - Home tabs section (warning yellow background)
  - Open tabs section
  - Settings panel
  - Confirmation dialogs
  - Toast notifications
  - Dropdown menus
  - Search input
  - Buttons (primary, secondary, danger, link)
- Verify text contrast meets WCAG AA (4.5:1)
- Test focus states are visible

**Components to Audit:**

| Component | Background Var | Text Var | Border Var |
|-----------|----------------|----------|------------|
| Body | `--bg` | `--text` | — |
| Tab bar | `--bg-surface` | `--text` | `--border` |
| Tab button active | `--bg` | `--accent` | `--accent` |
| Group card | `--bg` | `--text` | `--border` |
| Group header hover | `--bg-hover` | — | — |
| Tab item | `--bg-surface` | `--text` | `--border` |
| Home section | `--warning` (10% opacity) | `--text` | `--warning` |
| Primary button | `--primary` | `--text-on-primary` | — |
| Toast success | `--success` | `#fff` | — |
| Toast error | `--error` | `#fff` | — |

**Files to Modify:**
- `src/sidepanel/sidepanel.css` — convert all hardcoded colors to variables

**Completion Promise:** All UI elements use CSS custom properties. Light mode is visually polished and readable. No hardcoded color values remain in CSS (except in theme definitions).

---

## [DONE] TG3-007: Implement Dark Mode Themes

**Goal:** Create all five dark mode theme palettes.

**Tasks:**
- Add CSS rules for each theme via `[data-theme="..."]` selector:
  1. **Midnight Glass** (midnight-glass)
  2. **Neon Ember** (neon-ember)
  3. **Soft Lavender** (soft-lavender)
  4. **Arctic Mint** (arctic-mint)
  5. **Slate Minimal** (slate-minimal)

**Theme Color Values (from palettes.html):**

| Theme | BG | Surface | Primary | Accent | Muted |
|-------|-----|---------|---------|--------|-------|
| Midnight Glass | #0F172A | #1E293B | #0EA5E9 | #7DD3FC | #64748B |
| Neon Ember | #0C0A09 | #292524 | #F97316 | #FB923C | #78716C |
| Soft Lavender | #13111F | #2E2A45 | #8B5CF6 | #C4B5FD | #6B6591 |
| Arctic Mint | #091415 | #1A2E30 | #10B981 | #6EE7B7 | #5E8A7A |
| Slate Minimal | #09090B | #27272A | #6366F1 | #A5B4FC | #71717A |

**Additional Variables per Theme:**
- `--text`: Light color for dark backgrounds (~#E0E0E0 adjusted per theme)
- `--text-secondary`: Muted color
- `--text-on-primary`: Text color on primary buttons
- `--border`: Subtle borders
- `--success`, `--error`, `--warning`: Semantic colors

**Files to Modify:**
- `src/sidepanel/sidepanel.css`
- `src/common/themes.js`

**Completion Promise:** All five dark themes are defined in CSS. Selecting any theme via `data-theme` attribute renders the UI in that color scheme. Text is readable on all backgrounds.

---

## [DONE] TG3-008: Implement System Theme Mode

**Goal:** Make "System" the default theme mode that follows OS light/dark preference.

**Tasks:**
- Add `@media (prefers-color-scheme: dark)` CSS rules
- When `themeMode === 'system'`:
  - Remove `data-theme` attribute from root
  - Let CSS media query handle light/dark switching
- Define default dark mode colors in media query (use Slate Minimal as default)
- Add JavaScript listener for `prefers-color-scheme` changes:
  ```javascript
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
  ```
- Ensure smooth transition when system preference changes

**CSS Structure:**
```css
/* Light mode defaults (no data-theme) */
:root {
  --bg: #ffffff;
  /* ... light colors */
}

/* System dark mode */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg: #09090b;
    /* ... Slate Minimal colors as default dark */
  }
}

/* Explicit theme overrides take precedence */
[data-theme="midnight-glass"] { /* ... */ }
```

**Files to Modify:**
- `src/sidepanel/sidepanel.css`
- `src/sidepanel/sidepanel.js`

**Completion Promise:** With no theme selected (system mode), the extension follows OS preference. Changing OS from light to dark mode updates the extension immediately. The default dark mode uses Slate Minimal colors.

---

## [DONE] TG3-009: Add Theme Selector to Settings Panel

**Goal:** Create UI in Settings panel for users to select their preferred theme.

**Tasks:**
- Add "Appearance" section to Settings panel above "Home Tab Patterns"
- Create theme mode selector:
  - Radio buttons or segmented control: System | Light | Dark | Custom
- Create theme palette selector (shown only when mode is "Custom" or "Dark"):
  - Visual swatches or dropdown with theme names
  - Show mini preview of each palette
- Wire up change handlers:
  - On mode change: save to settings, apply theme
  - On palette change: save to settings, apply theme
- Load current settings on panel render

**HTML Structure:**
```html
<section class="settings-section">
  <h2 class="settings-section-title">Appearance</h2>

  <div class="theme-mode-selector">
    <label class="theme-mode-option">
      <input type="radio" name="themeMode" value="system" checked>
      <span>System</span>
    </label>
    <label class="theme-mode-option">
      <input type="radio" name="themeMode" value="light">
      <span>Light</span>
    </label>
    <label class="theme-mode-option">
      <input type="radio" name="themeMode" value="dark">
      <span>Dark</span>
    </label>
    <label class="theme-mode-option">
      <input type="radio" name="themeMode" value="custom">
      <span>Custom</span>
    </label>
  </div>

  <div id="themePaletteSelector" class="theme-palette-selector hidden">
    <!-- Palette options -->
  </div>
</section>
```

**Files to Modify:**
- `src/sidepanel/sidepanel.html`
- `src/sidepanel/sidepanel.css`
- `src/sidepanel/sidepanel.js`

**Completion Promise:** Settings panel has an "Appearance" section with theme mode selection. Users can switch between System/Light/Dark/Custom. Custom mode shows palette options. Theme changes apply immediately and persist.

---

## [DONE] TG3-010: Theme All UI Components

**Goal:** Ensure every UI component respects the current theme.

**Tasks:**
- Audit and update all components to use CSS variables:
  - **Header** — background, button colors
  - **Tab bar** — background, text, active indicator
  - **Status bar** — background, text
  - **Search input** — background, border, text, placeholder
  - **Group cards** — background, border, hover
  - **Tab items** — background, text, hover
  - **Home tabs section** — special warning styling (works in all themes)
  - **Buttons** — primary, secondary, danger, link styles
  - **Confirmation dialog** — backdrop, content, buttons
  - **Toast notifications** — background colors per type
  - **Dropdown menus** — background, hover, text
  - **Checkboxes** — accent color (where supported)
  - **Focus outlines** — use `--accent` or `--primary`
  - **Scrollbars** — style for dark themes (optional)

**Special Considerations:**
- Home tabs section: Use `--warning` with transparency for background
- Focus states: Must be visible on both light and dark backgrounds
- Disabled states: Use reduced opacity of text color
- Shadows: May need adjustment for dark themes

**Files to Modify:**
- `src/sidepanel/sidepanel.css` (comprehensive update)

**Completion Promise:** All UI components update correctly when theme changes. No visual artifacts or unreadable text in any theme. Focus states are visible. Home tabs section has appropriate styling in all themes.

---

## [DONE] TG3-011: Polish & Testing

**Goal:** Final polish and comprehensive testing of v3 features.

**Tasks:**
- **Bug Fix Verification:**
  - Test Live Tabs with 0, 1, 10, 50+ tabs
  - Test with various tab types (pinned, grouped, incognito if applicable)
  - Verify counts match between list and status bar

- **Theme Testing:**
  - Test all 5 dark themes individually
  - Test light mode
  - Test system mode switching (toggle OS preference)
  - Test theme persistence across panel close/open
  - Test theme persistence across browser restart
  - Verify no flash of wrong theme on load

- **Rebranding Verification:**
  - Check extension name in Chrome
  - Check all user-visible "Tab Goblin" references
  - Verify no "Tab Vault" references remain

- **Emoji Removal Verification:**
  - Visual scan of all panels
  - Check source code for emoji Unicode

- **Header Design Verification:**
  - Clean, minimal appearance
  - "Shutdown All" accessible and styled correctly
  - Works in all themes

- **Accessibility:**
  - Keyboard navigation through theme settings
  - Screen reader announces theme changes
  - Color contrast in all themes (use Chrome DevTools audit)

- **Performance:**
  - Theme switching is instant (no delay)
  - Large vault (500+ tabs) loads without lag

- **Error Handling:**
  - Invalid theme setting defaults gracefully
  - Storage errors handled

**Files to Review:**
- All modified files from TG3-001 through TG3-010

**Completion Promise:** All v3 features work correctly. Live Tabs displays tabs. Themes switch smoothly. Branding is "Tab Goblin". No emojis in UI. Header is minimal. All tests pass.

---

## [DONE] TG3-012: Tab Navigation Feature

**Goal:** Allow users to navigate to open tabs from the Vault panel and automatically navigate to restored tabs.

**Background:**
The Vault panel should display which vaulted tabs are currently open (active) and allow users to click on them to navigate directly to that tab. Additionally, when restoring a tab, the browser should navigate to the newly opened tab.

**Tasks:**

### Active Tab Indicators in Vault
- When rendering vault groups, check if any vaulted tab URL matches an open browser tab
- Display "Active" indicator/badge on tabs that are currently open
- Group active tabs visually (optional: separate "Active" section at top of group)
- Update active status when tabs are opened/closed (listen to `chrome.tabs.onCreated`, `chrome.tabs.onRemoved`)

### Click to Navigate
- Make active vault tabs clickable
- On click, navigate to the matching open tab using Chrome APIs:
  ```javascript
  // Switch to the tab
  await chrome.tabs.update(tabId, { active: true });
  // Focus the window containing the tab
  await chrome.windows.update(tab.windowId, { focused: true });
  ```
- Add visual feedback (cursor, hover state) to indicate clickable tabs

### Navigate After Restore
- After restoring a tab (single or group), navigate to the first restored tab
- After restoring a single tab: navigate to that tab
- After restoring a group: navigate to the first tab in the group
- Use same navigation logic: `chrome.tabs.update()` + `chrome.windows.update()`

### Service Worker Updates
- Add new message action: `'navigate-to-tab'`
- Handler should:
  1. Find the tab by ID
  2. Activate the tab: `chrome.tabs.update(tabId, { active: true })`
  3. Focus the window: `chrome.windows.update(tab.windowId, { focused: true })`
  4. Return success/failure

### URL Matching Logic
- Match vault tab URLs to open tab URLs
- Handle URL variations (trailing slashes, query params)
- Consider exact match vs. normalized match

**Chrome APIs Used:**
```javascript
// Navigate to a specific tab
chrome.tabs.update(tabId, { active: true });

// Focus the window containing the tab
chrome.windows.update(windowId, { focused: true });

// Listen for tab changes
chrome.tabs.onCreated.addListener(callback);
chrome.tabs.onRemoved.addListener(callback);
chrome.tabs.onUpdated.addListener(callback);
```

**Files to Modify:**
- `src/sidepanel/sidepanel.js` — Active tab detection, click handlers, navigation calls
- `src/sidepanel/sidepanel.css` — Active tab styling, clickable states
- `src/background/service-worker.js` — Navigation message handler, update restore handlers

**Completion Promise:**
1. Vault panel shows "Active" indicator on tabs that are currently open in the browser
2. Clicking an active vault tab navigates to that tab in the browser
3. Restoring a tab (single or group) navigates to the restored tab(s)
4. Navigation focuses both the tab and its containing window

---

## [DONE] TG3-013: Polish Navigation & Final Testing

**Goal:** Ensure navigation feature integrates smoothly with existing functionality.

**Tasks:**
- Test navigation with tabs in different windows
- Test navigation with pinned tabs
- Test active detection updates in real-time
- Verify no performance impact from tab listeners
- Update TG3-011 final testing to include navigation tests
- Ensure navigation works correctly after theme changes

**Completion Promise:** Navigation feature works reliably across all scenarios. Active indicators update in real-time. No performance degradation.

---

## Future Considerations (Not in v3)

- Light versions of each theme palette
- Custom user-defined themes
- Theme export/import
- Auto-theme based on time of day
- Per-window theme settings
- Icon/imagery system to replace removed emojis
- Cross-device sync of theme preference
