/**
 * Reusable modal dialog for editing node/edge properties.
 */

export interface ModalField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  value: string | number;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

export interface ModalConfig {
  title: string;
  fields: ModalField[];
  onSave: (values: Record<string, string | number | undefined>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

let currentOverlay: HTMLElement | null = null;

/**
 * Shows a modal dialog with the given configuration.
 */
export function showModal(config: ModalConfig): void {
  // Remove any existing modal
  hideModal();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'modal';

  // Title
  const title = document.createElement('h2');
  title.textContent = config.title;
  modal.appendChild(title);

  // Fields
  const fieldElements: Map<string, HTMLInputElement | HTMLSelectElement> = new Map();

  for (const field of config.fields) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'modal-field';

    const label = document.createElement('label');
    label.textContent = field.label + (field.required ? ' *' : '');
    label.htmlFor = `modal-field-${field.key}`;
    fieldDiv.appendChild(label);

    if (field.type === 'select' && field.options) {
      const select = document.createElement('select');
      select.id = `modal-field-${field.key}`;
      for (const opt of field.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === String(field.value)) {
          option.selected = true;
        }
        select.appendChild(option);
      }
      fieldDiv.appendChild(select);
      fieldElements.set(field.key, select);
    } else {
      const input = document.createElement('input');
      input.id = `modal-field-${field.key}`;
      input.type = field.type === 'number' ? 'number' : 'text';
      input.value = field.value === '' ? '' : String(field.value);
      if (field.type === 'number') {
        input.step = 'any';
      }
      if (field.required) {
        input.required = true;
      }
      fieldDiv.appendChild(input);
      fieldElements.set(field.key, input);
    }

    modal.appendChild(fieldDiv);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  // Delete button (if provided)
  if (config.onDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      hideModal();
      config.onDelete?.();
    };
    actions.appendChild(deleteBtn);
  }

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    hideModal();
    config.onCancel?.();
  };
  actions.appendChild(cancelBtn);

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'save';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = () => {
    // Validate required fields
    for (const field of config.fields) {
      if (field.required) {
        const el = fieldElements.get(field.key);
        if (el && !el.value.trim()) {
          el.focus();
          return;
        }
      }
    }

    // Collect values
    const values: Record<string, string | number | undefined> = {};
    for (const field of config.fields) {
      const el = fieldElements.get(field.key);
      if (el) {
        const rawValue = el.value.trim();
        if (field.type === 'number') {
          if (rawValue === '') {
            values[field.key] = undefined;
          } else {
            values[field.key] = parseFloat(rawValue);
          }
        } else {
          values[field.key] = rawValue;
        }
      }
    }

    hideModal();
    config.onSave(values);
  };
  actions.appendChild(saveBtn);

  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  currentOverlay = overlay;

  // Focus first input
  const firstInput = fieldElements.values().next().value;
  if (firstInput) {
    firstInput.focus();
    if (firstInput instanceof HTMLInputElement) {
      firstInput.select();
    }
  }

  // Close on Escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideModal();
      config.onCancel?.();
    } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      saveBtn.click();
    }
  };
  overlay.addEventListener('keydown', handleKeydown);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideModal();
      config.onCancel?.();
    }
  });
}

/**
 * Hides the current modal.
 */
export function hideModal(): void {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
}
