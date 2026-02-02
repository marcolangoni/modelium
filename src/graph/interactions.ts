/**
 * Graph interaction handlers for editing nodes and edges.
 */

import type { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import { showModal } from '../ui/modal.ts';

let cy: Core | null = null;
let editingEnabled = true;

// Callback for triggering saves on changes
let onChangeCallback: (() => void) | null = null;

/**
 * Sets the callback to be called when the graph changes.
 */
export function setOnChangeCallback(callback: () => void): void {
  onChangeCallback = callback;
}

/**
 * Triggers the change callback if set.
 */
function triggerChange(): void {
  onChangeCallback?.();
}

// Overlay elements
let trashOverlay: HTMLElement | null = null;
let edgeHandleOverlay: HTMLElement | null = null;
let edgeInfoPanel: HTMLElement | null = null;
let nodeInfoPanel: HTMLElement | null = null;

// Edge drawing state
let isDrawingEdge = false;
let edgeSourceNode: NodeSingular | null = null;
let tempEdgeLine: HTMLElement | null = null;

// Node dragging state
let isDraggingNode = false;

// Last known mouse position (page coordinates)
let lastMousePos: { x: number; y: number } = { x: 0, y: 0 };

// ID counter for generating unique IDs
let idCounter = 0;

/**
 * Generates a unique ID for nodes/edges.
 */
function generateId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}`;
}

/**
 * Gets the rendered position of an element in page coordinates.
 */
function getElementPagePosition(element: NodeSingular | EdgeSingular): { x: number; y: number } {
  const container = cy?.container();
  if (!container || !cy) return { x: 0, y: 0 };

  const pan = cy.pan();
  const zoom = cy.zoom();
  const containerRect = container.getBoundingClientRect();

  if ('isNode' in element && element.isNode()) {
    const pos = element.position();
    return {
      x: containerRect.left + pan.x + pos.x * zoom,
      y: containerRect.top + pan.y + pos.y * zoom,
    };
  } else {
    // For edges, use midpoint
    const midpoint = element.midpoint();
    return {
      x: containerRect.left + pan.x + midpoint.x * zoom,
      y: containerRect.top + pan.y + midpoint.y * zoom,
    };
  }
}

/**
 * Creates the trash overlay element.
 */
function createTrashOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'trash-overlay';
  overlay.innerHTML = '×';
  overlay.style.display = 'none';
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Creates the edge handle overlay element.
 */
function createEdgeHandleOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'edge-handle';
  overlay.style.display = 'none';
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Creates the temporary edge line for drawing.
 */
function createTempEdgeLine(): HTMLElement {
  const line = document.createElement('div');
  line.className = 'temp-edge-line';
  line.style.display = 'none';
  document.body.appendChild(line);
  return line;
}

/**
 * Creates the edge info panel element.
 */
function createEdgeInfoPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'edge-info-panel';
  panel.style.display = 'none';
  document.body.appendChild(panel);
  return panel;
}

/**
 * Creates the node info panel element.
 */
function createNodeInfoPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'node-info-panel';
  panel.style.display = 'none';
  document.body.appendChild(panel);
  return panel;
}

/**
 * Shows the node edit modal.
 */
function showNodeEditModal(node: NodeSingular): void {
  showModal({
    title: 'Edit Node',
    fields: [
      { key: 'label', label: 'Label', type: 'text', value: node.data('label') || '', required: true },
      { key: 'value', label: 'Value', type: 'number', value: node.data('value') ?? 0, required: true },
      { key: 'min', label: 'Min', type: 'number', value: node.data('min') ?? '' },
      { key: 'max', label: 'Max', type: 'number', value: node.data('max') ?? '' },
    ],
    onSave: (values) => {
      node.data('label', values['label']);
      node.data('value', values['value']);
      node.data('min', values['min']);
      node.data('max', values['max']);
      triggerChange();
    },
    onDelete: () => {
      node.remove();
      triggerChange();
    },
  });
}

/**
 * Shows the new node modal.
 */
function showNewNodeModal(position: { x: number; y: number }): void {
  const id = generateId('n');
  showModal({
    title: 'New Node',
    fields: [
      { key: 'label', label: 'Label', type: 'text', value: '', required: true },
      { key: 'value', label: 'Value', type: 'number', value: 0, required: true },
      { key: 'min', label: 'Min', type: 'number', value: '' },
      { key: 'max', label: 'Max', type: 'number', value: '' },
    ],
    onSave: (values) => {
      cy?.add({
        group: 'nodes',
        data: {
          id,
          label: values['label'],
          value: values['value'],
          min: values['min'],
          max: values['max'],
        },
        position,
      });
      triggerChange();
    },
  });
}

/**
 * Shows the edge edit modal.
 */
function showEdgeEditModal(edge: EdgeSingular): void {
  showModal({
    title: 'Edit Edge',
    fields: [
      { key: 'weight', label: 'Weight', type: 'number', value: edge.data('weight') ?? 1, required: true },
      {
        key: 'polarity',
        label: 'Polarity',
        type: 'select',
        value: edge.data('polarity') || '+',
        options: [
          { value: '+', label: '+ (positive)' },
          { value: '-', label: '- (negative)' },
        ],
        required: true,
      },
    ],
    onSave: (values) => {
      edge.data('weight', values['weight']);
      edge.data('polarity', values['polarity']);
      triggerChange();
    },
    onDelete: () => {
      edge.remove();
      triggerChange();
    },
  });
}

/**
 * Shows the new edge modal.
 */
function showNewEdgeModal(sourceId: string, targetId: string): void {
  const id = generateId('e');
  showModal({
    title: 'New Edge',
    fields: [
      { key: 'weight', label: 'Weight', type: 'number', value: 1, required: true },
      {
        key: 'polarity',
        label: 'Polarity',
        type: 'select',
        value: '+',
        options: [
          { value: '+', label: '+ (positive)' },
          { value: '-', label: '- (negative)' },
        ],
        required: true,
      },
    ],
    onSave: (values) => {
      cy?.add({
        group: 'edges',
        data: {
          id,
          source: sourceId,
          target: targetId,
          weight: values['weight'],
          polarity: values['polarity'],
        },
      });
      triggerChange();
    },
  });
}

/**
 * Positions the trash overlay near an element.
 * For nodes: top-right (315 degrees / -45 degrees)
 * For edges: uses perpendicular offset (opposite side from info panel)
 */
function positionTrashOverlay(element: NodeSingular | EdgeSingular): void {
  if (!trashOverlay || !cy) return;

  const pos = getElementPagePosition(element);
  const zoom = cy.zoom();

  if (element.isNode()) {
    // Position at 315 degrees (top-right), -45 degrees in standard notation
    const angle = -Math.PI / 4; // -45 degrees
    const offset = 30 * zoom;
    const x = pos.x + Math.cos(angle) * offset;
    const y = pos.y + Math.sin(angle) * offset;
    trashOverlay.style.left = `${x}px`;
    trashOverlay.style.top = `${y}px`;
  } else {
    // For edges, position on opposite side from info panel (negative perpendicular)
    const edge = element as EdgeSingular;
    const perp = getEdgePerpendicular(edge);
    const offset = 25;
    const x = pos.x - perp.x * offset;
    const y = pos.y - perp.y * offset;
    trashOverlay.style.left = `${x}px`;
    trashOverlay.style.top = `${y}px`;
  }
  trashOverlay.style.display = 'flex';
}

/**
 * Normalizes an angle to the range [-PI, PI].
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Calculates the angular distance between two angles.
 */
function angularDistance(a: number, b: number): number {
  return Math.abs(normalizeAngle(a - b));
}

/**
 * Finds the midpoints of gaps between occupied angles.
 * Returns an array of candidate angles where the edge handle can be placed.
 */
function findGapMidpoints(occupiedAngles: number[]): number[] {
  if (occupiedAngles.length === 0) {
    return [0]; // Default to right side
  }

  if (occupiedAngles.length === 1) {
    // Single edge: return the opposite angle
    return [normalizeAngle(occupiedAngles[0]! + Math.PI)];
  }

  // Sort angles
  const sorted = [...occupiedAngles].sort((a, b) => a - b);

  const midpoints: number[] = [];

  // Find gaps between consecutive angles
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const next = sorted[(i + 1) % sorted.length]!;

    // Calculate gap, handling wrap-around
    let gap: number;
    if (i === sorted.length - 1) {
      // Last to first (wrap around)
      gap = (next + 2 * Math.PI) - current;
    } else {
      gap = next - current;
    }

    // Midpoint of the gap
    const midpoint = normalizeAngle(current + gap / 2);
    midpoints.push(midpoint);
  }

  return midpoints;
}

/**
 * Finds the angle from candidates that is closest to the target angle.
 */
function findClosestAngle(candidates: number[], targetAngle: number): number {
  if (candidates.length === 0) return 0;

  let closest = candidates[0]!;
  let minDistance = angularDistance(closest, targetAngle);

  for (let i = 1; i < candidates.length; i++) {
    const distance = angularDistance(candidates[i]!, targetAngle);
    if (distance < minDistance) {
      minDistance = distance;
      closest = candidates[i]!;
    }
  }

  return closest;
}

/**
 * Calculates the best angle for the edge handle based on connected edges and mouse position.
 */
function getEdgeHandleAngle(node: NodeSingular, mousePos: { x: number; y: number }): number {
  if (!cy) return 0;

  const nodePos = node.position();
  const container = cy.container();
  if (!container) return 0;

  // Convert mouse position from page coordinates to model coordinates
  const rect = container.getBoundingClientRect();
  const pan = cy.pan();
  const zoom = cy.zoom();
  const mouseModelX = (mousePos.x - rect.left - pan.x) / zoom;
  const mouseModelY = (mousePos.y - rect.top - pan.y) / zoom;

  // Calculate mouse angle relative to node center
  const mouseAngle = Math.atan2(mouseModelY - nodePos.y, mouseModelX - nodePos.x);

  const connectedEdges = node.connectedEdges();

  if (connectedEdges.length === 0) {
    // No edges: place at mouse angle directly
    return mouseAngle;
  }

  // Calculate angles where edges connect
  const occupiedAngles: number[] = [];
  connectedEdges.forEach((edge) => {
    const otherNode = edge.source().id() === node.id() ? edge.target() : edge.source();

    // Skip self-loops or overlapping nodes
    if (otherNode.id() === node.id()) return;
    const otherPos = otherNode.position();
    if (otherPos.x === nodePos.x && otherPos.y === nodePos.y) return;

    const angle = Math.atan2(otherPos.y - nodePos.y, otherPos.x - nodePos.x);
    occupiedAngles.push(angle);
  });

  if (occupiedAngles.length === 0) {
    // All edges were self-loops or overlapping
    return mouseAngle;
  }

  // Find candidate angles (midpoints of gaps)
  const candidateAngles = findGapMidpoints(occupiedAngles);

  // Return the candidate angle closest to the mouse angle
  return findClosestAngle(candidateAngles, mouseAngle);
}

/**
 * Positions the edge handle overlay on a node based on mouse position.
 */
function positionEdgeHandleOverlay(node: NodeSingular, mousePos: { x: number; y: number }): void {
  if (!edgeHandleOverlay || !cy) return;

  const pos = getElementPagePosition(node);
  const zoom = cy.zoom();
  const offset = 30 * zoom;

  // Calculate the best angle for the edge handle
  const angle = getEdgeHandleAngle(node, mousePos);

  const x = pos.x + Math.cos(angle) * offset;
  const y = pos.y + Math.sin(angle) * offset;

  edgeHandleOverlay.style.left = `${x}px`;
  edgeHandleOverlay.style.top = `${y}px`;
  edgeHandleOverlay.style.display = 'block';
}

/**
 * Hides all overlays.
 */
function hideOverlays(): void {
  if (trashOverlay) {
    trashOverlay.style.display = 'none';
  }
  if (edgeHandleOverlay) {
    edgeHandleOverlay.style.display = 'none';
  }
  if (edgeInfoPanel) {
    edgeInfoPanel.style.display = 'none';
  }
  if (nodeInfoPanel) {
    nodeInfoPanel.style.display = 'none';
  }
}

/**
 * Calculates the perpendicular offset direction for an edge.
 * Returns a unit vector perpendicular to the edge direction.
 */
function getEdgePerpendicular(edge: EdgeSingular): { x: number; y: number } {
  const sourcePos = edge.source().position();
  const targetPos = edge.target().position();

  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // Fallback if source and target are at same position
    return { x: 0, y: -1 };
  }

  // Perpendicular vector (rotated 90 degrees counter-clockwise)
  return { x: -dy / length, y: dx / length };
}

/**
 * Positions and updates the edge info panel near an edge, keeping it within viewport bounds.
 */
function positionEdgeInfoPanel(edge: EdgeSingular): void {
  if (!edgeInfoPanel || !cy) return;

  const pos = getElementPagePosition(edge);
  const sourceNode = edge.source();
  const targetNode = edge.target();
  const sourceLabel = sourceNode.data('label') || sourceNode.id();
  const targetLabel = targetNode.data('label') || targetNode.id();
  const weight = edge.data('weight') ?? 1;
  const polarity = edge.data('polarity') || '+';

  edgeInfoPanel.innerHTML = `
    <div class="edge-info-row"><span class="edge-info-label">From:</span> ${sourceLabel}</div>
    <div class="edge-info-row"><span class="edge-info-label">To:</span> ${targetLabel}</div>
    <div class="edge-info-row"><span class="edge-info-label">Weight:</span> ${weight}</div>
    <div class="edge-info-row"><span class="edge-info-label">Polarity:</span> ${polarity}</div>
  `;

  edgeInfoPanel.style.display = 'block';
  edgeInfoPanel.style.transform = '';

  // Get panel dimensions
  const panelRect = edgeInfoPanel.getBoundingClientRect();
  const panelWidth = panelRect.width;
  const panelHeight = panelRect.height;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const toolbarHeight = 48;

  // Position perpendicular to edge, on one side (positive perpendicular)
  const perp = getEdgePerpendicular(edge);
  const offset = 25;
  let x = pos.x + perp.x * offset - panelWidth / 2;
  let y = pos.y + perp.y * offset - panelHeight / 2;

  // Clamp to viewport bounds
  if (x < 0) {
    x = 8;
  }
  if (x + panelWidth > viewportWidth) {
    x = viewportWidth - panelWidth - 8;
  }
  if (y < toolbarHeight) {
    y = toolbarHeight + 8;
  }
  if (y + panelHeight > viewportHeight) {
    y = viewportHeight - panelHeight - 8;
  }

  edgeInfoPanel.style.left = `${x}px`;
  edgeInfoPanel.style.top = `${y}px`;
  edgeInfoPanel.style.transform = 'none';
}

/**
 * Positions and updates the node info panel, keeping it within viewport bounds.
 */
function positionNodeInfoPanel(node: NodeSingular): void {
  if (!nodeInfoPanel || !cy) return;

  const pos = getElementPagePosition(node);
  const zoom = cy.zoom();
  const offset = 30 * zoom;

  const label = node.data('label') || node.id();
  const value = node.data('value') ?? 0;
  const min = node.data('min');
  const max = node.data('max');

  let html = `
    <div class="node-info-row"><span class="node-info-label">Label:</span> ${label}</div>
    <div class="node-info-row"><span class="node-info-label">Value:</span> ${value}</div>
  `;
  if (min !== undefined && min !== '') {
    html += `<div class="node-info-row"><span class="node-info-label">Min:</span> ${min}</div>`;
  }
  if (max !== undefined && max !== '') {
    html += `<div class="node-info-row"><span class="node-info-label">Max:</span> ${max}</div>`;
  }

  nodeInfoPanel.innerHTML = html;
  nodeInfoPanel.style.display = 'block';
  
  // Remove any existing transform to get accurate dimensions
  nodeInfoPanel.style.transform = '';

  // Get panel dimensions
  const panelRect = nodeInfoPanel.getBoundingClientRect();
  const panelWidth = panelRect.width;
  const panelHeight = panelRect.height;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const toolbarHeight = 48; // Height of toolbar

  // Try positioning on the left first (preferred)
  let x = pos.x - offset - panelWidth;
  let y = pos.y - panelHeight / 2;

  // If panel goes off left edge, position on the right instead
  if (x < 0) {
    x = pos.x + offset;
  }

  // If panel goes off right edge, clamp to viewport
  if (x + panelWidth > viewportWidth) {
    x = viewportWidth - panelWidth - 8;
  }

  // Ensure x is not negative
  if (x < 0) {
    x = 8;
  }

  // Clamp y to viewport bounds
  if (y < toolbarHeight) {
    y = toolbarHeight + 8;
  }
  if (y + panelHeight > viewportHeight) {
    y = viewportHeight - panelHeight - 8;
  }

  nodeInfoPanel.style.left = `${x}px`;
  nodeInfoPanel.style.top = `${y}px`;
  nodeInfoPanel.style.transform = 'none';
}

/**
 * Updates the temporary edge line position.
 */
function updateTempEdgeLine(startX: number, startY: number, endX: number, endY: number): void {
  if (!tempEdgeLine) return;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  tempEdgeLine.style.left = `${startX}px`;
  tempEdgeLine.style.top = `${startY}px`;
  tempEdgeLine.style.width = `${length}px`;
  tempEdgeLine.style.transform = `rotate(${angle}deg)`;
  tempEdgeLine.style.display = 'block';
}

/**
 * Hides the temporary edge line.
 */
function hideTempEdgeLine(): void {
  if (tempEdgeLine) {
    tempEdgeLine.style.display = 'none';
  }
}

/**
 * Initializes all graph interactions.
 */
export function initInteractions(cyInstance: Core): void {
  cy = cyInstance;

  // Create overlay elements
  trashOverlay = createTrashOverlay();
  edgeHandleOverlay = createEdgeHandleOverlay();
  tempEdgeLine = createTempEdgeLine();
  edgeInfoPanel = createEdgeInfoPanel();
  nodeInfoPanel = createNodeInfoPanel();

  let hoveredElement: NodeSingular | EdgeSingular | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  // Double-click on canvas to add node
  cy.on('dblclick', (event) => {
    if (!editingEnabled) return;
    if (event.target === cy) {
      showNewNodeModal(event.position);
    }
  });

  // Double-click on node to edit
  cy.on('dblclick', 'node', (event) => {
    if (!editingEnabled) return;
    event.stopPropagation();
    showNodeEditModal(event.target as NodeSingular);
  });

  // Double-click on edge to edit
  cy.on('dblclick', 'edge', (event) => {
    if (!editingEnabled) return;
    event.stopPropagation();
    showEdgeEditModal(event.target as EdgeSingular);
  });

  // Node grab - hide overlays during drag
  cy.on('grab', 'node', () => {
    isDraggingNode = true;
    hideOverlays();
  });

  // Node free - allow overlays again after drag and save positions
  cy.on('free', 'node', () => {
    isDraggingNode = false;
    triggerChange();
  });

  // Mouse over node - show overlays
  cy.on('mouseover', 'node', (event) => {
    if (isDrawingEdge || isDraggingNode) return;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    hoveredElement = event.target as NodeSingular;

    // Capture mouse position from the original event
    const originalEvent = event.originalEvent as MouseEvent;
    lastMousePos = { x: originalEvent.clientX, y: originalEvent.clientY };

    // Always show node info panel (regardless of editing state)
    positionNodeInfoPanel(hoveredElement);
    // Only show editing overlays if editing is enabled
    if (editingEnabled) {
      positionTrashOverlay(hoveredElement);
      positionEdgeHandleOverlay(hoveredElement, lastMousePos);
    }
  });

  // Mouse over edge - show trash overlay and info panel
  cy.on('mouseover', 'edge', (event) => {
    if (isDrawingEdge || isDraggingNode) return;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    hoveredElement = event.target as EdgeSingular;
    // Always show edge info panel on hover (regardless of editing state)
    positionEdgeInfoPanel(hoveredElement);
    // Only show trash overlay if editing is enabled
    if (editingEnabled) {
      positionTrashOverlay(hoveredElement);
    }
    if (edgeHandleOverlay) {
      edgeHandleOverlay.style.display = 'none';
    }
  });

  // Mouse out - hide overlays with delay
  cy.on('mouseout', 'node, edge', () => {
    if (isDrawingEdge || isDraggingNode) return;
    hideTimeout = setTimeout(() => {
      hideOverlays();
      hoveredElement = null;
    }, 200);
  });

  // Trash overlay click handler
  trashOverlay.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hoveredElement) {
      hoveredElement.remove();
      hideOverlays();
      hoveredElement = null;
      triggerChange();
    }
  });

  // Keep overlays visible when hovering over them
  trashOverlay.addEventListener('mouseenter', () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });

  trashOverlay.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
      hideOverlays();
      hoveredElement = null;
    }, 200);
  });

  // Edge handle - start drawing edge
  edgeHandleOverlay.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (!hoveredElement || !hoveredElement.isNode()) return;

    isDrawingEdge = true;
    edgeSourceNode = hoveredElement as NodeSingular;
    hideOverlays();

    const startPos = getElementPagePosition(edgeSourceNode);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateTempEdgeLine(startPos.x, startPos.y, moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      hideTempEdgeLine();
      isDrawingEdge = false;

      // Check if we're over a node
      if (cy) {
        const container = cy.container();
        if (container) {
          const rect = container.getBoundingClientRect();
          const pan = cy.pan();
          const zoom = cy.zoom();
          const modelX = (upEvent.clientX - rect.left - pan.x) / zoom;
          const modelY = (upEvent.clientY - rect.top - pan.y) / zoom;

          // Find node at this position
          const targetNode = cy.nodes().filter((node) => {
            const pos = node.position();
            const width = node.width();
            const height = node.height();
            return (
              modelX >= pos.x - width / 2 &&
              modelX <= pos.x + width / 2 &&
              modelY >= pos.y - height / 2 &&
              modelY <= pos.y + height / 2
            );
          }).first();

          if (targetNode.length > 0 && edgeSourceNode && targetNode.id() !== edgeSourceNode.id()) {
            showNewEdgeModal(edgeSourceNode.id(), targetNode.id());
          }
        }
      }

      edgeSourceNode = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  edgeHandleOverlay.addEventListener('mouseenter', () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });

  // Update overlay positions on pan/zoom
  cy.on('pan zoom', () => {
    if (hoveredElement && !isDrawingEdge && !isDraggingNode) {
      if (hoveredElement.isNode()) {
        positionNodeInfoPanel(hoveredElement as NodeSingular);
        if (editingEnabled) {
          positionTrashOverlay(hoveredElement);
          positionEdgeHandleOverlay(hoveredElement as NodeSingular, lastMousePos);
        }
      } else {
        positionEdgeInfoPanel(hoveredElement as EdgeSingular);
        if (editingEnabled) {
          positionTrashOverlay(hoveredElement);
        }
      }
    }
  });
}

/**
 * Disables editing interactions.
 */
export function disableEditing(): void {
  editingEnabled = false;
  hideOverlays();
}

/**
 * Enables editing interactions.
 */
export function enableEditing(): void {
  editingEnabled = true;
}

/**
 * Returns whether editing is currently enabled.
 */
export function isEditingEnabled(): boolean {
  return editingEnabled;
}
