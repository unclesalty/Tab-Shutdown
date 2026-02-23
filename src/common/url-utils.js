// Tab Goblin - URL Utilities Module
// Single source of truth for all URL handling functions

const UrlUtils = {
  /**
   * Check if URL should be skipped (chrome:// or extension pages)
   * Returns true for undefined/null URLs and chrome internal pages
   * @param {string|undefined|null} url
   * @returns {boolean}
   */
  isSkippableUrl(url) {
    return !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://');
  },

  /**
   * Extract domain (hostname) from URL
   * @param {string} url
   * @returns {string|null}
   */
  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  },

  /**
   * Normalize URL for comparison (remove trailing slashes, normalize protocol)
   * @param {string} url
   * @returns {string}
   */
  normalizeUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      let pathname = parsed.pathname.replace(/\/+$/, '');
      return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
    } catch {
      return url;
    }
  },

  /**
   * Alias for normalizeUrl - backwards compatibility
   * @param {string} url
   * @returns {string}
   */
  normalizeUrlForComparison(url) {
    return this.normalizeUrl(url);
  },

  /**
   * Group tabs by their domain
   * @param {Array<{url: string}>} tabs - Array of tab objects with url property
   * @returns {Object<string, Array>} - Map of domain to tabs
   */
  groupTabsByDomain(tabs) {
    const groups = {};
    for (const tab of tabs) {
      const domain = this.getDomainFromUrl(tab.url) || 'Other';
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(tab);
    }
    return groups;
  },

  /**
   * Check if a tab's URL matches a domain (including subdomains)
   * @param {string} tabUrl - Tab URL to check
   * @param {string} domain - Domain to match
   * @returns {boolean}
   */
  tabMatchesDomain(tabUrl, domain) {
    const hostname = this.getDomainFromUrl(tabUrl);
    if (!hostname) return false;
    return hostname === domain || hostname.endsWith('.' + domain);
  },

  /**
   * Check if URL is safe to open (prevents javascript:, data:, file: injection)
   * @param {string} url
   * @returns {boolean}
   */
  isValidUrlForOpening(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().trim();
    if (lower.startsWith('javascript:')) return false;
    if (lower.startsWith('data:')) return false;
    if (lower.startsWith('file:')) return false;
    if (lower.startsWith('vbscript:')) return false;
    return true;
  },

  /**
   * Generate a unique ID (timestamp + random string)
   * @returns {string}
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
  }
};

// Export for use in both window (sidepanel) and service worker contexts
if (typeof window !== 'undefined') {
  window.UrlUtils = UrlUtils;
}
if (typeof self !== 'undefined') {
  self.UrlUtils = UrlUtils;
}
