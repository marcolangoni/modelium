import { describe, it, expect } from 'vitest';
import { compileGraph, createInitialState, computeStep } from './engine.ts';
import type { ModeliumModel } from '../model/schema.ts';

/**
 * Helper to create a valid model for testing.
 */
function createModel(
  nodes: ModeliumModel['nodes'],
  edges: ModeliumModel['edges'] = []
): ModeliumModel {
  return {
    version: 1,
    nodes,
    edges,
  };
}

describe('compileGraph', () => {
  it('creates node map from model nodes', () => {
    const model = createModel([
      { id: 'A', label: 'Node A', value: 10 },
      { id: 'B', label: 'Node B', value: 20 },
    ]);

    const graph = compileGraph(model);

    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.get('A')).toEqual({ id: 'A', label: 'Node A', value: 10 });
    expect(graph.nodes.get('B')).toEqual({ id: 'B', label: 'Node B', value: 20 });
  });

  it('handles empty model', () => {
    const model = createModel([], []);

    const graph = compileGraph(model);

    expect(graph.nodes.size).toBe(0);
    expect(graph.incomingEdges.size).toBe(0);
  });

  it('creates incoming edges map with positive polarity', () => {
    const model = createModel(
      [
        { id: 'A', label: 'A', value: 10 },
        { id: 'B', label: 'B', value: 0 },
      ],
      [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' }]
    );

    const graph = compileGraph(model);

    const incomingToB = graph.incomingEdges.get('B');
    expect(incomingToB).toHaveLength(1);
    expect(incomingToB![0]).toEqual({
      sourceId: 'A',
      weight: 0.5,
      polarity: 1,
    });
  });

  it('creates incoming edges map with negative polarity', () => {
    const model = createModel(
      [
        { id: 'A', label: 'A', value: 10 },
        { id: 'B', label: 'B', value: 0 },
      ],
      [{ id: 'e1', from: 'A', to: 'B', weight: 0.3, polarity: '-' }]
    );

    const graph = compileGraph(model);

    const incomingToB = graph.incomingEdges.get('B');
    expect(incomingToB).toHaveLength(1);
    expect(incomingToB![0]).toEqual({
      sourceId: 'A',
      weight: 0.3,
      polarity: -1,
    });
  });

  it('handles multiple incoming edges to same node', () => {
    const model = createModel(
      [
        { id: 'A', label: 'A', value: 10 },
        { id: 'B', label: 'B', value: 5 },
        { id: 'C', label: 'C', value: 0 },
      ],
      [
        { id: 'e1', from: 'A', to: 'C', weight: 0.5, polarity: '+' },
        { id: 'e2', from: 'B', to: 'C', weight: 0.3, polarity: '-' },
      ]
    );

    const graph = compileGraph(model);

    const incomingToC = graph.incomingEdges.get('C');
    expect(incomingToC).toHaveLength(2);
  });

  it('initializes empty incoming edges for nodes with no incoming edges', () => {
    const model = createModel(
      [
        { id: 'A', label: 'A', value: 10 },
        { id: 'B', label: 'B', value: 0 },
      ],
      [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' }]
    );

    const graph = compileGraph(model);

    // A has no incoming edges
    expect(graph.incomingEdges.get('A')).toEqual([]);
    // B has one incoming edge
    expect(graph.incomingEdges.get('B')).toHaveLength(1);
  });
});

describe('createInitialState', () => {
  it('creates state with step 0', () => {
    const model = createModel([{ id: 'A', label: 'A', value: 10 }]);

    const state = createInitialState(model);

    expect(state.step).toBe(0);
  });

  it('initializes values from node values', () => {
    const model = createModel([
      { id: 'A', label: 'A', value: 10 },
      { id: 'B', label: 'B', value: -5 },
      { id: 'C', label: 'C', value: 0 },
    ]);

    const state = createInitialState(model);

    expect(state.values).toEqual({
      A: 10,
      B: -5,
      C: 0,
    });
  });

  it('initializes with no breach', () => {
    const model = createModel([{ id: 'A', label: 'A', value: 10 }]);

    const state = createInitialState(model);

    expect(state.breached).toBeNull();
  });

  it('handles empty model', () => {
    const model = createModel([]);

    const state = createInitialState(model);

    expect(state.step).toBe(0);
    expect(state.values).toEqual({});
    expect(state.breached).toBeNull();
  });
});

describe('computeStep', () => {
  describe('step counting', () => {
    it('increments step number', () => {
      const model = createModel([{ id: 'A', label: 'A', value: 10 }]);
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      expect(newState.step).toBe(1);
    });

    it('returns a new state object (immutable)', () => {
      const model = createModel([{ id: 'A', label: 'A', value: 10 }]);
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      expect(newState).not.toBe(state);
      expect(newState.values).not.toBe(state.values);
    });
  });

  describe('delta computation', () => {
    it('maintains value when no incoming edges', () => {
      const model = createModel([{ id: 'A', label: 'A', value: 10 }]);
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['A']).toBe(10);
    });

    it('computes positive delta from positive polarity edge', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = weight * sourceValue * polarity = 0.5 * 10 * 1 = 5
      // newValue = 0 + 0.1 * 5 = 0.5
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['B']).toBe(0.5);
    });

    it('computes negative delta from negative polarity edge', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '-' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = weight * sourceValue * polarity = 0.5 * 10 * -1 = -5
      // newValue = 0 + 0.1 * -5 = -0.5
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['B']).toBe(-0.5);
    });

    it('accumulates deltas from multiple incoming edges', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 20 },
          { id: 'C', label: 'C', value: 0 },
        ],
        [
          { id: 'e1', from: 'A', to: 'C', weight: 0.5, polarity: '+' },
          { id: 'e2', from: 'B', to: 'C', weight: 0.2, polarity: '+' },
        ]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = (0.5 * 10 * 1) + (0.2 * 20 * 1) = 5 + 4 = 9
      // newValue = 0 + 0.1 * 9 = 0.9
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['C']).toBeCloseTo(0.9);
    });

    it('handles mixed polarity edges', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 20 },
          { id: 'C', label: 'C', value: 0 },
        ],
        [
          { id: 'e1', from: 'A', to: 'C', weight: 0.5, polarity: '+' },
          { id: 'e2', from: 'B', to: 'C', weight: 0.2, polarity: '-' },
        ]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = (0.5 * 10 * 1) + (0.2 * 20 * -1) = 5 - 4 = 1
      // newValue = 0 + 0.1 * 1 = 0.1
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['C']).toBeCloseTo(0.1);
    });

    it('uses dt correctly in computation', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = 1.0 * 10 * 1 = 10
      // With dt = 0.5: newValue = 0 + 0.5 * 10 = 5
      const newState = computeStep(state, graph, 0.5);

      expect(newState.values['B']).toBe(5);
    });

    it('handles chained simulation steps', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      let state = createInitialState(model);

      // Step 1: B = 0 + 0.1 * (1.0 * 10) = 1
      state = computeStep(state, graph, 0.1);
      expect(state.values['B']).toBe(1);
      expect(state.step).toBe(1);

      // Step 2: B = 1 + 0.1 * (1.0 * 10) = 2
      state = computeStep(state, graph, 0.1);
      expect(state.values['B']).toBe(2);
      expect(state.step).toBe(2);

      // Step 3: B = 2 + 0.1 * (1.0 * 10) = 3
      state = computeStep(state, graph, 0.1);
      expect(state.values['B']).toBe(3);
      expect(state.step).toBe(3);
    });
  });

  describe('constraint checking', () => {
    it('clamps value to max and reports breach', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 100 },
          { id: 'B', label: 'B', value: 95, max: 100 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = 1.0 * 100 * 1 = 100
      // unclamped newValue = 95 + 0.1 * 100 = 105 (exceeds max of 100)
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['B']).toBe(100);
      expect(newState.breached).toEqual({
        nodeId: 'B',
        constraint: 'max',
        value: 105,
        limit: 100,
      });
    });

    it('clamps value to min and reports breach', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 100 },
          { id: 'B', label: 'B', value: 5, min: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '-' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = 1.0 * 100 * -1 = -100
      // unclamped newValue = 5 + 0.1 * -100 = -5 (below min of 0)
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['B']).toBe(0);
      expect(newState.breached).toEqual({
        nodeId: 'B',
        constraint: 'min',
        value: -5,
        limit: 0,
      });
    });

    it('does not report breach when value stays within constraints', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 50, min: 0, max: 100 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = 1.0 * 10 * 1 = 10
      // newValue = 50 + 0.1 * 10 = 51 (within bounds)
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['B']).toBe(51);
      expect(newState.breached).toBeNull();
    });

    it('reports only first breach when multiple nodes breach', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 100 },
          { id: 'B', label: 'B', value: 95, max: 100 },
          { id: 'C', label: 'C', value: 95, max: 100 },
        ],
        [
          { id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' },
          { id: 'e2', from: 'A', to: 'C', weight: 1.0, polarity: '+' },
        ]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      // Both B and C should be clamped
      expect(newState.values['B']).toBe(100);
      expect(newState.values['C']).toBe(100);

      // Only first breach is reported (order depends on Map iteration)
      expect(newState.breached).not.toBeNull();
      expect(['B', 'C']).toContain(newState.breached!.nodeId);
    });

    it('allows value exactly at max', () => {
      const model = createModel([{ id: 'A', label: 'A', value: 100, max: 100 }]);
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['A']).toBe(100);
      expect(newState.breached).toBeNull();
    });

    it('allows value exactly at min', () => {
      const model = createModel([{ id: 'A', label: 'A', value: 0, min: 0 }]);
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['A']).toBe(0);
      expect(newState.breached).toBeNull();
    });

    it('checks max before min (max breach takes precedence)', () => {
      // Edge case: value exceeds max AND goes below min after clamping to max
      // (This shouldn't happen in normal use but tests the order of checks)
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 1000 },
          { id: 'B', label: 'B', value: 50, min: 0, max: 100 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // newValue = 50 + 0.1 * 1000 = 150 (exceeds max)
      const newState = computeStep(state, graph, 0.1);

      expect(newState.breached?.constraint).toBe('max');
    });
  });

  describe('edge cases', () => {
    it('handles zero dt', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0);

      // No change because dt = 0
      expect(newState.values['B']).toBe(0);
    });

    it('handles negative source values', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: -10 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 1.0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = 1.0 * -10 * 1 = -10
      // newValue = 0 + 0.1 * -10 = -1
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['B']).toBe(-1);
    });

    it('handles zero weight edges', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 100 },
          { id: 'B', label: 'B', value: 0 },
        ],
        [{ id: 'e1', from: 'A', to: 'B', weight: 0, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      const newState = computeStep(state, graph, 0.1);

      // delta = 0 * 100 * 1 = 0
      expect(newState.values['B']).toBe(0);
    });

    it('handles self-loop edges', () => {
      const model = createModel(
        [{ id: 'A', label: 'A', value: 10 }],
        [{ id: 'e1', from: 'A', to: 'A', weight: 0.1, polarity: '+' }]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // delta = 0.1 * 10 * 1 = 1
      // newValue = 10 + 0.1 * 1 = 10.1
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['A']).toBeCloseTo(10.1);
    });

    it('handles cyclic graphs', () => {
      const model = createModel(
        [
          { id: 'A', label: 'A', value: 10 },
          { id: 'B', label: 'B', value: 5 },
        ],
        [
          { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
          { id: 'e2', from: 'B', to: 'A', weight: 0.3, polarity: '+' },
        ]
      );
      const graph = compileGraph(model);
      const state = createInitialState(model);

      // A: delta = 0.3 * 5 * 1 = 1.5, newValue = 10 + 0.1 * 1.5 = 10.15
      // B: delta = 0.5 * 10 * 1 = 5, newValue = 5 + 0.1 * 5 = 5.5
      const newState = computeStep(state, graph, 0.1);

      expect(newState.values['A']).toBeCloseTo(10.15);
      expect(newState.values['B']).toBeCloseTo(5.5);
    });
  });
});
