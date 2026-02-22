# Tab Goblin

**Status:** v2 Complete | v3 In Development

A Chrome extension that fully closes tabs to reclaim RAM/CPU while preserving them in an organized vault for later restoration.

## The Problem

Too many open Chrome tabs destroy RAM/CPU and slow everything down. But for ADHD workflows and research sessions, open tabs serve as visual reminders and context anchors — closing them means losing track of what you were doing.

## The Solution

**Tab Goblin** lets you fully close tabs to reclaim system resources while preserving them in an organized vault you can restore from at any time.

Unlike tab suspenders or discarding features, Tab Goblin **actually closes tabs**. Vaulted tabs consume zero memory. When you need them back, restore with one click.

## Features

- **Shutdown All** — Close all tabs instantly, save them to the vault
- **Shutdown Selected** — Pick specific tabs to vault
- **Shutdown by Domain** — Vault all tabs from a specific site (e.g., all GitHub tabs)
- **Auto-group by Domain** — Automatically organize vaulted tabs by website
- **Home Tab Protection** — Designate tabs that are never vaulted (e.g., Gmail, Calendar)
- **Search Vault** — Find any vaulted tab across all groups
- **Restore & Copy** — Restore tabs (removes from vault) or open copies (keeps in vault)
- **Tab Navigation** — Click vault tabs to navigate to open tabs, auto-navigate on restore
- **Drag-and-Drop** — Move tabs between vault groups
- **Keyboard Shortcuts** — Quick vault with `Alt+Shift+V` (current tab) or `Alt+Shift+A` (all tabs)
- **Persistent Storage** — Vault survives browser restarts and extension updates
- **Side Panel UI** — Persistent panel that stays open while you browse

## Roadmap

### v1 (Complete)
Core functionality: vault/restore tabs, home tab protection, search, keyboard shortcuts, group management.

### v2 (Complete)
UI/UX improvements:
- **Side Panel** — Persistent panel using chrome.sidePanel (replaces popup)
- **Tab-Based Navigation** — Tabs for Vault, Live Tabs, Settings
- **Unified Display** — Live tabs shown in accordion style matching vault
- **Drag-and-Drop** — Move tabs between groups
- **Accessibility** — Keyboard navigation, screen reader support

### v3 (In Development)
Theme system, navigation, and refinements:
- **Bug Fix** — Live Tabs panel not displaying open tabs
- **Theme System** — Light/Dark/System/Custom modes
- **5 Dark Palettes** — Midnight Glass, Neon Ember, Soft Lavender, Arctic Mint, Slate Minimal
- **Tab Navigation** — Click active vault tabs to navigate, auto-navigate on restore
- **Simplified Header** — Clean, minimal design
- **Remove Emojis** — Prepare for custom iconography

See [TICKETS.md](TICKETS.md) for detailed implementation plan.

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `chrome_tab_shutdown` folder
6. The Tab Goblin icon will appear in your toolbar

### From Chrome Web Store

*Coming soon*

## Usage

### Quick Start

1. Click the Tab Goblin icon in your toolbar (opens side panel)
2. Click **Shutdown All** to vault all open tabs
3. Your tabs are now saved and closed
4. Click **Restore** on any group to bring tabs back

### Vaulting Tabs

| Action | How |
|--------|-----|
| Vault current tab | Press `Alt+Shift+V` |
| Vault all tabs | Press `Alt+Shift+A` or click "Shutdown All" |
| Vault selected tabs | Go to "Live Tabs" tab, select tabs, click "Vault Selected" |
| Vault by domain | In "Live Tabs", click "Vault" on a domain group |

### Restoring Tabs

| Action | How |
|--------|-----|
| Restore entire group | Click "Restore" on a group |
| Restore single tab | Expand group, click "Restore" on a tab |
| Open copy (keep in vault) | Click "Copy" instead of "Restore" |

### Home Tabs (Protected)

Home tabs are never vaulted, even during "Shutdown All":

1. Go to **Settings** tab in the side panel
2. Add URL patterns (e.g., `*://mail.google.com/*`)
3. Or in **Live Tabs**, click the protect button on any tab

Pattern examples:
- `*://mail.google.com/*` — Protects all Gmail pages
- `https://calendar.google.com/*` — Protects Google Calendar
- `*://localhost:*/*` — Protects all localhost development servers

### Searching the Vault

In the **Vault** tab, type in the search box to filter tabs across all groups by title or URL.

### Managing Groups

- **Rename** — Click the menu button on a group, select "Rename"
- **Delete** — Click the menu button on a group, select "Delete"
- **Reorder** — Click the menu button, use "Move Up" or "Move Down"
- **Drag-and-Drop** — Drag tabs between groups to reorganize

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+V` | Vault the current tab |
| `Alt+Shift+A` | Vault all tabs (except home tabs) |

To customize shortcuts:
1. Go to `chrome://extensions/shortcuts`
2. Find "Tab Goblin"
3. Set your preferred key combinations

## How It's Built

Tab Goblin is a Chrome Extension built with:

- **Manifest V3** — Latest Chrome extension architecture
- **Vanilla JavaScript** — No frameworks, no build tools
- **Chrome Storage API** — Local storage for vault data
- **Chrome Tabs API** — Tab management and manipulation
- **Chrome Side Panel API** — Persistent side panel UI
- **CSS Custom Properties** — Theme system (v3)

### Project Structure

```
chrome_tab_shutdown/
├── manifest.json           # Extension manifest (permissions, shortcuts)
├── src/
│   ├── assets/
│   │   ├── icon16.png      # Toolbar icon (16x16)
│   │   └── icon48.png      # Extension icon (48x48)
│   ├── background/
│   │   └── service-worker.js   # Background operations (shutdown/restore)
│   ├── common/
│   │   ├── storage.js      # Vault data CRUD operations
│   │   ├── home-tabs.js    # Home tab pattern matching
│   │   ├── settings.js     # User preferences
│   │   └── themes.js       # Theme definitions (v3)
│   └── sidepanel/
│       ├── sidepanel.html  # Side panel UI structure
│       ├── sidepanel.css   # Side panel styling + themes
│       └── sidepanel.js    # Side panel interactivity
├── documentation/          # Detailed documentation
├── archive/                # Previous version documents
├── PRD.md                  # Product requirements
├── TICKETS.md              # Implementation tickets
└── CLAUDE.md               # AI assistant instructions
```

### Data Model

Vault data is stored in `chrome.storage.local`:

```javascript
{
  "vault": {
    "groups": [
      {
        "id": "abc123",
        "name": "Research",
        "createdAt": 1708617600000,
        "tabs": [
          {
            "id": "def456",
            "url": "https://example.com",
            "title": "Example Page",
            "favIconUrl": "https://example.com/favicon.ico",
            "vaultedAt": 1708617600000
          }
        ]
      }
    ]
  },
  "settings": {
    "themeMode": "system",
    "themePalette": "slate-minimal",
    "activeTab": "vault"
  }
}
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](documentation/CONTRIBUTING.md) for guidelines.

### Development Setup

1. Clone the repository
2. Load the extension in Chrome (Developer mode)
3. Make changes to source files
4. Reload the extension to test (`chrome://extensions` -> Reload)

### Code Style

- Vanilla JavaScript (ES6+)
- No external dependencies
- Safe DOM manipulation (no innerHTML with untrusted content)
- Async/await for Chrome API calls
- CSS custom properties for all colors

### Running Reviews

This project uses automated code review tools:

```bash
# Code simplification
/code-simplifier

# Code review
/code-review
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/tab-goblin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/tab-goblin/discussions)

---

Built with care for the tab hoarders among us.
