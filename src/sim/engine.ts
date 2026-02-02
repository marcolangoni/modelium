/**
 * Pure simulation engine logic.
 * Separated from Worker for testability.
 */

import type { ModeliumModel, ModeliumNode } from '../model/schema.ts';
import type { BreachInfo } from './types.ts';

/**
 * Internal simulation state.
 */
export interface SimState {
  step: number;
  values: Record<string, number>;
  breached: BreachInfo | null;
  eventNextTrigger: Record<string, number>;  // Tracks when each event should trigger next
  triggeredEvents: string[];                  // Events that triggered in the current step
}

/**
 * Precomputed graph structure for efficient step computation.
 */
interface CompiledGraph {
  nodes: Map<string, ModeliumNode>;
  regularNodes: Map<string, ModeliumNode>;  // Only regular nodes (non-event)
  eventNodes: Map<string, ModeliumNode>;    // Only event nodes
  incomingEdges: Map<string, Array<{ sourceId: string; weight: number; polarity: 1 | -1 }>>;
  outgoingEdges: Map<string, string[]>;     // For events: which nodes they connect to
}

/**
 * Generates a random integer between min and max (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Computes the next trigger step for an event node.
 */
function computeNextTrigger(node: ModeliumNode, currentStep: number): number {
  if (node.nodeType !== 'event') return Infinity;

  if (node.eventType === 'random') {
    const min = node.intervalMin ?? 1;
    const max = node.intervalMax ?? min;
    return currentStep + randomInt(min, max);
  } else if (node.eventType === 'fixed') {
    const interval = node.interval ?? 1;
    return currentStep + interval;
  }

  return Infinity;
}

/**
 * Compiles the model into an efficient lookup structure.
 */
export function compileGraph(model: ModeliumModel): CompiledGraph {
  const nodes = new Map<string, ModeliumNode>();
  const regularNodes = new Map<string, ModeliumNode>();
  const eventNodes = new Map<string, ModeliumNode>();

  for (const node of model.nodes) {
    nodes.set(node.id, node);
    if (node.nodeType === 'event') {
      eventNodes.set(node.id, node);
    } else {
      regularNodes.set(node.id, node);
    }
  }

  const incomingEdges = new Map<string, Array<{ sourceId: string; weight: number; polarity: 1 | -1 }>>();
  const outgoingEdges = new Map<string, string[]>();

  for (const node of model.nodes) {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
  }

  for (const edge of model.edges) {
    const inList = incomingEdges.get(edge.to);
    if (inList) {
      inList.push({
        sourceId: edge.from,
        weight: edge.weight,
        polarity: edge.polarity === '+' ? 1 : -1,
      });
    }

    const outList = outgoingEdges.get(edge.from);
    if (outList) {
      outList.push(edge.to);
    }
  }

  return { nodes, regularNodes, eventNodes, incomingEdges, outgoingEdges };
}

/**
 * Creates the initial simulation state from a model.
 */
export function createInitialState(model: ModeliumModel): SimState {
  const values: Record<string, number> = {};
  const eventNextTrigger: Record<string, number> = {};

  for (const node of model.nodes) {
    values[node.id] = node.value;

    // Initialize event triggers
    if (node.nodeType === 'event') {
      eventNextTrigger[node.id] = computeNextTrigger(node, 0);
    }
  }

  return {
    step: 0,
    values,
    breached: null,
    eventNextTrigger,
    triggeredEvents: [],
  };
}

/**
 * Computes a single simulation step.
 * Returns a new state (immutable).
 */
export function computeStep(
  state: SimState,
  graph: CompiledGraph,
  dt: number
): SimState {
  const newStep = state.step + 1;
  const newValues: Record<string, number> = {};
  const newEventNextTrigger: Record<string, number> = { ...state.eventNextTrigger };
  const triggeredEvents: string[] = [];
  let breach: BreachInfo | null = null;

  // Collect event deltas: maps target node ID to accumulated delta from events
  const eventDeltas: Record<string, number> = {};

  // Process event triggers
  for (const [eventId, eventNode] of graph.eventNodes) {
    const triggerStep = state.eventNextTrigger[eventId] ?? Infinity;

    if (newStep >= triggerStep) {
      // Event triggers this step
      triggeredEvents.push(eventId);

      const eventValue = state.values[eventId] ?? 0;
      const outgoing = graph.outgoingEdges.get(eventId) ?? [];

      if (outgoing.length > 0) {
        // Event has connections: apply delta only to connected nodes
        for (const targetId of outgoing) {
          // Only affect regular nodes, not other events
          if (graph.regularNodes.has(targetId)) {
            eventDeltas[targetId] = (eventDeltas[targetId] ?? 0) + eventValue;
          }
        }
      } else {
        // Event has no connections: apply delta to all regular nodes
        for (const regularId of graph.regularNodes.keys()) {
          eventDeltas[regularId] = (eventDeltas[regularId] ?? 0) + eventValue;
        }
      }

      // Schedule next trigger
      newEventNextTrigger[eventId] = computeNextTrigger(eventNode, newStep);
    }
  }

  // Process all nodes
  for (const [nodeId, node] of graph.nodes) {
    const currentValue = state.values[nodeId] ?? 0;

    // Event nodes don't receive delta from edges (they're sources, not targets)
    if (node.nodeType === 'event') {
      newValues[nodeId] = currentValue;
      continue;
    }

    const incoming = graph.incomingEdges.get(nodeId) ?? [];

    // Compute delta from incoming edges (only from regular nodes)
    let delta = 0;
    for (const edge of incoming) {
      // Skip if source is an event node (events use their own trigger mechanism)
      if (graph.eventNodes.has(edge.sourceId)) {
        continue;
      }
      const sourceValue = state.values[edge.sourceId] ?? 0;
      delta += edge.weight * sourceValue * edge.polarity;
    }

    // Add event delta (if any events triggered and affected this node)
    const eventDelta = eventDeltas[nodeId] ?? 0;

    let newValue = currentValue + dt * delta + eventDelta;

    // Check max constraint
    if (node.max !== undefined && newValue > node.max) {
      if (!breach) {
        breach = {
          nodeId,
          constraint: 'max',
          value: newValue,
          limit: node.max,
        };
      }
      newValue = node.max;
    }

    // Check min constraint
    if (node.min !== undefined && newValue < node.min) {
      if (!breach) {
        breach = {
          nodeId,
          constraint: 'min',
          value: newValue,
          limit: node.min,
        };
      }
      newValue = node.min;
    }

    newValues[nodeId] = newValue;
  }

  return {
    step: newStep,
    values: newValues,
    breached: breach,
    eventNextTrigger: newEventNextTrigger,
    triggeredEvents,
  };
}
