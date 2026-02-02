import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { ModeliumModel, ModeliumNode, NodeType, EventType } from '../model/schema.ts';
import { createNodeSparkline } from './sparkline.ts';

let cy: Core | null = null;

// Maximum history length per node
const MAX_HISTORY_LENGTH = 100;

// Color constants for value-based node coloring
const COLOR_MIN = '#4a9eff';    // Blue - at min value
const COLOR_MID = '#fbbf24';    // Yellow - at midpoint
const COLOR_MAX = '#ef4444';    // Red - at max value

// Event node colors
const COLOR_RANDOM_EVENT = '#a855f7';    // Purple - random events
const COLOR_RANDOM_EVENT_BORDER = '#9333ea';
const COLOR_FIXED_EVENT = '#f59e0b';     // Amber - fixed events
const COLOR_FIXED_EVENT_BORDER = '#d97706';

/**
 * SVG icon for random events (lightning bolt).
 */
const RANDOM_EVENT_ICON = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" opacity="0.3">
  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
</svg>
`)}`;

/**
 * SVG icon for fixed interval events (clock).
 */
const FIXED_EVENT_ICON = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" opacity="0.3">
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 6v6l4 2"/>
</svg>
`)}`;

/**
 * Formats a numeric value to fit inside a node.
 * Uses 2-4 decimal places based on magnitude.
 */
function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

/**
 * Computes the multi-line label for a node.
 * Format: label\nvalue\n[min - max] or interval info for events
 */
function computeNodeLabel(
  label: string,
  value: number,
  min: number | undefined,
  max: number | undefined,
  nodeType?: string,
  eventType?: string,
  interval?: number,
  intervalMin?: number,
  intervalMax?: number
): string {
  const lines: string[] = [label, formatValue(value)];
  
  // For event nodes, show interval info instead of min/max bounds
  if (nodeType === 'event') {
    if (eventType === 'random' && (intervalMin !== undefined || intervalMax !== undefined)) {
      const minStr = intervalMin !== undefined ? String(intervalMin) : '1';
      const maxStr = intervalMax !== undefined ? String(intervalMax) : minStr;
      lines.push(`[${minStr}-${maxStr} steps]`);
    } else if (eventType === 'fixed' && interval !== undefined) {
      lines.push(`[every ${interval}]`);
    }
  } else {
    // Regular nodes: show bounds line if min or max is defined
    if (min !== undefined || max !== undefined) {
      const minStr = min !== undefined ? formatValue(min) : '';
      const maxStr = max !== undefined ? formatValue(max) : '';
      lines.push(`[${minStr} - ${maxStr}]`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Parses a hex color string to RGB components.
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  };
}

/**
 * Converts RGB components to a hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Interpolates between two hex colors.
 * @param color1 Starting color (hex)
 * @param color2 Ending color (hex)
 * @param t Interpolation factor (0 to 1)
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

/**
 * Darkens a hex color by a given factor.
 */
function darkenColor(hex: string, factor: number): string {
  const c = parseHex(hex);
  return rgbToHex(
    c.r * (1 - factor),
    c.g * (1 - factor),
    c.b * (1 - factor)
  );
}

/**
 * Calculates node color based on where the value falls between min and max.
 * Blue (min) -> Yellow (mid) -> Red (max)
 */
function calculateNodeColor(value: number, min: number | undefined, max: number | undefined): string {
  // If min or max not defined, return default blue
  if (min === undefined || max === undefined) return COLOR_MIN;

  const range = max - min;
  if (range <= 0) return COLOR_MIN;

  // Calculate ratio (0 to 1) and clamp
  const ratio = (value - min) / range;
  const clamped = Math.max(0, Math.min(1, ratio));

  // Interpolate: blue (0) -> yellow (0.5) -> red (1)
  if (clamped <= 0.5) {
    const t = clamped * 2;
    return interpolateColor(COLOR_MIN, COLOR_MID, t);
  } else {
    const t = (clamped - 0.5) * 2;
    return interpolateColor(COLOR_MID, COLOR_MAX, t);
  }
}

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
        // Event node fields
        nodeType: node.nodeType,
        eventType: node.eventType,
        intervalMin: node.intervalMin,
        intervalMax: node.intervalMax,
        interval: node.interval,
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

  const nodes: ModeliumNode[] = cy.nodes().map((node) => {
    const n: ModeliumNode = {
      id: node.id(),
      label: node.data('label') as string,
      value: node.data('value') as number,
    };

    const nodeType = node.data('nodeType') as NodeType | undefined;
    if (nodeType && nodeType !== 'regular') {
      n.nodeType = nodeType;
    }

    if (nodeType === 'event') {
      const eventType = node.data('eventType') as EventType | undefined;
      if (eventType) n.eventType = eventType;

      if (eventType === 'random') {
        const intervalMin = node.data('intervalMin') as number | undefined;
        const intervalMax = node.data('intervalMax') as number | undefined;
        if (intervalMin !== undefined) n.intervalMin = intervalMin;
        if (intervalMax !== undefined) n.intervalMax = intervalMax;
      } else if (eventType === 'fixed') {
        const interval = node.data('interval') as number | undefined;
        if (interval !== undefined) n.interval = interval;
      }
    } else {
      // Regular node fields
      const min = node.data('min') as number | undefined;
      const max = node.data('max') as number | undefined;
      if (min !== undefined) n.min = min;
      if (max !== undefined) n.max = max;
    }

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
 * Optionally applies saved positions.
 */
export function loadModel(model: ModeliumModel, positions?: Record<string, { x: number; y: number }>): void {
  if (!cy) {
    throw new Error('Cytoscape not initialized');
  }

  cy.elements().remove();
  cy.add(modelToElements(model));

  // Apply saved positions if provided
  if (positions) {
    for (const [nodeId, pos] of Object.entries(positions)) {
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        node.position(pos);
      }
    }
    cy.fit(undefined, 50);
  } else {
    cy.layout({ name: 'grid', padding: 50 }).run();
    cy.fit(undefined, 50);
  }
}

/**
 * Returns the current positions of all nodes.
 */
export function getPositions(): Record<string, { x: number; y: number }> {
  if (!cy) {
    return {};
  }

  const positions: Record<string, { x: number; y: number }> = {};
  cy.nodes().forEach((node) => {
    const pos = node.position();
    positions[node.id()] = { x: pos.x, y: pos.y };
  });
  return positions;
}

/**
 * Initializes Cytoscape on the given container with the provided model.
 * Optionally applies saved positions.
 */
export function initGraph(
  container: HTMLElement,
  model: ModeliumModel,
  positions?: Record<string, { x: number; y: number }>
): Core {
  cy = cytoscape({
    container,
    elements: modelToElements(model),
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#4a9eff',
          'label': (node: cytoscape.NodeSingular) => {
            const label = node.data('label') as string || '';
            const value = node.data('value') as number ?? 0;
            const min = node.data('min') as number | undefined;
            const max = node.data('max') as number | undefined;
            const nodeType = node.data('nodeType') as string | undefined;
            const eventType = node.data('eventType') as string | undefined;
            const interval = node.data('interval') as number | undefined;
            const intervalMin = node.data('intervalMin') as number | undefined;
            const intervalMax = node.data('intervalMax') as number | undefined;
            return computeNodeLabel(label, value, min, max, nodeType, eventType, interval, intervalMin, intervalMax);
          },
          'color': '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'text-wrap': 'wrap',
          'text-max-width': '70px',
          'width': 80,
          'height': 80,
          'border-width': 2,
          'border-color': '#2a7edf',
          'background-fit': 'contain',
          'background-clip': 'node',
          'background-width': '80%',
          'background-height': '30%',
          'background-position-y': '85%',
          'transition-property': 'background-color, border-color',
          'transition-duration': 150,
        },
      },
      // Random event nodes - purple diamond with lightning bolt
      {
        selector: 'node[nodeType = "event"][eventType = "random"]',
        style: {
          'shape': 'diamond',
          'background-color': COLOR_RANDOM_EVENT,
          'border-color': COLOR_RANDOM_EVENT_BORDER,
          'background-image': RANDOM_EVENT_ICON,
          'background-fit': 'contain',
          'background-width': '50%',
          'background-height': '50%',
          'background-position-x': '50%',
          'background-position-y': '50%',
        } as cytoscape.Css.Node,
      },
      // Fixed interval event nodes - amber diamond with clock
      {
        selector: 'node[nodeType = "event"][eventType = "fixed"]',
        style: {
          'shape': 'diamond',
          'background-color': COLOR_FIXED_EVENT,
          'border-color': COLOR_FIXED_EVENT_BORDER,
          'background-image': FIXED_EVENT_ICON,
          'background-fit': 'contain',
          'background-width': '50%',
          'background-height': '50%',
          'background-position-x': '50%',
          'background-position-y': '50%',
        } as cytoscape.Css.Node,
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
      {
        selector: 'node.hasBreakpoint',
        style: {
          'border-color': '#f59e0b',
          'border-width': 4,
          'border-opacity': 0.8,
        } as cytoscape.Css.Node,
      },
      {
        selector: 'node.breakpointHit',
        style: {
          'border-color': '#f59e0b',
          'border-width': 4,
          'border-style': 'solid',
          'background-color': '#fbbf24',
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

  // Apply saved positions if provided
  if (positions) {
    for (const [nodeId, pos] of Object.entries(positions)) {
      const node = cy.getElementById(nodeId);
      if (node.length > 0) {
        node.position(pos);
      }
    }
  }

  // Fit to viewport after initial render
  cy.fit(undefined, 50);

  return cy;
}

/**
 * Updates node values during simulation and applies value-based coloring.
 */
export function updateNodeValues(values: Record<string, number>): void {
  if (!cy) return;

  for (const [nodeId, value] of Object.entries(values)) {
    const node = cy.getElementById(nodeId);
    if (node.length > 0) {
      node.data('value', value);

      const nodeType = node.data('nodeType') as string | undefined;
      const eventType = node.data('eventType') as string | undefined;

      // Apply value-based coloring only for regular nodes
      if (nodeType !== 'event') {
        const min = node.data('min') as number | undefined;
        const max = node.data('max') as number | undefined;
        const bgColor = calculateNodeColor(value, min, max);
        const borderColor = darkenColor(bgColor, 0.2);

        node.style('background-color', bgColor);
        node.style('border-color', borderColor);
      }

      // Refresh label to show updated value
      const label = node.data('label') as string || '';
      const min = node.data('min') as number | undefined;
      const max = node.data('max') as number | undefined;
      const interval = node.data('interval') as number | undefined;
      const intervalMin = node.data('intervalMin') as number | undefined;
      const intervalMax = node.data('intervalMax') as number | undefined;
      node.style('label', computeNodeLabel(label, value, min, max, nodeType, eventType, interval, intervalMin, intervalMax));
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
 * Resets all nodes to default style (removes breach highlighting and resets colors).
 */
export function resetHighlights(): void {
  if (!cy) return;

  cy.nodes().removeClass('breached');
  // Reset colors based on node type
  cy.nodes().forEach((node) => {
    const nodeType = node.data('nodeType') as string | undefined;
    const eventType = node.data('eventType') as string | undefined;

    if (nodeType === 'event') {
      if (eventType === 'random') {
        node.style('background-color', COLOR_RANDOM_EVENT);
        node.style('border-color', COLOR_RANDOM_EVENT_BORDER);
      } else if (eventType === 'fixed') {
        node.style('background-color', COLOR_FIXED_EVENT);
        node.style('border-color', COLOR_FIXED_EVENT_BORDER);
      }
    } else {
      // Regular nodes reset to default blue
      node.style('background-color', COLOR_MIN);
      node.style('border-color', darkenColor(COLOR_MIN, 0.2));
    }
  });
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

/**
 * Marks a node as having a breakpoint (visual indicator).
 */
export function setNodeBreakpoint(nodeId: string): void {
  if (!cy) return;

  const node = cy.getElementById(nodeId);
  if (node.length > 0) {
    node.addClass('hasBreakpoint');
  }
}

/**
 * Removes breakpoint visual indicator from a node.
 */
export function clearNodeBreakpoint(nodeId: string): void {
  if (!cy) return;

  const node = cy.getElementById(nodeId);
  if (node.length > 0) {
    node.removeClass('hasBreakpoint');
    node.removeClass('breakpointHit');
  }
}

/**
 * Removes all breakpoint visual indicators from all nodes.
 */
export function clearAllNodeBreakpoints(): void {
  if (!cy) return;

  cy.nodes().removeClass('hasBreakpoint');
  cy.nodes().removeClass('breakpointHit');
}

/**
 * Highlights a node as having hit its breakpoint.
 */
export function highlightBreakpointHit(nodeId: string): void {
  if (!cy) return;

  const node = cy.getElementById(nodeId);
  if (node.length > 0) {
    node.addClass('breakpointHit');
  }
}

/**
 * Clears the breakpoint hit highlight from all nodes.
 */
export function clearBreakpointHitHighlight(): void {
  if (!cy) return;

  cy.nodes().removeClass('breakpointHit');
}
