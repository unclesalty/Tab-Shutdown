// Tab Goblin - UI Helpers Module
// Single source of truth for shared UI utility functions

const UIHelpers = {
  /**
   * Pluralize 'tab' based on count
   * @param {number} count
   * @returns {string} "tab" or "tabs"
   */
  pluralizeTabs(count) {
    return `tab${count !== 1 ? 's' : ''}`;
  },

  /**
   * Clear all children from a container
   * @param {HTMLElement} container
   */
  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  },

  /**
   * Show a toast notification
   * @param {string} message
   * @param {string} type - 'info', 'success', 'warning', 'error'
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const text = document.createElement('span');
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(text);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  },

  /**
   * Set loading state on a button
   * @param {HTMLButtonElement} btn
   * @param {boolean} loading
   */
  setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  },

  /**
   * Get default favicon placeholder
   * @returns {string} Data URI for default favicon
   */
  getDefaultFavicon() {
    return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect fill=%22%23ddd%22 width=%2216%22 height=%2216%22 rx=%222%22/></svg>';
  },

  /**
   * Truncate URL for display
   * @param {string} url
   * @param {number} maxLength - Maximum length for path portion
   * @returns {string}
   */
  truncateUrl(url, maxLength = 40) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      const truncatedPath = path.length > maxLength ? path.substring(0, maxLength) + '...' : path;
      return parsed.hostname + truncatedPath;
    } catch {
      const totalMax = maxLength + 10;
      return url.length > totalMax ? url.substring(0, totalMax) + '...' : url;
    }
  }
};

// Export for use in browser context
if (typeof window !== 'undefined' && typeof window.UIHelpers === 'undefined') {
  window.UIHelpers = UIHelpers;
}
