/**
 * Context Menu for Node Breakpoints
 * Right-click menu for adding/removing breakpoints on nodes.
 */

import type { Core } from 'cytoscape';
import type { BreakpointCondition } from '../sim/types.ts';
import type { BreakpointManager } from './breakpoints.ts';
import { showModal } from './modal.ts';

let currentMenu: HTMLElement | null = null;

interface ContextMenuConfig {
  cy: Core;
  breakpointManager: BreakpointManager;
}

/**
 * Hides the current context menu if visible.
 */
export function hideContextMenu(): void {
  if (currentMenu) {
    currentMenu.remove();
    currentMenu = null;
  }
}

/**
 * Shows a context menu at the given position.
 */
function showContextMenu(
  x: number,
  y: number,
  items: Array<{ label: string; onClick: () => void; className?: string }>
): void {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    const menuItem = document.createElement('div');
    menuItem.className = `context-menu-item${item.className ? ` ${item.className}` : ''}`;
    menuItem.textContent = item.label;
    menuItem.onclick = () => {
      hideContextMenu();
      item.onClick();
    };
    menu.appendChild(menuItem);
  }

  document.body.appendChild(menu);
  currentMenu = menu;

  // Close menu on click outside
  const handleClickOutside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      hideContextMenu();
      document.removeEventListener('click', handleClickOutside);
    }
  };
  // Delay to avoid immediate close from the right-click event
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 0);

  // Close on Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Shows the breakpoint configuration modal for a node.
 */
function showBreakpointModal(
  nodeId: string,
  nodeLabel: string,
  breakpointManager: BreakpointManager,
  existingBreakpoint?: { condition: BreakpointCondition; value: number }
): void {
  const conditionOptions = [
    { value: 'gte', label: '>= (greater than or equal)' },
    { value: 'lte', label: '<= (less than or equal)' },
    { value: 'gt', label: '> (greater than)' },
    { value: 'lt', label: '< (less than)' },
    { value: 'eq', label: '= (equal to)' },
  ];

  showModal({
    title: `Breakpoint: ${nodeLabel}`,
    fields: [
      {
        key: 'condition',
        label: 'Condition',
        type: 'select',
        value: existingBreakpoint?.condition ?? 'gte',
        options: conditionOptions,
        required: true,
      },
      {
        key: 'value',
        label: 'Value',
        type: 'number',
        value: existingBreakpoint?.value ?? 0,
        required: true,
      },
    ],
    onSave: (values) => {
      const condition = values.condition as BreakpointCondition;
      const value = values.value as number;
      if (condition && value !== undefined && !isNaN(value)) {
        breakpointManager.add(nodeId, condition, value);
      }
    },
    onDelete: existingBreakpoint
      ? () => {
          breakpointManager.remove(nodeId);
        }
      : undefined,
  });
}

/**
 * Initializes the context menu for node breakpoints.
 */
export function initContextMenu(config: ContextMenuConfig): void {
  const { cy, breakpointManager } = config;

  // Prevent default context menu on the graph container
  cy.container()?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Handle right-click on nodes
  cy.on('cxttap', 'node', (event) => {
    const node = event.target;
    const nodeId = node.id();
    const nodeLabel = node.data('label') as string;
    const renderedPosition = event.renderedPosition;

    // Get container position to calculate absolute position
    const container = cy.container();
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = rect.left + renderedPosition.x;
    const y = rect.top + renderedPosition.y;

    const hasBreakpoint = breakpointManager.has(nodeId);
    const existingBreakpoint = breakpointManager.get(nodeId);

    const menuItems: Array<{ label: string; onClick: () => void; className?: string }> = [];

    if (hasBreakpoint && existingBreakpoint) {
      // Show edit and remove options
      menuItems.push({
        label: 'Edit Breakpoint...',
        onClick: () => {
          showBreakpointModal(nodeId, nodeLabel, breakpointManager, {
            condition: existingBreakpoint.condition,
            value: existingBreakpoint.value,
          });
        },
      });
      menuItems.push({
        label: 'Remove Breakpoint',
        className: 'danger',
        onClick: () => {
          breakpointManager.remove(nodeId);
        },
      });
    } else {
      // Show add option
      menuItems.push({
        label: 'Add Breakpoint...',
        onClick: () => {
          showBreakpointModal(nodeId, nodeLabel, breakpointManager);
        },
      });
    }

    showContextMenu(x, y, menuItems);
  });

  // Close context menu when clicking on canvas
  cy.on('tap', () => {
    hideContextMenu();
  });
}
