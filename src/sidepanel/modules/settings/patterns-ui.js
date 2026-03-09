// Tab Goblin - Patterns UI Module
// Handles home tab patterns management in Settings panel

const PatternsUI = (function() {
  /**
   * Initialize patterns UI
   */
  function init() {
    setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    document.getElementById('addPatternBtn').addEventListener('click', addNewPattern);
    document.getElementById('addCurrentTabBtn').addEventListener('click', addCurrentTabAsPattern);
    document.getElementById('newPatternInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addNewPattern();
    });
  }

  /**
   * Render home tab patterns list
   */
  async function render() {
    const patterns = await HomeTabs.getHomePatterns();
    const container = document.getElementById('homePatternsContainer');

    UIHelpers.clearContainer(container);

    if (patterns.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-patterns';
      emptyState.textContent = 'No home tab patterns set. Home tabs are protected from shutdown.';
      container.appendChild(emptyState);
      return;
    }

    for (const pattern of patterns) {
      const item = document.createElement('div');
      item.className = 'pattern-item';

      const text = document.createElement('span');
      text.className = 'pattern-text';
      text.textContent = pattern;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-pattern-btn';
      deleteBtn.textContent = '\u00D7';
      deleteBtn.setAttribute('aria-label', 'Delete pattern');
      deleteBtn.addEventListener('click', async () => {
        await HomeTabs.removeHomePattern(pattern);
        await render();
        UIHelpers.showToast('Pattern removed', 'success');
      });

      item.appendChild(text);
      item.appendChild(deleteBtn);
      container.appendChild(item);
    }
  }

  /**
   * Add a new pattern
   */
  async function addNewPattern() {
    const input = document.getElementById('newPatternInput');
    const pattern = input.value.trim();

    if (!pattern) {
      UIHelpers.showToast('Please enter a URL pattern.', 'error');
      return;
    }

    if (pattern.length > 2000) {
      UIHelpers.showToast('Pattern is too long (max 2000 characters).', 'error');
      return;
    }

    const result = await HomeTabs.addHomePattern(pattern);
    if (result.error) {
      UIHelpers.showToast(result.error, 'error');
      return;
    }
    input.value = '';
    await render();
    UIHelpers.showToast('Pattern added', 'success');
  }

  /**
   * Add current tab URL as pattern
   */
  async function addCurrentTabAsPattern() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const result = await HomeTabs.addHomePattern(tab.url);
        if (result.error) {
          UIHelpers.showToast(result.error, 'error');
          return;
        }
        await render();
        UIHelpers.showToast('Current tab added as home tab', 'success');
      }
    } catch (error) {
      UIHelpers.showToast('Could not add current tab', 'error');
    }
  }

  // Public API
  return {
    init,
    render,
    addNewPattern,
    addCurrentTabAsPattern
  };
})();
