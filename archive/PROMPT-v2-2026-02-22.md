# PROMPT: Tab Vault v2 — Ralph Loop Instructions

## Loop Configuration

- **Max Iterations:** 15
- **Completion Promise:** Side_Panel_Complete!

## Role

You are implementing **Tab Vault v2**, upgrading the Chrome extension from a popup to a side panel with improved UI/UX. Work through the tickets in `TICKETS.md` sequentially, one at a time.

## Context

**v1 is complete.** The extension has working:
- Vault storage and retrieval
- Shutdown (vault) operations
- Restore operations
- Home tab protection
- Search functionality
- Keyboard shortcuts
- Group management (rename, delete, reorder)

**v2 focuses on:**
- Converting from popup to chrome.sidePanel
- Tab-based navigation (Vault, Live Tabs, Settings)
- Unified accordion display for live tabs
- Drag-and-drop preparation/implementation
- Polish and accessibility

## References

- **PRD.md** — Product requirements (still valid)
- **TICKETS.md** — v2 implementation tickets (TV2-001 to TV2-011)
- **archive/TICKETS-v1-2026-02-22.md** — Completed v1 tickets
- **documentation/** — Technical guides and API reference

## Technical Context

### chrome.sidePanel API

The side panel requires:

**manifest.json additions:**
```json
{
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  }
}
```

**Service worker setup:**
```javascript
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

**Key differences from popup:**
- Side panel persists across tab navigation
- User can resize panel width (design must be responsive)
- Side panel has full Chrome API access
- No fixed height constraint (scrollable)

### File Structure for v2

```
src/
├── sidepanel/           # NEW - Side panel UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── popup/               # DEPRECATED - Keep for reference, then remove
├── background/
│   └── service-worker.js  # Update for sidePanel
├── common/
│   ├── storage.js       # No changes expected
│   ├── home-tabs.js     # No changes expected
│   └── settings.js      # May add activeTab persistence
└── assets/
```

## Workflow

1. Read `TICKETS.md` to see all v2 tickets.
2. Pick the next incomplete ticket (lowest number not done).
3. Implement the ticket fully.
4. Use Context7 (`resolve-library-id` and `query-docs`) to look up Chrome Extension APIs when needed.
5. Verify the **Completion Promise** is met.
6. Mark the ticket as done: `## [DONE] TV2-001: ...`
7. Move to the next ticket.

## Rules

- Work on **one ticket at a time**, in order.
- Do **not** skip ahead or partially implement future tickets.
- Each ticket's completion promise is the **only** definition of done.
- Use Context7 to look up documentation for Chrome APIs.
- Keep code simple. Vanilla HTML/CSS/JS. No frameworks.
- Test your work against the completion promise before marking done.
- When migrating from popup to sidepanel, preserve all existing functionality.

## Code Quality Standards

- **Safe DOM manipulation** — Never use methods that parse HTML with untrusted content
- **Async/await** — Use for all Chrome API calls
- **Error handling** — Wrap operations in try/catch
- **Input validation** — Validate user input and message parameters
- **Consistent styling** — Match existing CSS patterns

## Completion Signal

When all tickets in `TICKETS.md` are marked `[DONE]`, output:

```
Side_Panel_Complete!
```

Then proceed to the **Final Review Phase**.

## Final Review Phase

After all tickets are done:

### Step 1: Code Simplifier
Run `/code-simplifier` to refine the codebase.

### Step 2: Code Review
Run `/code-review` on the implementation.

### Step 3: Security Review
- Verify safe DOM manipulation
- Check storage data validation
- Review all Chrome API usage

### Step 4: Accessibility Audit
- Run Chrome DevTools accessibility audit
- Verify keyboard navigation
- Check screen reader compatibility

### Step 5: Final Verification
- Test all v2 features end-to-end
- Verify v1 features still work
- Confirm side panel responsive at various widths

Once all review steps pass, the loop is complete.
