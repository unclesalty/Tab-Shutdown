# Contributing to Tab Vault

Thank you for your interest in contributing to Tab Vault! This document provides guidelines and information for contributors.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Submitting Changes](#submitting-changes)
5. [Code Style](#code-style)
6. [Testing](#testing)
7. [Documentation](#documentation)
8. [Issue Guidelines](#issue-guidelines)
9. [Pull Request Process](#pull-request-process)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Accept differing viewpoints gracefully

---

## Getting Started

### Prerequisites

- Google Chrome (version 88+)
- Git
- A code editor (VS Code recommended)
- Basic knowledge of JavaScript and Chrome Extensions

### Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/tab-vault.git
   cd tab-vault
   ```

2. **Load the extension**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project folder

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Workflow

### Making Changes

1. **Understand the architecture**
   - Read the [Developer Guide](DEVELOPER_GUIDE.md)
   - Review the [PRD](../PRD.md) for product context

2. **Make focused changes**
   - One feature or fix per branch
   - Keep changes minimal and targeted

3. **Test your changes**
   - Reload the extension after changes
   - Test all affected functionality
   - Check the console for errors

4. **Reload the extension**
   - Go to `chrome://extensions`
   - Click the reload icon on Tab Vault
   - Or use the keyboard shortcut (if configured)

### Project Structure

```
src/
├── background/        # Service worker (tab operations)
├── common/            # Shared modules (storage, settings)
└── popup/             # User interface
```

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for detailed architecture.

---

## Submitting Changes

### Commit Messages

Use clear, descriptive commit messages:

```
feat: Add keyboard shortcut for vault current tab
fix: Prevent duplicate groups when auto-grouping
docs: Update installation instructions
refactor: Simplify home tab pattern matching
```

Prefixes:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `refactor:` — Code change that doesn't fix a bug or add a feature
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

### Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
docs/description       # Documentation
refactor/description   # Refactoring
```

Examples:
- `feature/export-vault`
- `fix/home-tab-pattern-matching`
- `docs/add-api-documentation`

---

## Code Style

### General Principles

- **Keep it simple** — No unnecessary complexity
- **Be consistent** — Follow existing patterns
- **No frameworks** — Vanilla JavaScript only
- **No build tools** — No bundlers, transpilers, or npm packages

### JavaScript Style

```javascript
// Use const/let, never var
const CONSTANT_VALUE = 'value';
let mutableValue = 0;

// Use async/await over .then() chains
async function fetchData() {
  try {
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Use arrow functions for callbacks
array.filter(item => item.active);

// Use template literals
const message = `Found ${count} items`;

// Destructure when appropriate
const { id, name } = group;

// Use meaningful names
function calculateTotalTabCount() { }  // Good
function calc() { }                     // Bad
```

### DOM Manipulation

**Always use safe DOM methods to prevent XSS vulnerabilities:**

```javascript
// CORRECT: Safe DOM creation
const div = document.createElement('div');
div.className = 'my-class';
div.textContent = userInput;  // textContent is safe
container.appendChild(div);

// NEVER use methods that parse HTML strings with untrusted content
// Always use createElement, textContent, and appendChild instead
```

### File Organization

- One module per file
- Export at the bottom of the file
- Keep functions focused and small
- Group related functions together

---

## Testing

### Manual Testing Checklist

Before submitting, verify:

- [ ] Extension loads without errors
- [ ] Shutdown All works correctly
- [ ] Shutdown Selected works correctly
- [ ] Shutdown by Domain works correctly
- [ ] Restore Group works correctly
- [ ] Restore Individual Tab works correctly
- [ ] Copy (duplicate) works correctly
- [ ] Home tabs are protected
- [ ] Search filters correctly
- [ ] Group rename works
- [ ] Group delete works
- [ ] Group reorder works
- [ ] Keyboard shortcuts work
- [ ] Data persists after browser restart
- [ ] No console errors during normal use

### Testing Edge Cases

- Empty vault state
- Very long tab titles
- Many groups (20+)
- Many tabs in one group (100+)
- Invalid URLs
- chrome:// URLs (should be skipped)
- Network errors (favicons)

### Console Commands

Useful for testing:

```javascript
// View vault contents
chrome.storage.local.get('vault', console.log);

// Clear vault (for testing)
chrome.storage.local.set({ vault: { groups: [] } });

// Add test group
VaultStorage.addGroup('Test', [
  { url: 'https://example.com', title: 'Test Tab' }
]);
```

---

## Documentation

### When to Update Docs

- New features need user documentation
- API changes need developer documentation
- Bug fixes may need FAQ updates
- Configuration changes need setup updates

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, quick start |
| `documentation/INSTALLATION.md` | Detailed setup |
| `documentation/USER_GUIDE.md` | End-user instructions |
| `documentation/DEVELOPER_GUIDE.md` | Technical details |
| `documentation/CONTRIBUTING.md` | This file |

### Style Guidelines

- Use clear, simple language
- Include code examples
- Add screenshots for UI changes
- Keep formatting consistent

---

## Issue Guidelines

### Before Creating an Issue

1. Search existing issues to avoid duplicates
2. Test with the latest version
3. Disable other extensions to rule out conflicts

### Bug Reports

Include:
- Chrome version
- Extension version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Console errors (if any)
- Screenshots (if helpful)

Template:
```markdown
**Chrome Version:** 120.0.0.0
**Extension Version:** 1.0.0

**Steps to Reproduce:**
1. Open popup
2. Click "Shutdown All"
3. ...

**Expected:** Tabs should be vaulted
**Actual:** Nothing happens

**Console Errors:**
[Paste any errors here]
```

### Feature Requests

Include:
- Clear description of the feature
- Use case / problem it solves
- Proposed implementation (optional)
- Mockups or examples (if applicable)

---

## Pull Request Process

### Before Submitting

1. **Sync with main**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Test thoroughly**
   - All existing features still work
   - New features work as expected
   - No console errors

3. **Review your changes**
   ```bash
   git diff origin/main
   ```

### PR Description

Include:
- Summary of changes
- Related issue number (if any)
- Testing performed
- Screenshots (for UI changes)

Template:
```markdown
## Summary
Brief description of what this PR does.

## Related Issue
Fixes #123

## Changes
- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing
- Tested Shutdown All with 50 tabs
- Verified home tab protection
- Checked data persistence

## Screenshots
[If applicable]
```

### Review Process

1. Maintainers will review your PR
2. Address any feedback
3. Once approved, PR will be merged
4. Your contribution will be credited

### After Merge

- Delete your feature branch
- Sync your fork with main
- Celebrate your contribution!

---

## Questions?

If you have questions:
- Open a Discussion on GitHub
- Comment on a related Issue
- Reach out to maintainers

Thank you for contributing to Tab Vault!
