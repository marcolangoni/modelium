/**
 * Modelium - Main Entry Point
 */

import { initGraph, getCytoscape } from './graph/cytoscape.ts';
import { initInteractions } from './graph/interactions.ts';
import { seedModel } from './model/seed.ts';
import { initToolbar } from './ui/toolbar.ts';

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

  // Initialize Cytoscape graph with seed model
  initGraph(cyContainer, seedModel);

  // Initialize graph interactions (editing)
  const cy = getCytoscape();
  if (cy) {
    initInteractions(cy);
  }

  // Initialize toolbar
  initToolbar(toolbarContainer);

  console.log('[Modelium] App initialized');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
