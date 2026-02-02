/**
 * Graph interaction handlers for editing nodes and edges.
 */

import type { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import { showModal } from '../ui/modal.ts';

let cy: Core | null = null;
let editingEnabled = true;

// Overlay elements
let trashOverlay: HTMLElement | null = null;
let edgeHandleOverlay: HTMLElement | null = null;
let edgeInfoPanel: HTMLElement | null = null;

// Edge drawing state
let isDrawingEdge = false;
let edgeSourceNode: NodeSingular | null = null;
let tempEdgeLine: HTMLElement | null = null;

// Node dragging state
let isDraggingNode = false;

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
    },
    onDelete: () => {
      node.remove();
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
    },
    onDelete: () => {
      edge.remove();
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
    },
  });
}

/**
 * Positions the trash overlay near an element.
 */
function positionTrashOverlay(element: NodeSingular | EdgeSingular): void {
  if (!trashOverlay || !cy) return;

  const pos = getElementPagePosition(element);
  const zoom = cy.zoom();
  const offset = element.isNode() ? 30 * zoom : 15;

  trashOverlay.style.left = `${pos.x + offset}px`;
  trashOverlay.style.top = `${pos.y - offset}px`;
  trashOverlay.style.display = 'flex';
}

/**
 * Positions the edge handle overlay on a node.
 */
function positionEdgeHandleOverlay(node: NodeSingular): void {
  if (!edgeHandleOverlay || !cy) return;

  const pos = getElementPagePosition(node);
  const zoom = cy.zoom();
  const offset = 30 * zoom;

  edgeHandleOverlay.style.left = `${pos.x + offset}px`;
  edgeHandleOverlay.style.top = `${pos.y}px`;
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
}

/**
 * Positions and updates the edge info panel near an edge.
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

  // Position to the right of the edge midpoint
  edgeInfoPanel.style.left = `${pos.x + 20}px`;
  edgeInfoPanel.style.top = `${pos.y}px`;
  edgeInfoPanel.style.display = 'block';
}

/**
 * Hides the edge info panel.
 */
function hideEdgeInfoPanel(): void {
  if (edgeInfoPanel) {
    edgeInfoPanel.style.display = 'none';
  }
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

  // Node free - allow overlays again after drag
  cy.on('free', 'node', () => {
    isDraggingNode = false;
  });

  // Mouse over node - show overlays
  cy.on('mouseover', 'node', (event) => {
    if (!editingEnabled || isDrawingEdge || isDraggingNode) return;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    hoveredElement = event.target as NodeSingular;
    positionTrashOverlay(hoveredElement);
    positionEdgeHandleOverlay(hoveredElement);
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
      positionTrashOverlay(hoveredElement);
      if (hoveredElement.isNode()) {
        positionEdgeHandleOverlay(hoveredElement as NodeSingular);
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
