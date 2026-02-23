// Tab Goblin - Import/Export Module
// Handles import and export of vault data in Netscape Bookmark HTML format

/**
 * Check if a URL is a valid web URL (http or https)
 * @param {string} url - URL to check
 * @returns {boolean} - True if valid web URL
 */
function isValidWebUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * Escape HTML entities in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate Netscape Bookmark HTML from vault data
 * @param {Object} vault - Vault object with groups array
 * @returns {string} - Netscape Bookmark HTML
 */
function generateNetscapeBookmarks(vault) {
  if (!vault || !Array.isArray(vault.groups)) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Goblin Export</TITLE>
<H1>Tab Goblin Export</H1>
<DL><p>
`;

  for (const group of vault.groups) {
    if (!group.tabs || group.tabs.length === 0) continue;

    const groupTimestamp = group.createdAt ? Math.floor(group.createdAt / 1000) : timestamp;
    html += `    <DT><H3 ADD_DATE="${groupTimestamp}" LAST_MODIFIED="${groupTimestamp}">${escapeHtml(group.name)}</H3>\n`;
    html += `    <DL><p>\n`;

    for (const tab of group.tabs) {
      const tabTimestamp = tab.vaultedAt ? Math.floor(tab.vaultedAt / 1000) : timestamp;
      html += `        <DT><A HREF="${escapeHtml(tab.url)}" ADD_DATE="${tabTimestamp}">${escapeHtml(tab.title)}</A>\n`;
    }

    html += `    </DL><p>\n`;
  }

  html += `</DL><p>`;
  return html;
}

/**
 * Download vault as Netscape Bookmark HTML file
 * @param {Object} vault - Vault object with groups array
 * @returns {boolean} - True if download was initiated
 */
function downloadExport(vault) {
  const html = generateNetscapeBookmarks(vault);
  if (!html) {
    return false;
  }

  // Generate filename with current date
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `tab-goblin-export-${dateStr}.html`;

  // Create blob and download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL
  URL.revokeObjectURL(url);

  return true;
}

/**
 * Extract bookmark data from an anchor element
 * @param {Element} anchor - A anchor element
 * @returns {Object|null} - { url, title } or null if invalid
 */
function extractBookmark(anchor) {
  if (!anchor) return null;
  const url = anchor.getAttribute('href');
  if (!isValidWebUrl(url)) return null;
  const title = anchor.textContent.trim() || url || 'Untitled';
  return { url, title };
}

/**
 * Parse Netscape Bookmark HTML into vault group structure
 * @param {string} html - Netscape Bookmark HTML content
 * @returns {Object} - Parsed result { groups: [{ name, tabs: [{ url, title }] }], error: string|null }
 */
function parseNetscapeBookmarks(html) {
  if (!html || typeof html !== 'string') {
    return { groups: [], error: 'Invalid bookmark file' };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Check if it's a valid bookmark file
  const doctype = html.trim().toLowerCase();
  if (!doctype.includes('netscape-bookmark') && !doc.querySelector('DL')) {
    return { groups: [], error: 'Invalid bookmark file' };
  }

  const groups = [];
  const orphanTabs = [];

  /**
   * Process a DL element and extract bookmarks recursively
   * @param {Element} dl - DL element
   * @param {string} parentName - Parent folder name for nested folders
   */
  function processDL(dl, parentName) {
    const directTabs = [];

    for (const child of dl.children) {
      if (child.tagName !== 'DT') continue;

      // Check for H3 (folder)
      const h3 = child.querySelector(':scope > H3');
      if (h3) {
        const folderName = h3.textContent.trim() || 'Untitled Folder';
        const fullName = parentName ? `${parentName} > ${folderName}` : folderName;

        const nestedDL = child.querySelector(':scope > DL');
        if (nestedDL) {
          processDL(nestedDL, fullName);
        }
        continue;
      }

      // Check for A (bookmark)
      const bookmark = extractBookmark(child.querySelector(':scope > A'));
      if (bookmark) {
        directTabs.push(bookmark);
      }
    }

    // Add direct tabs as a group if we have a parent name
    if (directTabs.length > 0) {
      if (parentName) {
        groups.push({ name: parentName, tabs: directTabs });
      } else {
        orphanTabs.push(...directTabs);
      }
    }
  }

  // Find the root DL element
  const rootDL = doc.querySelector('DL');
  if (!rootDL) {
    return { groups: [], error: 'No bookmarks found in file' };
  }

  // Process the entire tree recursively
  processDL(rootDL, '');

  // Add orphan tabs as "Imported Bookmarks" group
  if (orphanTabs.length > 0) {
    groups.push({
      name: 'Imported Bookmarks',
      tabs: orphanTabs
    });
  }

  if (groups.length === 0) {
    return { groups: [], error: 'No bookmarks found in file' };
  }

  return { groups, error: null };
}

/**
 * Import parsed bookmark groups into the vault
 * @param {Array} parsedGroups - Array of parsed groups from parseNetscapeBookmarks
 * @returns {Promise<Object>} - Stats { groupsAdded, tabsAdded, duplicatesSkipped }
 */
async function importToVault(parsedGroups) {
  if (!parsedGroups || !Array.isArray(parsedGroups)) {
    return { groupsAdded: 0, tabsAdded: 0, duplicatesSkipped: 0 };
  }

  // Get existing vault URLs for deduplication
  const vault = await VaultStorage.getVault();
  const existingUrls = new Set();

  for (const group of vault.groups) {
    for (const tab of group.tabs) {
      existingUrls.add(tab.url);
    }
  }

  let groupsAdded = 0;
  let tabsAdded = 0;
  let duplicatesSkipped = 0;

  for (const group of parsedGroups) {
    // Filter out duplicate URLs
    const uniqueTabs = [];
    for (const tab of group.tabs) {
      if (existingUrls.has(tab.url)) {
        duplicatesSkipped++;
      } else {
        uniqueTabs.push(tab);
        existingUrls.add(tab.url); // Prevent duplicates within import
      }
    }

    // Skip group if all tabs are duplicates
    if (uniqueTabs.length === 0) {
      continue;
    }

    // Add group to vault
    await VaultStorage.addGroup(group.name, uniqueTabs);
    groupsAdded++;
    tabsAdded += uniqueTabs.length;
  }

  return { groupsAdded, tabsAdded, duplicatesSkipped };
}

/**
 * Get statistics from parsed bookmark groups (for confirmation dialog)
 * @param {Array} parsedGroups - Array of parsed groups
 * @returns {Object} - Stats { groupCount, tabCount }
 */
function getImportStats(parsedGroups) {
  if (!parsedGroups || !Array.isArray(parsedGroups)) {
    return { groupCount: 0, tabCount: 0 };
  }

  let tabCount = 0;
  for (const group of parsedGroups) {
    tabCount += group.tabs ? group.tabs.length : 0;
  }

  return {
    groupCount: parsedGroups.length,
    tabCount
  };
}

// Export for use in other modules
const ImportExport = {
  escapeHtml,
  generateNetscapeBookmarks,
  downloadExport,
  parseNetscapeBookmarks,
  importToVault,
  getImportStats
};

// Make available globally for browser context
if (typeof window !== 'undefined') {
  window.ImportExport = ImportExport;
}
if (typeof self !== 'undefined') {
  self.ImportExport = ImportExport;
}
