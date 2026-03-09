// Tab Goblin - Drag and Drop Handler Module
// Handles all drag-and-drop operations for vault tabs and groups

const DragDrop = (function() {
  // Drag state
  let draggedItem = null;
  let draggedTabId = null;
  let draggedGroupId = null;
  let isDraggingGroup = false;

  // Callback for re-rendering vault after changes
  let _onVaultChange = null;

  /**
   * Initialize the module with callbacks
   * @param {Object} options - { onVaultChange }
   */
  function init(options) {
    _onVaultChange = options?.onVaultChange || null;
  }

  /**
   * Clear all drag-related CSS classes
   */
  function clearDragStyles() {
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.drop-above').forEach(el => el.classList.remove('drop-above'));
    document.querySelectorAll('.drop-below').forEach(el => el.classList.remove('drop-below'));
  }

  /**
   * Handle drag start on a tab item
   */
  function handleDragStart(e) {
    e.stopPropagation();

    draggedItem = e.target.closest('.tab-item');
    if (!draggedItem) return;

    isDraggingGroup = false;
    draggedTabId = draggedItem.dataset.tabId;
    draggedGroupId = draggedItem.dataset.groupId;

    draggedItem.classList.add('dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'tab',
      tabId: draggedTabId,
      groupId: draggedGroupId
    }));
  }

  /**
   * Handle drag end (cleanup)
   */
  function handleDragEnd(e) {
    e.stopPropagation();

    if (draggedItem) {
      draggedItem.classList.remove('dragging');
    }

    clearDragStyles();

    draggedItem = null;
    draggedTabId = null;
    draggedGroupId = null;
    isDraggingGroup = false;
  }

  /**
   * Handle drag over a tab item
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.tab-item');
    if (!target || target === draggedItem) return;

    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });

    target.classList.add('drop-target');
  }

  /**
   * Handle drop on a tab item
   */
  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target.closest('.tab-item');
    if (!target || target === draggedItem) return;

    const targetGroupId = target.dataset.groupId;
    const targetTabId = target.dataset.tabId;

    target.classList.remove('drop-target');

    await moveTabToPosition(draggedGroupId, draggedTabId, targetGroupId, targetTabId);
  }

  /**
   * Handle drag over a group card
   */
  function handleGroupDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const card = e.target.closest('.group-card');
    if (!card) return;

    const targetGroupId = card.dataset.groupId;

    document.querySelectorAll('.drop-above, .drop-below').forEach(el => {
      el.classList.remove('drop-above', 'drop-below');
    });

    if (isDraggingGroup) {
      if (targetGroupId === draggedGroupId) return;

      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;

      if (e.clientY < midpoint) {
        card.classList.add('drop-above');
        card.classList.remove('drop-below');
      } else {
        card.classList.add('drop-below');
        card.classList.remove('drop-above');
      }
    } else {
      if (targetGroupId === draggedGroupId) return;
      card.classList.add('drag-over');
    }
  }

  /**
   * Handle drag leave from a group card
   */
  function handleGroupDragLeave(e) {
    const card = e.target.closest('.group-card');
    if (!card) return;

    const relatedTarget = e.relatedTarget;
    if (relatedTarget && card.contains(relatedTarget)) return;

    card.classList.remove('drag-over', 'drop-above', 'drop-below');
  }

  /**
   * Handle drop on a group card
   */
  async function handleGroupDrop(e) {
    e.preventDefault();

    const card = e.target.closest('.group-card');
    if (!card) return;

    const targetGroupId = card.dataset.groupId;
    const wasDropAbove = card.classList.contains('drop-above');

    card.classList.remove('drag-over', 'drop-above', 'drop-below');

    if (isDraggingGroup) {
      if (targetGroupId === draggedGroupId) return;
      await reorderGroup(draggedGroupId, targetGroupId, wasDropAbove);
    } else {
      if (targetGroupId === draggedGroupId) return;
      await moveTabToGroup(draggedGroupId, draggedTabId, targetGroupId);
    }
  }

  /**
   * Move a tab to a specific position
   */
  async function moveTabToPosition(sourceGroupId, tabId, targetGroupId, beforeTabId) {
    const result = await VaultStorage.moveTab(sourceGroupId, tabId, targetGroupId, beforeTabId);

    if (!result.success) return;

    if (result.sourceRemoved) {
      State.setVaultGroupExpanded(sourceGroupId, false);
    }

    State.setVaultGroupExpanded(targetGroupId, true);

    if (_onVaultChange) await _onVaultChange();
    UIHelpers.showToast('Tab moved', 'success');
  }

  /**
   * Move a tab to a different group (at the end)
   */
  async function moveTabToGroup(sourceGroupId, tabId, targetGroupId) {
    const result = await VaultStorage.moveTab(sourceGroupId, tabId, targetGroupId, null);

    if (!result.success) return;

    if (result.sourceRemoved) {
      State.setVaultGroupExpanded(sourceGroupId, false);
    }

    State.setVaultGroupExpanded(targetGroupId, true);

    if (_onVaultChange) await _onVaultChange();
    UIHelpers.showToast('Tab moved', 'success');
  }

  /**
   * Handle drag start for group reordering
   */
  function handleGroupReorderDragStart(e) {
    const card = e.target.closest('.group-card');
    if (!card) return;

    isDraggingGroup = true;
    draggedItem = card;
    draggedGroupId = card.dataset.groupId;

    card.classList.add('dragging-group');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'group',
      groupId: draggedGroupId
    }));
  }

  /**
   * Handle drag end for group reordering
   */
  function handleGroupReorderDragEnd(e) {
    if (draggedItem) {
      draggedItem.classList.remove('dragging-group');
    }

    clearDragStyles();

    draggedItem = null;
    draggedTabId = null;
    draggedGroupId = null;
    isDraggingGroup = false;
  }

  /**
   * Reorder a group to a new position
   */
  async function reorderGroup(sourceGroupId, targetGroupId, insertBefore) {
    const success = await VaultStorage.moveGroup(sourceGroupId, targetGroupId, insertBefore);

    if (!success) return;

    if (_onVaultChange) await _onVaultChange();
    UIHelpers.showToast('Group reordered', 'success');
  }

  // Public API
  return {
    init,
    clearDragStyles,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleGroupDragOver,
    handleGroupDragLeave,
    handleGroupDrop,
    handleGroupReorderDragStart,
    handleGroupReorderDragEnd
  };
})();
