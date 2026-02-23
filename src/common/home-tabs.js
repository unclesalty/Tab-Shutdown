// Tab Goblin - Home Tabs Module
// Manages home tab URL patterns that are protected from shutdown

const HOME_PATTERNS_KEY = 'homeTabPatterns';
const HOME_INSTANCES_KEY = 'homeTabInstances';

/**
 * Home tab instance schema:
 * {
 *   instances: [
 *     {
 *       url: string,
 *       title: string,
 *       favIconUrl: string,
 *       lastSeen: number (timestamp)
 *     }
 *   ]
 * }
 */

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
 * @returns {Promise<{patterns: string[], added: boolean, error?: string}>} - Updated patterns array, whether it was added, or error
 */
async function addHomePattern(pattern) {
  const patterns = await getHomePatterns();

  // Check maximum pattern limit
  if (patterns.length >= MAX_PATTERNS) {
    return { patterns, added: false, error: `Maximum of ${MAX_PATTERNS} patterns allowed` };
  }

  // Check if pattern already exists
  if (patterns.includes(pattern)) {
    return { patterns, added: false };
  }

  patterns.push(pattern);
  await saveHomePatterns(patterns);
  return { patterns, added: true };
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

// Maximum number of patterns allowed
const MAX_PATTERNS = 100;

/**
 * Convert a wildcard pattern to a RegExp
 * Supports * as a wildcard that matches any characters
 * Collapses consecutive wildcards for efficiency (***  becomes single .*)
 * @param {string} pattern
 * @returns {RegExp}
 */
function patternToRegex(pattern) {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace consecutive * with single .* for efficient regex
  const regexStr = '^' + escaped.replace(/\*+/g, '.*') + '$';
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

/**
 * Get all known home tab instances from storage
 * @returns {Promise<Array>}
 */
async function getHomeInstances() {
  try {
    const result = await chrome.storage.local.get(HOME_INSTANCES_KEY);
    if (result[HOME_INSTANCES_KEY] && Array.isArray(result[HOME_INSTANCES_KEY].instances)) {
      return result[HOME_INSTANCES_KEY].instances;
    }
    return [];
  } catch (error) {
    console.error('Error reading home instances:', error);
    return [];
  }
}

/**
 * Save home tab instances to storage
 * @param {Array} instances
 * @returns {Promise<void>}
 */
async function saveHomeInstances(instances) {
  try {
    await chrome.storage.local.set({ [HOME_INSTANCES_KEY]: { instances } });
  } catch (error) {
    console.error('Error saving home instances:', error);
    throw error;
  }
}

/**
 * Add or update a home tab instance (called when a matching tab is seen)
 * @param {Object} tabInfo - { url, title, favIconUrl }
 * @returns {Promise<void>}
 */
async function trackHomeInstance(tabInfo) {
  if (!tabInfo.url) return;

  const instances = await getHomeInstances();
  const existingIndex = instances.findIndex(i => i.url === tabInfo.url);

  const instanceData = {
    url: tabInfo.url,
    title: tabInfo.title || 'Untitled',
    favIconUrl: tabInfo.favIconUrl || '',
    lastSeen: Date.now()
  };

  if (existingIndex >= 0) {
    // Update existing instance
    instances[existingIndex] = instanceData;
  } else {
    // Add new instance
    instances.push(instanceData);
  }

  await saveHomeInstances(instances);
}

/**
 * Remove a home tab instance by URL
 * @param {string} url
 * @returns {Promise<void>}
 */
async function removeHomeInstance(url) {
  const instances = await getHomeInstances();
  const filtered = instances.filter(i => i.url !== url);
  await saveHomeInstances(filtered);
}

/**
 * Clean up instances that no longer match any pattern
 * @returns {Promise<void>}
 */
async function cleanupOrphanedInstances() {
  const patterns = await getHomePatterns();
  const instances = await getHomeInstances();

  const validInstances = instances.filter(instance =>
    matchesPatterns(instance.url, patterns)
  );

  if (validInstances.length !== instances.length) {
    await saveHomeInstances(validInstances);
  }
}

// Export for use in other modules
const HomeTabs = {
  getHomePatterns,
  saveHomePatterns,
  addHomePattern,
  removeHomePattern,
  isHomeTab,
  isHomeTabSync,
  patternToRegex,
  getHomeInstances,
  saveHomeInstances,
  trackHomeInstance,
  removeHomeInstance,
  cleanupOrphanedInstances
};

// Make available globally for both window (popup) and service worker contexts
if (typeof window !== 'undefined') {
  window.HomeTabs = HomeTabs;
}
if (typeof self !== 'undefined') {
  self.HomeTabs = HomeTabs;
}
