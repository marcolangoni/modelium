import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { ModeliumModel } from '../model/schema.ts';

let cy: Core | null = null;

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

  const nodes = cy.nodes().map((node) => ({
    id: node.id(),
    label: node.data('label') as string,
    value: node.data('value') as number,
  }));

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
