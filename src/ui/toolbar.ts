import {
  getModel,
  loadModel,
  updateNodeValues,
  highlightBreached,
  resetHighlights,
  appendNodeHistory,
  clearNodeHistory,
  getCytoscape,
  setNodeBreakpoint,
  clearAllNodeBreakpoints,
  highlightBreakpointHit,
  clearBreakpointHitHighlight,
} from '../graph/cytoscape.ts';
import { disableEditing, enableEditing } from '../graph/interactions.ts';
import { downloadJson, uploadJson } from './file-io.ts';
import { createSimController, type SimController, type SimStatus } from './sim-controls.ts';
import { createBreakpointManager, type BreakpointManager } from './breakpoints.ts';
import { initKeyboardShortcuts, getSpeedLabel, type KeyboardHandler } from './keyboard.ts';
import { initContextMenu } from './context-menu.ts';

let simController: SimController | null = null;
let breakpointManager: BreakpointManager | null = null;
let keyboardHandler: KeyboardHandler | null = null;

// Module-level speed tracking (works before simulation starts)
const DEFAULT_INTERVAL_MS = 16;
let currentIntervalMs = DEFAULT_INTERVAL_MS;

// Callback for speed changes (for persistence)
let onSpeedChangeCallback: (() => void) | null = null;

// UI elements that need to be accessed from callbacks
let speedSpan: HTMLSpanElement | null = null;
let stepBtn: HTMLButtonElement | null = null;
let clearBreakpointsBtn: HTMLButtonElement | null = null;

/**
 * Sets the callback to be called when speed changes.
 */
export function setOnSpeedChangeCallback(callback: () => void): void {
  onSpeedChangeCallback = callback;
}

/**
 * Returns the current speed interval in milliseconds.
 */
export function getCurrentIntervalMs(): number {
  return currentIntervalMs;
}

/**
 * Sets the speed interval in milliseconds.
 * Updates both the module-level state and the simController if running.
 */
export function setCurrentIntervalMs(intervalMs: number): void {
  currentIntervalMs = intervalMs;
  if (simController) {
    simController.setSpeed(intervalMs);
  }
  if (speedSpan) {
    speedSpan.textContent = getSpeedLabel(intervalMs);
  }
  onSpeedChangeCallback?.();
}

/**
 * Creates and mounts the toolbar with Export, Import, and simulation controls.
 */
export function initToolbar(container: HTMLElement): void {
  // Initialize breakpoint manager
  breakpointManager = createBreakpointManager();

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
      clearAllNodeBreakpoints();
      breakpointManager?.removeAll();
      loadModel(result.model);
    } else {
      alert(`Import failed: ${result.error}`);
    }
  };

  // Separator
  const separator1 = document.createElement('span');
  separator1.className = 'toolbar-separator';

  // Play button
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.title = 'Start simulation (Space to toggle)';
  playBtn.onclick = () => {
    if (!simController) {
      simController = createSimController(getModel, currentIntervalMs);
      setupSimCallbacks(simController, playBtn, pauseBtn, resetBtn, statusSpan);
    }

    const status = simController.getStatus();
    if (status === 'paused') {
      clearBreakpointHitHighlight();
      simController.resume();
    } else {
      resetHighlights();
      clearNodeHistory();
      clearBreakpointHitHighlight();
      // Send current breakpoints to the controller
      if (breakpointManager) {
        simController.setBreakpoints(breakpointManager.getAll());
      }
      simController.start();
    }
  };

  // Pause button
  const pauseBtn = document.createElement('button');
  pauseBtn.textContent = 'Pause';
  pauseBtn.title = 'Pause simulation (Space)';
  pauseBtn.style.display = 'none';
  pauseBtn.onclick = () => {
    simController?.pause();
  };

  // Step button
  stepBtn = document.createElement('button');
  stepBtn.textContent = 'Step';
  stepBtn.title = 'Execute single step (S or N)';
  stepBtn.style.display = 'none';
  stepBtn.onclick = () => {
    if (!simController) {
      simController = createSimController(getModel, currentIntervalMs);
      setupSimCallbacks(simController, playBtn, pauseBtn, resetBtn, statusSpan);
      // Initialize only, don't start running
      simController.init();
      // Send breakpoints to the controller
      if (breakpointManager) {
        simController.setBreakpoints(breakpointManager.getAll());
      }
    }
    clearBreakpointHitHighlight();
    simController.step();
  };

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  resetBtn.title = 'Reset simulation';
  resetBtn.disabled = true;
  resetBtn.onclick = () => {
    if (simController) {
      simController.reset();
      resetHighlights();
      clearNodeHistory();
      clearBreakpointHitHighlight();
      // Reload the original model to restore initial values
      loadModel(getModel());
    }
  };

  // Separator
  const separator2 = document.createElement('span');
  separator2.className = 'toolbar-separator';

  // Speed indicator
  speedSpan = document.createElement('span');
  speedSpan.className = 'speed-indicator';
  speedSpan.textContent = '1x';
  speedSpan.title = 'Simulation speed (use [ ] or - + to adjust)';

  // Speed down button
  const speedDownBtn = document.createElement('button');
  speedDownBtn.textContent = '-';
  speedDownBtn.className = 'speed-btn';
  speedDownBtn.title = 'Halve speed ([ or -)';
  speedDownBtn.onclick = () => {
    const newInterval = Math.min(currentIntervalMs * 2, 512);
    setCurrentIntervalMs(newInterval);
  };

  // Speed up button
  const speedUpBtn = document.createElement('button');
  speedUpBtn.textContent = '+';
  speedUpBtn.className = 'speed-btn';
  speedUpBtn.title = 'Double speed (] or +)';
  speedUpBtn.onclick = () => {
    const newInterval = Math.max(currentIntervalMs / 2, 4);
    setCurrentIntervalMs(newInterval);
  };

  // Separator
  const separator3 = document.createElement('span');
  separator3.className = 'toolbar-separator';

  // Clear breakpoints button
  clearBreakpointsBtn = document.createElement('button');
  clearBreakpointsBtn.textContent = 'Clear Breakpoints';
  clearBreakpointsBtn.className = 'secondary';
  clearBreakpointsBtn.title = 'Remove all breakpoints';
  clearBreakpointsBtn.style.display = 'none';
  clearBreakpointsBtn.onclick = () => {
    breakpointManager?.removeAll();
  };

  // Status indicator
  const statusSpan = document.createElement('span');
  statusSpan.className = 'status';
  statusSpan.textContent = '';

  // Append elements
  container.appendChild(exportBtn);
  container.appendChild(importBtn);
  container.appendChild(separator1);
  container.appendChild(playBtn);
  container.appendChild(pauseBtn);
  container.appendChild(stepBtn);
  container.appendChild(resetBtn);
  container.appendChild(separator2);
  container.appendChild(speedDownBtn);
  container.appendChild(speedSpan);
  container.appendChild(speedUpBtn);
  container.appendChild(separator3);
  container.appendChild(clearBreakpointsBtn);
  container.appendChild(statusSpan);

  // Setup breakpoint manager callbacks
  breakpointManager.onChange((breakpoints) => {
    // Update node visuals
    clearAllNodeBreakpoints();
    for (const bp of breakpoints) {
      setNodeBreakpoint(bp.nodeId);
    }

    // Update SimController if running
    if (simController) {
      simController.setBreakpoints(breakpoints);
    }

    // Show/hide clear breakpoints button
    if (clearBreakpointsBtn) {
      clearBreakpointsBtn.style.display = breakpoints.length > 0 ? '' : 'none';
    }
  });

  // Initialize context menu for breakpoints
  const cy = getCytoscape();
  if (cy) {
    initContextMenu({ cy, breakpointManager });
  }

  // Initialize keyboard shortcuts
  keyboardHandler = initKeyboardShortcuts(
    () => simController,
    (_intervalMs, label) => {
      if (speedSpan) speedSpan.textContent = label;
    },
    () => currentIntervalMs,
    setCurrentIntervalMs
  );
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
    appendNodeHistory(snapshot.values);
  });

  controller.onStatusChange((status, breach) => {
    updateButtonStates(status, playBtn, pauseBtn, resetBtn, statusSpan, breach?.nodeId);
    // Save state when simulation stops (paused or done)
    if (status === 'paused' || status === 'done') {
      onSpeedChangeCallback?.();
    }
  });

  controller.onBreakpointHit((hit) => {
    highlightBreakpointHit(hit.breakpoint.nodeId);
    if (statusSpan) {
      const conditionLabel = getConditionLabel(hit.breakpoint.condition);
      statusSpan.textContent = `Breakpoint: ${hit.breakpoint.nodeId} ${conditionLabel} ${hit.breakpoint.value} (actual: ${hit.actualValue.toFixed(2)})`;
      statusSpan.className = 'status breakpoint';
    }
  });
}

function getConditionLabel(condition: string): string {
  switch (condition) {
    case 'eq': return '=';
    case 'gt': return '>';
    case 'lt': return '<';
    case 'gte': return '>=';
    case 'lte': return '<=';
    default: return condition;
  }
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
      if (stepBtn) stepBtn.style.display = '';
      resetBtn.disabled = true;
      statusSpan.textContent = '';
      enableEditing();
      break;

    case 'running':
      playBtn.style.display = 'none';
      pauseBtn.style.display = '';
      if (stepBtn) stepBtn.style.display = 'none';
      resetBtn.disabled = false;
      statusSpan.textContent = 'Running...';
      statusSpan.className = 'status running';
      disableEditing();
      break;

    case 'paused':
      playBtn.textContent = 'Resume';
      playBtn.style.display = '';
      pauseBtn.style.display = 'none';
      if (stepBtn) stepBtn.style.display = '';
      resetBtn.disabled = false;
      if (breachedNodeId) {
        highlightBreached(breachedNodeId);
        statusSpan.textContent = `Paused: ${breachedNodeId} hit limit`;
      } else {
        statusSpan.textContent = 'Paused';
      }
      statusSpan.className = 'status paused';
      disableEditing();
      break;

    case 'done':
      playBtn.textContent = 'Play';
      playBtn.style.display = '';
      pauseBtn.style.display = 'none';
      if (stepBtn) stepBtn.style.display = 'none';
      resetBtn.disabled = false;
      statusSpan.textContent = 'Done';
      statusSpan.className = 'status';
      enableEditing();
      break;
  }
}

/**
 * Returns the breakpoint manager instance.
 */
export function getBreakpointManager(): BreakpointManager | null {
  return breakpointManager;
}

/**
 * Disposes of the toolbar resources.
 */
export function disposeToolbar(): void {
  keyboardHandler?.dispose();
  simController?.dispose();
}
