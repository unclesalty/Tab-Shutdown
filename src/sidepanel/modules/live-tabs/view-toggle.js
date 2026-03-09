// Tab Goblin - View Toggle Module
// Handles grouped/ungrouped view toggle for Live Tabs panel

const ViewToggle = (function() {
  // Callback for when view changes
  let _onViewChange = null;

  /**
   * Initialize the module with callback
   * @param {Object} options - { onViewChange }
   */
  function init(options) {
    _onViewChange = options?.onViewChange || null;
    setupEventListeners();
  }

  /**
   * Set up event listeners for view toggle
   */
  function setupEventListeners() {
    // View toggle button clicks
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => handleViewToggle(btn.dataset.view));
    });

    // View toggle keyboard navigation
    const viewToggle = document.querySelector('.view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('keydown', handleKeydown);
    }
  }

  /**
   * Handle view toggle button click
   * @param {string} view - 'grouped' or 'ungrouped'
   */
  async function handleViewToggle(view) {
    if (!view || (view !== 'grouped' && view !== 'ungrouped')) return;

    // Save the view setting
    await Settings.updateSetting('liveTabsView', view);

    // Update toggle button UI
    updateUI(view);

    // Clear selection when switching views
    State.clearSelection();

    // Notify callback to re-render
    if (_onViewChange) {
      await _onViewChange(view);
    }
  }

  /**
   * Update the view toggle button states
   * @param {string} view - Current view mode
   */
  function updateUI(view) {
    const buttons = document.querySelectorAll('.view-toggle-btn');
    buttons.forEach(btn => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  }

  /**
   * Handle keyboard navigation for view toggle
   * @param {KeyboardEvent} e - Keyboard event
   */
  function handleKeydown(e) {
    const buttons = Array.from(document.querySelectorAll('.view-toggle-btn'));
    const currentIndex = buttons.findIndex(btn => btn.classList.contains('active'));

    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      newIndex = (currentIndex + 1) % buttons.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return;
    } else {
      return;
    }

    if (newIndex !== currentIndex) {
      buttons[newIndex].focus();
      handleViewToggle(buttons[newIndex].dataset.view);
    }
  }

  /**
   * Get the current view mode from settings
   * @returns {Promise<string>}
   */
  async function getCurrentView() {
    return await Settings.getSetting('liveTabsView') || 'grouped';
  }

  // Public API
  return {
    init,
    updateUI,
    getCurrentView
  };
})();
