// Tab Goblin - Navigation Module
// Handles tab bar navigation and panel switching

const Navigation = (function() {
  // Panel render callbacks (set during init)
  let _renderCallbacks = {};

  function init(renderCallbacks) {
    _renderCallbacks = renderCallbacks || {};
    setupEventListeners();
  }

  function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
    });

    const tabBar = document.querySelector('.tab-bar');
    if (tabBar) {
      tabBar.addEventListener('keydown', handleTabBarKeydown);
    }
  }

  /**
   * Load persisted active tab from settings and show it.
   */
  async function loadActiveTab() {
    const activeTab = await State.loadActiveTab();
    updateTabBarUI();
    showPanel(activeTab);
    updateSearchUI(activeTab);
    return activeTab;
  }

  function updateTabBarUI() {
    const currentTab = State.getCurrentTab();
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === currentTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
  }

  function showPanel(tabName) {
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const panel = document.getElementById(tabName + 'Panel');
    if (panel) {
      panel.classList.remove('hidden');
    }

    // Home Tabs section persists across Live/Vault, hidden on Settings
    const homeTabsSection = document.getElementById('homeTabsSection');
    if (homeTabsSection) {
      homeTabsSection.classList.toggle('hidden', tabName === 'settings');
    }
  }

  async function switchToTab(tabName) {
    if (State.getCurrentTab() === tabName) return;

    State.setCurrentTab(tabName);
    updateTabBarUI();
    showPanel(tabName);
    updateSearchUI(tabName);
    await State.saveActiveTab(tabName);
    await renderCurrentPanel();
  }

  function updateSearchUI(tabName) {
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('globalSearchInput');
    if (!searchContainer || !searchInput) return;

    // Clear search when switching tabs
    State.setSearchQuery('');
    searchInput.value = '';

    if (tabName === 'settings') {
      searchContainer.classList.add('hidden');
    } else {
      searchContainer.classList.remove('hidden');
      searchInput.placeholder = tabName === 'live'
        ? 'Search open tabs...'
        : 'Search vaulted tabs...';
    }
  }

  async function renderCurrentPanel() {
    const currentTab = State.getCurrentTab();
    if (_renderCallbacks[currentTab]) {
      await _renderCallbacks[currentTab]();
    }
  }

  function handleTabBarKeydown(e) {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const currentIndex = tabs.findIndex(t => t.classList.contains('active'));
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        newIndex = (currentIndex + 1) % tabs.length;
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        e.preventDefault();
        break;
      case 'Home':
        newIndex = 0;
        e.preventDefault();
        break;
      case 'End':
        newIndex = tabs.length - 1;
        e.preventDefault();
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex) {
      tabs[newIndex].focus();
      switchToTab(tabs[newIndex].dataset.tab);
    }
  }

  // Public API
  return {
    init,
    loadActiveTab,
    switchToTab,
    updateTabBarUI,
    showPanel,
    updateSearchUI,
    renderCurrentPanel
  };
})();
