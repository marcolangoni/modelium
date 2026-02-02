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
}

/**
 * Precomputed graph structure for efficient step computation.
 */
interface CompiledGraph {
  nodes: Map<string, ModeliumNode>;
  incomingEdges: Map<string, Array<{ sourceId: string; weight: number; polarity: 1 | -1 }>>;
}

/**
 * Compiles the model into an efficient lookup structure.
 */
export function compileGraph(model: ModeliumModel): CompiledGraph {
  const nodes = new Map<string, ModeliumNode>();
  for (const node of model.nodes) {
    nodes.set(node.id, node);
  }

  const incomingEdges = new Map<string, Array<{ sourceId: string; weight: number; polarity: 1 | -1 }>>();
  for (const node of model.nodes) {
    incomingEdges.set(node.id, []);
  }

  for (const edge of model.edges) {
    const list = incomingEdges.get(edge.to);
    if (list) {
      list.push({
        sourceId: edge.from,
        weight: edge.weight,
        polarity: edge.polarity === '+' ? 1 : -1,
      });
    }
  }

  return { nodes, incomingEdges };
}

/**
 * Creates the initial simulation state from a model.
 */
export function createInitialState(model: ModeliumModel): SimState {
  const values: Record<string, number> = {};
  for (const node of model.nodes) {
    values[node.id] = node.value;
  }
  return {
    step: 0,
    values,
    breached: null,
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
  const newValues: Record<string, number> = {};
  let breach: BreachInfo | null = null;

  for (const [nodeId, node] of graph.nodes) {
    const currentValue = state.values[nodeId] ?? 0;
    const incoming = graph.incomingEdges.get(nodeId) ?? [];

    // Compute delta from incoming edges
    let delta = 0;
    for (const edge of incoming) {
      const sourceValue = state.values[edge.sourceId] ?? 0;
      delta += edge.weight * sourceValue * edge.polarity;
    }

    let newValue = currentValue + dt * delta;

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
    step: state.step + 1,
    values: newValues,
    breached: breach,
  };
}
