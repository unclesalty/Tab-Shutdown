# Code Review — Usage Guide

**Branch:** `hotkey_and_cleanup`
**Date:** 2026-02-22

## How to Use the Review

### Reading the Review

The full review is at `context_items/opus-cursor-review.md`. It is organized into:

1. **Executive Summary** — The 4 most impactful issues in 2 paragraphs
2. **Critical Bugs** — Issues causing incorrect behavior right now
3. **Concurrency & Data Integrity** — Race conditions and data loss risks
4. **D.R.Y. Violations** — Duplicated code that should be consolidated
5. **Architecture** — Structural issues affecting maintainability
6. **Security** — Potential vulnerability vectors
7. **Performance** — Inefficiencies that degrade the user experience
8. **Inconsistent Behavior** — Issues explaining the reported UX inconsistencies
9. **Positive Observations** — Things the codebase does well (keep doing these)
10. **Priority Matrix** — P0 through P3 fix ordering

### Working Through Fixes

Each issue has:
- **An ID** (e.g., `BUG-01`, `CONC-03`) for referencing in tickets or commits
- **File and line references** so you can find the exact code
- **A severity level** and impact description
- **A suggested fix** with enough detail to implement

### Recommended Workflow

1. Start with P0 issues — these are causing active user-facing problems
2. Create a ticket per issue (or group related issues)
3. Fix `BUG-01` first — it's the most likely cause of the reported inconsistent behavior
4. Fix `CONC-01` and `CONC-03` together — they share a common solution (shared lock utility)
5. Move to P1, then P2 as capacity allows
6. P3 items can be addressed opportunistically
