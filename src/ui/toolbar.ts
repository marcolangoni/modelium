import { getModel, loadModel, updateNodeValues, highlightBreached, resetHighlights } from '../graph/cytoscape.ts';
import { downloadJson, uploadJson } from './file-io.ts';
import { createSimController, type SimController, type SimStatus } from './sim-controls.ts';

let simController: SimController | null = null;

/**
 * Creates and mounts the toolbar with Export, Import, and simulation controls.
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
      // Reset simulation if running
      if (simController) {
        simController.reset();
      }
      resetHighlights();
      loadModel(result.model);
    } else {
      alert(`Import failed: ${result.error}`);
    }
  };

  // Play button
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.onclick = () => {
    if (!simController) {
      simController = createSimController(getModel);
      setupSimCallbacks(simController, playBtn, pauseBtn, resetBtn, statusSpan);
    }

    const status = simController.getStatus();
    if (status === 'paused') {
      simController.resume();
    } else {
      resetHighlights();
      simController.start();
    }
  };

  // Pause button
  const pauseBtn = document.createElement('button');
  pauseBtn.textContent = 'Pause';
  pauseBtn.style.display = 'none';
  pauseBtn.onclick = () => {
    simController?.pause();
  };

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  resetBtn.disabled = true;
  resetBtn.onclick = () => {
    if (simController) {
      simController.reset();
      resetHighlights();
      // Reload the original model to restore initial values
      loadModel(getModel());
    }
  };

  // Status indicator
  const statusSpan = document.createElement('span');
  statusSpan.className = 'status';
  statusSpan.textContent = '';

  container.appendChild(exportBtn);
  container.appendChild(importBtn);
  container.appendChild(playBtn);
  container.appendChild(pauseBtn);
  container.appendChild(resetBtn);
  container.appendChild(statusSpan);
}

function setupSimCallbacks(
  controller: SimController,
  playBtn: HTMLButtonElement,
  pauseBtn: HTMLButtonElement,
  resetBtn: HTMLButtonElement,
  statusSpan: HTMLSpanElement
): void {
  controller.onStateChange((snapshot) => {
    updateNodeValues(snapshot.values);
  });

  controller.onStatusChange((status, breach) => {
    updateButtonStates(status, playBtn, pauseBtn, resetBtn, statusSpan, breach?.nodeId);
  });
}

function updateButtonStates(
  status: SimStatus,
  playBtn: HTMLButtonElement,
  pauseBtn: HTMLButtonElement,
  resetBtn: HTMLButtonElement,
  statusSpan: HTMLSpanElement,
  breachedNodeId?: string
): void {
  // Reset class names
  statusSpan.className = 'status';

  switch (status) {
    case 'idle':
      playBtn.textContent = 'Play';
      playBtn.style.display = '';
      pauseBtn.style.display = 'none';
      resetBtn.disabled = true;
      statusSpan.textContent = '';
      break;

    case 'running':
      playBtn.style.display = 'none';
      pauseBtn.style.display = '';
      resetBtn.disabled = false;
      statusSpan.textContent = 'Running...';
      statusSpan.className = 'status running';
      break;

    case 'paused':
      playBtn.textContent = 'Resume';
      playBtn.style.display = '';
      pauseBtn.style.display = 'none';
      resetBtn.disabled = false;
      if (breachedNodeId) {
        highlightBreached(breachedNodeId);
        statusSpan.textContent = `Paused: ${breachedNodeId} hit limit`;
      } else {
        statusSpan.textContent = 'Paused';
      }
      statusSpan.className = 'status paused';
      break;

    case 'done':
      playBtn.textContent = 'Play';
      playBtn.style.display = '';
      pauseBtn.style.display = 'none';
      resetBtn.disabled = false;
      statusSpan.textContent = 'Done';
      statusSpan.className = 'status';
      break;
  }
}
