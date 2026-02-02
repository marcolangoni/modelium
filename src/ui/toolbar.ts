import { getModel, loadModel } from '../graph/cytoscape.ts';
import { downloadJson, uploadJson } from './file-io.ts';

/**
 * Creates and mounts the toolbar with Export, Import, and Run buttons.
 */
export function initToolbar(container: HTMLElement): void {
  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export JSON';
  exportBtn.onclick = () => {
    try {
      const model = getModel();
      downloadJson(model);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. See console for details.');
    }
  };

  // Import button
  const importBtn = document.createElement('button');
  importBtn.textContent = 'Import JSON';
  importBtn.onclick = async () => {
    const result = await uploadJson();
    if (result.valid) {
      loadModel(result.model);
    } else {
      alert(`Import failed: ${result.error}`);
    }
  };

  // Run button (no-op placeholder)
  const runBtn = document.createElement('button');
  runBtn.textContent = 'Run (no-op)';
  runBtn.onclick = () => {
    console.log('[Modelium] Run clicked - simulation not implemented yet');
    console.log('[Modelium] Current model:', getModel());
  };

  container.appendChild(exportBtn);
  container.appendChild(importBtn);
  container.appendChild(runBtn);
}
