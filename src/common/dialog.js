// Tab Goblin - Dialog Module
// Unified modal dialog system for confirmations and prompts

/**
 * Show a modal dialog (confirm, prompt, or with checkbox)
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Message to display
 * @param {string} [options.subMessage] - Secondary message (e.g., home tab info)
 * @param {string} [options.confirmText='OK'] - Text for confirm button
 * @param {boolean} [options.showInput=false] - Whether to show input field
 * @param {string} [options.defaultValue=''] - Default input value (if showInput)
 * @param {string} [options.checkboxText] - Checkbox label (if provided, shows checkbox)
 * @returns {Promise<{confirmed: boolean, value?: string, checkboxChecked?: boolean}>}
 */
function showModal(options) {
  const {
    title,
    message,
    subMessage,
    confirmText = 'OK',
    showInput = false,
    defaultValue = '',
    checkboxText
  } = options;

  return new Promise((resolve) => {
    const dialog = document.getElementById('modalDialog');
    const titleEl = document.getElementById('modalDialogTitle');
    const messageEl = document.getElementById('modalDialogMessage');
    const subMessageEl = document.getElementById('modalDialogSubMessage');
    const inputEl = document.getElementById('modalDialogInput');
    const checkboxLabel = document.getElementById('modalDialogCheckboxLabel');
    const checkboxEl = document.getElementById('modalDialogCheckbox');
    const checkboxTextEl = document.getElementById('modalDialogCheckboxText');
    const confirmBtn = document.getElementById('modalDialogConfirm');
    const cancelBtn = document.getElementById('modalDialogCancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;

    // Sub-message (optional)
    if (subMessage) {
      subMessageEl.textContent = subMessage;
      subMessageEl.classList.remove('hidden');
    } else {
      subMessageEl.classList.add('hidden');
    }

    // Input field (optional)
    if (showInput) {
      inputEl.classList.remove('hidden');
      inputEl.value = defaultValue;
    } else {
      inputEl.classList.add('hidden');
    }

    // Checkbox (optional)
    if (checkboxText) {
      checkboxTextEl.textContent = checkboxText;
      checkboxEl.checked = false;
      checkboxLabel.classList.remove('hidden');
    } else {
      checkboxLabel.classList.add('hidden');
    }

    const cleanup = () => {
      dialog.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.querySelector('.confirm-dialog-backdrop').removeEventListener('click', onCancel);
      if (showInput) {
        inputEl.removeEventListener('keydown', onInputKeydown);
      }
      document.removeEventListener('keydown', onKeydown);
    };

    const onConfirm = () => {
      const result = {
        confirmed: true,
        value: showInput ? inputEl.value : undefined,
        checkboxChecked: checkboxText ? checkboxEl.checked : undefined
      };
      cleanup();
      resolve(result);
    };

    const onCancel = () => {
      cleanup();
      resolve({ confirmed: false });
    };

    const onInputKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (!showInput && e.key === 'Enter') {
        onConfirm();
      }
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    dialog.querySelector('.confirm-dialog-backdrop').addEventListener('click', onCancel);
    if (showInput) {
      inputEl.addEventListener('keydown', onInputKeydown);
    }
    document.addEventListener('keydown', onKeydown);

    dialog.classList.remove('hidden');

    if (showInput) {
      inputEl.focus();
      inputEl.select();
    } else {
      confirmBtn.focus();
    }
  });
}

/**
 * Show a themed confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Message to display
 * @param {string} confirmText - Text for confirm button (default: "OK")
 * @returns {Promise<boolean>} - True if confirmed, false if cancelled
 */
async function showModalConfirm(title, message, confirmText = 'OK') {
  const result = await showModal({ title, message, confirmText });
  return result.confirmed;
}

/**
 * Show a themed prompt dialog
 * @param {string} title - Dialog title
 * @param {string} message - Message to display
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} - Input value if confirmed, null if cancelled
 */
async function showModalPrompt(title, message, defaultValue = '') {
  const result = await showModal({ title, message, showInput: true, defaultValue });
  return result.confirmed ? result.value : null;
}

// Export for use in other modules
const Dialog = {
  showModal,
  showModalConfirm,
  showModalPrompt
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Dialog = Dialog;
}
