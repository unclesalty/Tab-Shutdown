// Tab Goblin - Home Tabs Module
// Manages home tab URL patterns that are protected from shutdown

const HOME_PATTERNS_KEY = 'homeTabPatterns';

/**
 * Get all home tab patterns from storage
 * @returns {Promise<string[]>}
 */
async function getHomePatterns() {
  try {
    const result = await chrome.storage.local.get(HOME_PATTERNS_KEY);
    if (Array.isArray(result[HOME_PATTERNS_KEY])) {
      return result[HOME_PATTERNS_KEY];
    }
    return [];
  } catch (error) {
    console.error('Error reading home patterns:', error);
    return [];
  }
}

/**
 * Save home tab patterns to storage
 * @param {string[]} patterns
 * @returns {Promise<void>}
 */
async function saveHomePatterns(patterns) {
  try {
    await chrome.storage.local.set({ [HOME_PATTERNS_KEY]: patterns });
  } catch (error) {
    console.error('Error saving home patterns:', error);
    throw error;
  }
}

/**
 * Add a new home tab pattern
 * @param {string} pattern
 * @returns {Promise<string[]>} - Updated patterns array
 */
async function addHomePattern(pattern) {
  const patterns = await getHomePatterns();
  if (!patterns.includes(pattern)) {
    patterns.push(pattern);
    await saveHomePatterns(patterns);
  }
  return patterns;
}

/**
 * Remove a home tab pattern
 * @param {string} pattern
 * @returns {Promise<string[]>} - Updated patterns array
 */
async function removeHomePattern(pattern) {
  let patterns = await getHomePatterns();
  patterns = patterns.filter(p => p !== pattern);
  await saveHomePatterns(patterns);
  return patterns;
}

/**
 * Convert a wildcard pattern to a RegExp
 * Supports * as a wildcard that matches any characters
 * @param {string} pattern
 * @returns {RegExp}
 */
function patternToRegex(pattern) {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace * with .* for wildcard matching
  const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
  return new RegExp(regexStr, 'i');
}

/**
 * Check if a URL matches any of the given patterns
 * @param {string} url
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesPatterns(url, patterns) {
  if (!url || !patterns || patterns.length === 0) return false;

  for (const pattern of patterns) {
    try {
      if (patternToRegex(pattern).test(url)) {
        return true;
      }
    } catch (error) {
      console.error('Invalid pattern:', pattern, error);
    }
  }

  return false;
}

/**
 * Check if a URL matches any home tab pattern (async - loads patterns from storage)
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function isHomeTab(url) {
  const patterns = await getHomePatterns();
  return matchesPatterns(url, patterns);
}

/**
 * Synchronous version of isHomeTab for use when patterns are already loaded
 * @param {string} url
 * @param {string[]} patterns
 * @returns {boolean}
 */
function isHomeTabSync(url, patterns) {
  return matchesPatterns(url, patterns);
}

// Export for use in other modules
const HomeTabs = {
  getHomePatterns,
  saveHomePatterns,
  addHomePattern,
  removeHomePattern,
  isHomeTab,
  isHomeTabSync,
  patternToRegex
};

// Make available globally for both window (popup) and service worker contexts
if (typeof window !== 'undefined') {
  window.HomeTabs = HomeTabs;
}
if (typeof self !== 'undefined') {
  self.HomeTabs = HomeTabs;
}
