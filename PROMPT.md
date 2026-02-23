# PROMPT: Tab Goblin v6

## Role

You are implementing **Tab Goblin v6**, adding import/export functionality and keyboard shortcut support. Work through the tickets in `TICKETS.md` sequentially, one at a time.

## Context

**v5 is complete.** The extension has working:
- Side panel UI with tab-based navigation
- Vault storage and retrieval
- Shutdown (vault) and restore operations
- Home tab protection with patterns
- History with duplicate prevention
- Search functionality
- Keyboard navigation and accessibility
- 5 dark themes and 5 light themes
- Icon buttons for vault items and groups
- Copy to clipboard functionality
- Drag-and-drop between vault groups

**v6 focuses on:**
- Import/Export in Netscape Bookmark HTML format (Chrome-compatible)
- Keyboard shortcut to toggle side panel (Ctrl/Cmd+Shift+G)
- OS-specific shortcut display in Settings
- Link to Chrome shortcut configuration

## References

- **PRD.md** — Product requirements for v6
- **TICKETS.md** — Implementation tickets (TG6-001 to TG6-015)
- **archive/** — Completed v1-v5 documents

## Technical Context

- Use Context7 to get technical documentation
- Use websearch as a fallback if Context7 returns no results

### Netscape Bookmark Format

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Goblin Export</TITLE>
<H1>Tab Goblin Export</H1>
<DL><p>
    <DT><H3 ADD_DATE="1708646400">Group Name</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1708646400">Page Title</A>
    </DL><p>
</DL><p>
```

**Key Points:**
- `ADD_DATE` is Unix timestamp (seconds since 1970)
- Folders use `<DT><H3>` followed by `<DL><p>`
- Bookmarks use `<DT><A HREF="...">`
- Nested folders should be flattened: "Parent > Child"

### Chrome Commands API

```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+G",
        "mac": "Command+Shift+G"
      },
      "description": "Open Tab Goblin"
    }
  }
}
```

**Key Points:**
- `_execute_action` triggers the extension action (opens side panel)
- `chrome.commands.getAll()` returns current configured shortcuts
- Users configure shortcuts at `chrome://extensions/shortcuts`
- Open shortcuts page: `chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })`

### OS Detection

```javascript
const isMac = navigator.platform.toLowerCase().includes('mac');
const modifier = isMac ? 'Cmd' : 'Ctrl';
```

## Workflow

1. Read `TICKETS.md` to see all v6 tickets.
2. Pick the next incomplete ticket (lowest number not done).
3. Implement the ticket fully.
4. Use Context7 (`resolve-library-id` and `query-docs`) to look up Chrome Extension APIs when needed.
5. Verify the **Completion Promise** is met.
6. Mark the ticket as done: `### TG6-001: ... [DONE]`
7. Move to the next ticket.

## Rules

- Work on **one ticket at a time**, in order.
- Do **not** skip ahead or partially implement future tickets.
- Each ticket's completion promise is the **only** definition of done.
- Use Context7 to look up documentation for Chrome APIs.
- Keep code simple. Vanilla HTML/CSS/JS. No frameworks.
- Test your work against the completion promise before marking done.
- All colors must use CSS custom properties (no hardcoded values).
- No emojis in UI (use Unicode symbols or text).

## Code Quality Standards

- **Safe DOM manipulation** — Never use methods that parse HTML with untrusted content
- **Async/await** — Use for all Chrome API calls
- **Error handling** — Wrap operations in try/catch
- **Input validation** — Validate user input and message parameters
- **CSS variables** — All colors via custom properties
- **Accessibility** — Maintain WCAG AA contrast (4.5:1 minimum)
- **HTML escaping** — Escape user content when generating HTML for export

## Completion Signal

When all tickets in `TICKETS.md` are marked `[DONE]`, output:

```
Goblin_v6_Import_Export_Complete!
```

Then proceed to the **Final Review Phase**.

## Final Review Phase

After all tickets are done:

### Step 1: Code Simplifier
Run `/code-simplifier` to refine the codebase.

### Step 2: Code Review
Run `/code-review` on the implementation.

### Step 3: Security Review
Run `/security-review`

### Step 4: Import/Export Verification
- Export vault with multiple groups
- Verify HTML file structure is valid
- Import into Chrome bookmarks (should work)
- Import back into Tab Goblin (round-trip)
- Import Chrome bookmark export (cross-browser)

### Step 5: Shortcut Verification
- Verify Ctrl/Cmd+Shift+G toggles side panel
- Verify Settings displays current shortcut
- Verify "Configure" link opens Chrome shortcuts
- Customize shortcut, verify Settings updates

### Step 6: Regression Testing
- Verify all existing vault operations work
- Verify themes work (light and dark)
- Verify home tab protection works
- Verify history works

Once all review steps pass, the loop is complete.
