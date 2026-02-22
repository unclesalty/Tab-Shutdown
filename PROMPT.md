# PROMPT: Tab Vault — Ralph Loop Instructions

## Loop Configuration

- **Max Iterations:** 20
- **Completion Promise:** First_Build_Complete!

## Role

You are implementing **Tab Vault**, a Chrome extension. Work through the tickets in `TICKETS.md` sequentially, one at a time.

## References

- **PRD.md** — Full product requirements. Read this first to understand the product.
- **TICKETS.md** — Implementation tickets ordered by dependency. Each has a completion promise.

## Workflow

1. Read `PRD.md` to understand the full product vision.
2. Read `TICKETS.md` to see all tickets and their completion promises.
3. Pick the next incomplete ticket (lowest number not yet done).
4. Implement the ticket fully.
5. Verify the **Completion Promise** is met. Be honest — if it's not met, keep working.
6. When the completion promise is satisfied, mark the ticket as done by adding `[DONE]` to its heading in `TICKETS.md` (e.g., `## [DONE] TV-001: Project Scaffolding`).
7. Move to the next ticket.

## Rules

- Work on **one ticket at a time**, in order.
- Do **not** skip ahead or partially implement future tickets.
- Each ticket's completion promise is the **only** definition of done.
- If a ticket requires a decision not covered in the PRD, make a reasonable choice and note it in a comment in the code.
- Keep code simple. No build tools, no bundlers, no frameworks unless a ticket explicitly calls for one. Vanilla HTML/CSS/JS.
- Test your work against the completion promise before marking done.

## Completion Signal

When all tickets in `TICKETS.md` are marked `[DONE]`, output:

```
First_Build_Complete!
```

Then proceed to the **Final Review Phase**.

---

## Final Review Phase

After all tickets are done, run these review steps and address any issues found:

### Step 1: Code Simplifier
Run `/code-simplifier` to simplify and refine the codebase for clarity and maintainability.
- Apply all recommended simplifications
- Commit changes if substantial

### Step 2: Code Review
Run `/code-review` on the full implementation.
- Address any code quality issues
- Fix anti-patterns or bad practices
- Ensure consistent code style

### Step 3: Security Review
Review for security vulnerabilities:
- Check for XSS risks in any HTML rendering
- Verify `chrome.storage` data is validated
- Ensure no sensitive data leaks
- Check URL pattern matching is safe
- Review all `chrome.tabs` API usage

### Step 4: Final Verification
- Run through all completion promises one more time
- Verify extension loads without errors
- Confirm all features work end-to-end

Once all review steps pass, the loop is truly complete.
