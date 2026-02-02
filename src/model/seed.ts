import type { ModeliumModel } from './schema.ts';

/**
 * Default seed model with 3 nodes and 2 directed edges.
 * Demonstrates a simple causal chain with constraints.
 */
export const seedModel: ModeliumModel = {
  version: 1,
  meta: {
    name: 'Demo Model',
    createdAt: new Date().toISOString(),
  },
  nodes: [
    { id: 'A', label: 'Input', value: 10 },
    { id: 'B', label: 'Buffer', value: 0, min: -20, max: 50 },
    { id: 'C', label: 'Output', value: 5, max: 100 },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
    { id: 'e2', from: 'B', to: 'C', weight: 0.3, polarity: '+' },
  ],
};
