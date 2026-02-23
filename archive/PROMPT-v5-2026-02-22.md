# PROMPT: Tab Goblin v3

## Role

You are implementing **Tab Goblin v3**, upgrading the Chrome extension with a theme system, bug fixes, and rebranding. Work through the tickets in `TICKETS.md` sequentially, one at a time.

## Context

**v2 is complete.** The extension has working:
- Side panel UI with tab-based navigation
- Vault storage and retrieval
- Shutdown (vault) and restore operations
- Home tab protection with patterns
- Search functionality
- Keyboard shortcuts
- Group management (rename, delete, reorder)
- Drag-and-drop between vault groups

**v3 focuses on:**
- Fixing Live Tabs panel bug (tabs not displaying)
- Rebranding from "Tab Vault" to "Tab Goblin"
- Removing emoji characters from UI
- Simplifying header design
- Adding theme system (light/dark/system/custom)
- Implementing 5 dark theme palettes

## References

- **PRD.md** — Product requirements for v3
- **TICKETS.md** — Implementation tickets (TG3-001 to TG3-011)
- **archive/** — Completed v1/v2 documents
- **images_context_input/palettes.html** — Theme color reference
- **images_context_input/live_tabs_panel_blank.png** — Bug screenshot


## Technical Context

- Use Context7 to get technical documentation
- Use websearch as a fallback if Context7 returns no results

### Theme System Architecture

**CSS Custom Properties:**
```css
:root {
  --bg: #ffffff;
  --bg-surface: #f9f9f9;
  --primary: #4A90D9;
  --accent: #4A90D9;
  --text: #333333;
  --text-secondary: #666666;
  /* ... */
}

[data-theme="midnight-glass"] {
  --bg: #0f172a;
  --bg-surface: #1e293b;
  --primary: #0ea5e9;
  /* ... */
}
```

**Theme Modes:**
- `system` — No data-theme attribute, uses CSS media query
- `light` — data-theme="light" (or no attribute)
- `dark` — data-theme with selected palette
- `custom` — data-theme with selected palette

### Bug Investigation

The Live Tabs bug likely stems from:
```javascript
function isSkippableUrl(url) {
  return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
}
```

If `tab.url` is undefined, ALL tabs are filtered out.

## Workflow

1. Read `TICKETS.md` to see all v3 tickets.
2. Pick the next incomplete ticket (lowest number not done).
3. Implement the ticket fully.
4. Use Context7 (`resolve-library-id` and `query-docs`) to look up Chrome Extension APIs when needed.
5. Verify the **Completion Promise** is met.
6. Mark the ticket as done: `## [DONE] TG3-001: ...`
7. Move to the next ticket.

## Rules

- Work on **one ticket at a time**, in order.
- Do **not** skip ahead or partially implement future tickets.
- Each ticket's completion promise is the **only** definition of done.
- Use Context7 to look up documentation for Chrome APIs.
- Keep code simple. Vanilla HTML/CSS/JS. No frameworks.
- Test your work against the completion promise before marking done.
- All colors must use CSS custom properties (no hardcoded values).

## Code Quality Standards

- **Safe DOM manipulation** — Never use methods that parse HTML with untrusted content
- **Async/await** — Use for all Chrome API calls
- **Error handling** — Wrap operations in try/catch
- **Input validation** — Validate user input and message parameters
- **CSS variables** — All colors via custom properties
- **Accessibility** — Maintain WCAG AA contrast (4.5:1 minimum)

## Completion Signal

When all tickets in `TICKETS.md` are marked `[DONE]`, output:

```
Tab_Goblin_v3_Complete!
```

Then proceed to the **Final Review Phase**.

## Final Review Phase

After all tickets are done:

### Step 1: Code Simplifier
Run `/code-simplifier` to refine the codebase.

### Step 2: Code Review
Run `/code-review` on the implementation.

### Step 4: Security Review
Run `/security-review`

### Step 3: Theme Audit
- Verify all 5 dark themes render correctly
- Verify system mode follows OS preference
- Verify no hardcoded colors remain
- Check contrast ratios in all themes

### Step 4: Bug Verification
- Confirm Live Tabs displays tabs correctly
- Test with various tab counts and types

### Step 5: Branding Check
- Verify all "Tab Goblin" references
- Confirm no "Tab Vault" text remains
- Check no emojis in UI

### Step 6: Accessibility Audit
- Run Chrome DevTools accessibility audit
- Verify keyboard navigation
- Check focus visibility in all themes

Once all review steps pass, the loop is complete.
