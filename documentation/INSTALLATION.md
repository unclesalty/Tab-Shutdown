# Installation Guide

This guide covers all methods for installing Tab Vault.

## Requirements

- **Google Chrome** version 88 or later (Manifest V3 support)
- **Chromium-based browsers** (Edge, Brave, Vivaldi) should also work

## Method 1: Load Unpacked (Development)

Best for developers or testing the latest version.

### Steps

1. **Download the source code**
   ```bash
   git clone https://github.com/yourusername/tab-vault.git
   cd tab-vault
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions`
   - Or: Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Navigate to and select the `chrome_tab_shutdown` folder
   - Click "Select Folder"

5. **Verify installation**
   - The Tab Vault icon should appear in your toolbar
   - Click it to open the popup

### Updating

When you pull new changes:
1. Go to `chrome://extensions`
2. Find Tab Vault
3. Click the reload icon (circular arrow)

## Method 2: Chrome Web Store

*Coming soon* — The extension will be available on the Chrome Web Store.

## Method 3: Manual Installation (.crx file)

For distributing pre-packaged versions.

### Creating a .crx file (for maintainers)

1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Pack extension"
4. Select the extension directory
5. Chrome will create a `.crx` file and a `.pem` key file

### Installing a .crx file

Note: Chrome restricts .crx installations. You may need to:

1. Drag the .crx file to `chrome://extensions`
2. Or extract and load as unpacked

## Post-Installation Setup

### Pin to Toolbar

For easy access, pin Tab Vault to your toolbar:

1. Click the puzzle piece icon (Extensions) in Chrome toolbar
2. Find "Tab Vault"
3. Click the pin icon

### Configure Keyboard Shortcuts

Default shortcuts:
- `Alt+Shift+V` — Vault current tab
- `Alt+Shift+A` — Vault all tabs

To customize:
1. Go to `chrome://extensions/shortcuts`
2. Find "Tab Vault"
3. Click the pencil icon next to a command
4. Press your desired key combination
5. Click OK

### Set Up Home Tabs

Protect important tabs from being vaulted:

1. Click the Tab Vault icon
2. Click "Settings" in the footer
3. Add URL patterns for tabs you want protected
4. Or navigate to a page and click "Add Current Tab"

## Troubleshooting

### Extension doesn't appear after loading

- Ensure you selected the correct folder (the one containing `manifest.json`)
- Check for errors in `chrome://extensions` (red error badge)
- Try reloading the extension

### "Errors" badge on extension card

1. Click "Errors" to see details
2. Common issues:
   - Missing files: Ensure all files are present
   - Syntax errors: Check JavaScript console for details

### Popup doesn't open

- Ensure the extension is enabled (toggle is blue)
- Try reloading the extension
- Check if another extension is conflicting

### Keyboard shortcuts don't work

1. Go to `chrome://extensions/shortcuts`
2. Check if shortcuts are assigned
3. Ensure no other extension uses the same shortcuts
4. Some system shortcuts may take priority

### Data not persisting

- Check if Chrome has sufficient storage quota
- Ensure you're not in Incognito mode (extensions may be disabled)
- Check for storage errors in the console (right-click popup → Inspect)

## Uninstalling

### Remove the Extension

1. Go to `chrome://extensions`
2. Find "Tab Vault"
3. Click "Remove"
4. Confirm removal

### Data Cleanup

Tab Vault stores data in `chrome.storage.local`. When you remove the extension:
- All vault data is automatically deleted
- Home tab patterns are removed
- Settings are cleared

To export data before uninstalling, use the browser console:
```javascript
chrome.storage.local.get(null, data => console.log(JSON.stringify(data)));
```

## Multiple Profiles

Tab Vault works independently in each Chrome profile:
- Each profile has its own vault
- Settings are not shared between profiles
- Useful for separating work and personal tabs

## Permissions Explained

Tab Vault requests these permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `tabs` | Read tab URLs and titles, close and create tabs |
| `storage` | Save vault data and settings locally |
| `activeTab` | Access the current tab for "Add Current Tab as Home" feature |

Tab Vault does NOT:
- Access your browsing history
- Send data to external servers
- Track your usage
- Access tab content (only URLs and titles)
