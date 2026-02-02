/**
 * Modelium - Main Entry Point
 */

import { initGraph, getCytoscape, getModel, getPositions } from './graph/cytoscape.ts';
import { initInteractions, setOnChangeCallback } from './graph/interactions.ts';
import { seedModel } from './model/seed.ts';
import { initToolbar, setCurrentIntervalMs, getCurrentIntervalMs, setOnSpeedChangeCallback } from './ui/toolbar.ts';
import { loadState, saveState } from './storage/persistence.ts';

/**
 * Saves the current state to localStorage.
 */
function persistState(): void {
  try {
    const model = getModel();
    const positions = getPositions();
    const speedIntervalMs = getCurrentIntervalMs();
    saveState(model, positions, speedIntervalMs);
  } catch (e) {
    console.warn('[Modelium] Failed to persist state:', e);
  }
}

function main(): void {
  // Get DOM containers
  const cyContainer = document.getElementById('cy');
  const toolbarContainer = document.getElementById('toolbar');

  if (!cyContainer) {
    throw new Error('Missing #cy container element');
  }

  if (!toolbarContainer) {
    throw new Error('Missing #toolbar container element');
  }

  // Try to load persisted state, fall back to seed model
  const savedState = loadState();
  
  if (savedState) {
    console.log('[Modelium] Loading saved state from', savedState.savedAt);
    // Initialize with saved model and positions
    initGraph(cyContainer, savedState.model, savedState.positions);
  } else {
    console.log('[Modelium] No saved state, using seed model');
    // Initialize with default seed model
    initGraph(cyContainer, seedModel);
  }

  // Initialize graph interactions (editing)
  const cy = getCytoscape();
  if (cy) {
    initInteractions(cy);
  }

  // Set up persistence callback for graph changes
  setOnChangeCallback(persistState);

  // Initialize toolbar
  initToolbar(toolbarContainer);

  // Set up persistence callback for speed changes
  setOnSpeedChangeCallback(persistState);

  // Apply saved speed after toolbar is initialized
  if (savedState) {
    setCurrentIntervalMs(savedState.speedIntervalMs);
  }

  console.log('[Modelium] App initialized');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
