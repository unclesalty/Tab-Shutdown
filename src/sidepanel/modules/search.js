// Tab Goblin - Search Module
// Handles global search functionality for Live and Vault panels

const Search = (function() {
  /**
   * Initialize the search module
   */
  function init() {
    document.getElementById('globalSearchInput').addEventListener('input', (e) => {
      const timer = State.getSearchDebounceTimer();
      if (timer) clearTimeout(timer);
      State.setSearchDebounceTimer(setTimeout(() => {
        handleSearch(e.target.value);
      }, 200));
    });
  }

  /**
   * Check if a tab matches a search query (by title or URL)
   */
  function matchesSearch(tab, query) {
    if (!query) return true;
    const titleMatch = (tab.title || '').toLowerCase().includes(query);
    const urlMatch = (tab.url || '').toLowerCase().includes(query);
    return titleMatch || urlMatch;
  }

  /**
   * Handle global search input (works for both Live and Vault panels)
   */
  async function handleSearch(query) {
    State.setSearchQuery(query.trim());
    const currentTab = State.getCurrentTab();

    if (currentTab === 'live') {
      await LiveTabsPanel.render();
    } else if (currentTab === 'vault') {
      if (!State.getSearchQuery()) {
        await VaultPanel.renderGroups();
      } else {
        await renderSearchResults();
      }
    }
  }

  /**
   * Render search results in the vault panel
   */
  async function renderSearchResults() {
    const vault = await VaultStorage.getVault();
    const container = document.getElementById('vaultGroups');
    const searchQuery = State.getSearchQuery();

    UIHelpers.clearContainer(container);

    // Filter tabs across all groups
    const results = [];
    for (const group of vault.groups) {
      const matchingTabs = group.tabs.filter(tab => matchesSearch(tab, searchQuery));
      if (matchingTabs.length > 0) {
        results.push({ group, tabs: matchingTabs });
      }
    }

    if (results.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No matching tabs found.';
      container.appendChild(emptyState);
      return;
    }

    const totalTabs = results.reduce((sum, r) => sum + r.tabs.length, 0);
    const header = document.createElement('div');
    header.className = 'search-results-header';

    const countSpan = document.createElement('span');
    countSpan.textContent = `${totalTabs} result${totalTabs !== 1 ? 's' : ''} found`;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-search-btn';
    clearBtn.textContent = 'Clear search';
    clearBtn.addEventListener('click', () => {
      document.getElementById('globalSearchInput').value = '';
      State.clearSearchQuery();
      VaultPanel.renderGroups();
    });

    header.appendChild(countSpan);
    header.appendChild(clearBtn);
    container.appendChild(header);

    for (const result of results) {
      container.appendChild(createSearchResultGroupCard(result.group, result.tabs));
    }
  }

  /**
   * Create a group card for search results (auto-expanded)
   */
  function createSearchResultGroupCard(group, matchingTabs) {
    const card = document.createElement('div');
    card.className = 'group-card expanded'; // Auto-expand search results
    card.dataset.groupId = group.id;

    // Group header
    const header = document.createElement('div');
    header.className = 'group-header';

    const expand = document.createElement('span');
    expand.className = 'group-expand';
    expand.textContent = '\u25B6'; // Right triangle

    const info = document.createElement('div');
    info.className = 'group-info';

    const name = document.createElement('div');
    name.className = 'group-name';
    name.textContent = group.name;

    const count = document.createElement('div');
    count.className = 'group-count';
    count.textContent = `${matchingTabs.length} of ${group.tabs.length} ${UIHelpers.pluralizeTabs(group.tabs.length)}`;

    info.appendChild(name);
    info.appendChild(count);

    header.appendChild(expand);
    header.appendChild(info);

    header.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    // Group tabs container (only matching tabs)
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'group-tabs';

    matchingTabs.forEach(tab => {
      const tabItem = VaultTabItem.create(tab, group.id);
      tabsContainer.appendChild(tabItem);
    });

    card.appendChild(header);
    card.appendChild(tabsContainer);

    return card;
  }

  // Public API
  return {
    init,
    matchesSearch,
    handleSearch,
    renderSearchResults
  };
})();
