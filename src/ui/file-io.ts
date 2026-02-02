import type { ModeliumModel } from '../model/schema.ts';
import { validateModel, type ValidationResult } from '../model/schema.ts';

/**
 * Downloads the model as a JSON file.
 */
export function downloadJson(model: ModeliumModel, filename = 'modelium-export.json'): void {
  const json = JSON.stringify(model, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a file picker and reads/validates the selected JSON file.
 * Returns a promise that resolves with the validation result.
 */
export function uploadJson(): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ valid: false, error: 'No file selected' });
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);
          resolve(validateModel(json));
        } catch (e) {
          resolve({ valid: false, error: `Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}` });
        }
      };

      reader.onerror = () => {
        resolve({ valid: false, error: 'Failed to read file' });
      };

      reader.readAsText(file);
    };

    input.click();
  });
}
