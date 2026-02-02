import type { ModeliumModel } from './schema.ts';

/**
 * Default seed model with 2 nodes and 1 directed edge.
 * Used to initialize the graph on first load.
 */
export const seedModel: ModeliumModel = {
  version: 1,
  meta: {
    name: 'Demo Model',
    createdAt: new Date().toISOString(),
  },
  nodes: [
    { id: 'A', label: 'Cause', value: 10 },
    { id: 'B', label: 'Effect', value: 0, max: 50 },
  ],
  edges: [
    { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
  ],
};
