import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { ModeliumModel } from '../model/schema.ts';
import { createNodeSparkline } from './sparkline.ts';

let cy: Core | null = null;

// Maximum history length per node
const MAX_HISTORY_LENGTH = 100;

/**
 * Converts a ModeliumModel to Cytoscape elements format.
 */
function modelToElements(model: ModeliumModel): ElementDefinition[] {
  const elements: ElementDefinition[] = [];

  for (const node of model.nodes) {
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        value: node.value,
        min: node.min,
        max: node.max,
      },
    });
  }

  for (const edge of model.edges) {
    elements.push({
      data: {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        weight: edge.weight,
        polarity: edge.polarity,
      },
    });
  }

  return elements;
}

/**
 * Extracts a ModeliumModel from the current Cytoscape graph state.
 */
export function getModel(): ModeliumModel {
  if (!cy) {
    throw new Error('Cytoscape not initialized');
  }

  const nodes = cy.nodes().map((node) => {
    const n: { id: string; label: string; value: number; min?: number; max?: number } = {
      id: node.id(),
      label: node.data('label') as string,
      value: node.data('value') as number,
    };
    const min = node.data('min') as number | undefined;
    const max = node.data('max') as number | undefined;
    if (min !== undefined) n.min = min;
    if (max !== undefined) n.max = max;
    return n;
  });

  const edges = cy.edges().map((edge) => ({
    id: edge.id(),
    from: edge.data('source') as string,
    to: edge.data('target') as string,
    weight: edge.data('weight') as number,
    polarity: edge.data('polarity') as '+' | '-',
  }));

  return {
    version: 1,
    meta: {
      name: 'Exported Model',
      createdAt: new Date().toISOString(),
    },
    nodes,
    edges,
  };
}

/**
 * Replaces the current graph with a new model.
 */
export function loadModel(model: ModeliumModel): void {
  if (!cy) {
    throw new Error('Cytoscape not initialized');
  }

  cy.elements().remove();
  cy.add(modelToElements(model));
  cy.layout({ name: 'grid', padding: 50 }).run();
  cy.fit(undefined, 50);
}

/**
 * Initializes Cytoscape on the given container with the provided model.
 */
export function initGraph(container: HTMLElement, model: ModeliumModel): Core {
  cy = cytoscape({
    container,
    elements: modelToElements(model),
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#4a9eff',
          'label': 'data(label)',
          'color': '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          'width': 60,
          'height': 60,
          'border-width': 2,
          'border-color': '#2a7edf',
          'background-fit': 'contain',
          'background-clip': 'none',
          'background-width': '80%',
          'background-height': '40%',
          'background-position-y': '75%',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#888',
          'target-arrow-color': '#888',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(polarity)',
          'font-size': '14px',
          'color': '#ccc',
          'text-background-color': '#0d0d0d',
          'text-background-opacity': 1,
          'text-background-padding': '2px',
        },
      },
      {
        selector: 'edge[polarity = "+"]',
        style: {
          'line-color': '#4ade80',
          'target-arrow-color': '#4ade80',
        },
      },
      {
        selector: 'edge[polarity = "-"]',
        style: {
          'line-color': '#f87171',
          'target-arrow-color': '#f87171',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#fff',
          'border-width': 3,
        },
      },
      {
        selector: 'node.breached',
        style: {
          'background-color': '#ef4444',
          'border-color': '#dc2626',
        },
      },
    ],
    layout: {
      name: 'grid',
      padding: 50,
    },
    minZoom: 0.2,
    maxZoom: 3,
  });

  // Fit to viewport after initial render
  cy.fit(undefined, 50);

  return cy;
}

/**
 * Updates node values during simulation.
 */
export function updateNodeValues(values: Record<string, number>): void {
  if (!cy) return;

  for (const [nodeId, value] of Object.entries(values)) {
    const node = cy.getElementById(nodeId);
    if (node.length > 0) {
      node.data('value', value);
    }
  }
}

/**
 * Highlights a node as breached (turns red).
 */
export function highlightBreached(nodeId: string): void {
  if (!cy) return;

  const node = cy.getElementById(nodeId);
  if (node.length > 0) {
    node.addClass('breached');
  }
}

/**
 * Resets all nodes to default style (removes breach highlighting).
 */
export function resetHighlights(): void {
  if (!cy) return;

  cy.nodes().removeClass('breached');
}

/**
 * Returns the Cytoscape instance.
 */
export function getCytoscape(): Core | null {
  return cy;
}

/**
 * Appends values to node history for sparkline rendering.
 */
export function appendNodeHistory(values: Record<string, number>): void {
  if (!cy) return;

  for (const [nodeId, value] of Object.entries(values)) {
    const node = cy.getElementById(nodeId);
    if (node.length > 0) {
      const history: number[] = node.data('history') || [];
      history.push(value);
      
      // Limit history length
      if (history.length > MAX_HISTORY_LENGTH) {
        history.shift();
      }
      
      node.data('history', history);
      
      // Update sparkline image
      const sparklineUrl = createNodeSparkline(history);
      if (sparklineUrl) {
        node.style('background-image', sparklineUrl);
      }
    }
  }
}

/**
 * Clears all node history (sparklines).
 */
export function clearNodeHistory(): void {
  if (!cy) return;

  cy.nodes().forEach((node) => {
    node.data('history', []);
    node.style('background-image', 'none');
  });
}
