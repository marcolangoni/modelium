import { describe, it, expect } from 'vitest';
import { validateModel, type ModeliumModel } from './schema.ts';

/**
 * Helper to create a valid minimal model for testing.
 */
function createValidModel(overrides: Partial<ModeliumModel> = {}): ModeliumModel {
  return {
    version: 1,
    nodes: [
      { id: 'A', label: 'Node A', value: 10 },
    ],
    edges: [],
    ...overrides,
  };
}

describe('validateModel', () => {
  describe('valid models', () => {
    it('accepts a minimal valid model', () => {
      const model = createValidModel();
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.model).toEqual(model);
      }
    });

    it('accepts a model with multiple nodes and edges', () => {
      const model = createValidModel({
        nodes: [
          { id: 'A', label: 'Input', value: 10 },
          { id: 'B', label: 'Buffer', value: 0, min: -20, max: 50 },
          { id: 'C', label: 'Output', value: 5, max: 100 },
        ],
        edges: [
          { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
          { id: 'e2', from: 'B', to: 'C', weight: 0.3, polarity: '-' },
        ],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts a model with optional meta field', () => {
      const model = createValidModel({
        meta: { name: 'Test Model', createdAt: '2026-02-01T00:00:00Z' },
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts nodes with only min constraint', () => {
      const model = createValidModel({
        nodes: [{ id: 'A', label: 'Node A', value: 10, min: 0 }],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts nodes with only max constraint', () => {
      const model = createValidModel({
        nodes: [{ id: 'A', label: 'Node A', value: 10, max: 100 }],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts nodes with min equal to max', () => {
      const model = createValidModel({
        nodes: [{ id: 'A', label: 'Node A', value: 50, min: 50, max: 50 }],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts negative values', () => {
      const model = createValidModel({
        nodes: [{ id: 'A', label: 'Node A', value: -10, min: -100, max: -5 }],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts zero values', () => {
      const model = createValidModel({
        nodes: [{ id: 'A', label: 'Node A', value: 0 }],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });

    it('accepts empty nodes and edges arrays', () => {
      const model = createValidModel({
        nodes: [],
        edges: [],
      });
      const result = validateModel(model);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid JSON structure', () => {
    it('rejects null', () => {
      const result = validateModel(null);
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Invalid JSON: expected an object');
      }
    });

    it('rejects primitives', () => {
      expect(validateModel(42)).toEqual({ valid: false, error: 'Invalid JSON: expected an object' });
      expect(validateModel('string')).toEqual({ valid: false, error: 'Invalid JSON: expected an object' });
      expect(validateModel(true)).toEqual({ valid: false, error: 'Invalid JSON: expected an object' });
      expect(validateModel(undefined)).toEqual({ valid: false, error: 'Invalid JSON: expected an object' });
    });

    it('rejects arrays', () => {
      const result = validateModel([]);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('version validation', () => {
    it('rejects missing version', () => {
      const result = validateModel({ nodes: [], edges: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Unsupported or missing version (expected 1)');
      }
    });

    it('rejects wrong version number', () => {
      const result = validateModel({ version: 2, nodes: [], edges: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Unsupported or missing version (expected 1)');
      }
    });

    it('rejects version as string', () => {
      const result = validateModel({ version: '1', nodes: [], edges: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Unsupported or missing version (expected 1)');
      }
    });
  });

  describe('nodes validation', () => {
    it('rejects missing nodes array', () => {
      const result = validateModel({ version: 1, edges: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Missing or invalid "nodes" array');
      }
    });

    it('rejects nodes as non-array', () => {
      const result = validateModel({ version: 1, nodes: 'not an array', edges: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Missing or invalid "nodes" array');
      }
    });

    it('rejects node that is not an object', () => {
      const result = validateModel({ version: 1, nodes: ['not an object'], edges: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 is not an object');
      }
    });

    it('rejects node with missing id', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ label: 'Test', value: 10 }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "id"');
      }
    });

    it('rejects node with empty id', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: '', label: 'Test', value: 10 }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "id"');
      }
    });

    it('rejects node with non-string id', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 123, label: 'Test', value: 10 }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "id"');
      }
    });

    it('rejects node with missing label', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', value: 10 }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "label"');
      }
    });

    it('rejects node with non-string label', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 123, value: 10 }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "label"');
      }
    });

    it('rejects node with missing value', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test' }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "value"');
      }
    });

    it('rejects node with non-number value', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: '10' }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "value"');
      }
    });

    it('rejects node with Infinity value', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: Infinity }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "value"');
      }
    });

    it('rejects node with NaN value', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: NaN }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "value"');
      }
    });

    it('rejects node with invalid min', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: 10, min: 'not a number' }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "min"');
      }
    });

    it('rejects node with Infinity min', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: 10, min: Infinity }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "min"');
      }
    });

    it('rejects node with invalid max', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: 10, max: 'not a number' }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "max"');
      }
    });

    it('rejects node with NaN max', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: 10, max: NaN }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has invalid "max"');
      }
    });

    it('rejects node with min > max', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'Test', value: 10, min: 100, max: 0 }],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 0 has min > max');
      }
    });

    it('reports error for second invalid node', () => {
      const result = validateModel({
        version: 1,
        nodes: [
          { id: 'A', label: 'Valid', value: 10 },
          { id: '', label: 'Invalid', value: 20 },
        ],
        edges: [],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Node at index 1 has invalid "id"');
      }
    });
  });

  describe('edges validation', () => {
    it('rejects missing edges array', () => {
      const result = validateModel({ version: 1, nodes: [] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Missing or invalid "edges" array');
      }
    });

    it('rejects edges as non-array', () => {
      const result = validateModel({ version: 1, nodes: [], edges: {} });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Missing or invalid "edges" array');
      }
    });

    it('rejects edge that is not an object', () => {
      const result = validateModel({ version: 1, nodes: [], edges: [null] });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 is not an object');
      }
    });

    it('rejects edge with missing id', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ from: 'A', to: 'B', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "id"');
      }
    });

    it('rejects edge with empty id', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: '', from: 'A', to: 'B', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "id"');
      }
    });

    it('rejects edge with missing from', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', to: 'B', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "from"');
      }
    });

    it('rejects edge with empty from', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: '', to: 'B', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "from"');
      }
    });

    it('rejects edge with missing to', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "to"');
      }
    });

    it('rejects edge with empty to', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', to: '', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "to"');
      }
    });

    it('rejects edge with missing weight', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', to: 'B', polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "weight"');
      }
    });

    it('rejects edge with non-number weight', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', to: 'B', weight: '0.5', polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "weight"');
      }
    });

    it('rejects edge with Infinity weight', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', to: 'B', weight: -Infinity, polarity: '+' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "weight"');
      }
    });

    it('rejects edge with missing polarity', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', to: 'B', weight: 0.5 }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "polarity" (expected "+" or "-")');
      }
    });

    it('rejects edge with invalid polarity', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '*' }],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 0 has invalid "polarity" (expected "+" or "-")');
      }
    });

    it('accepts positive polarity', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'A', value: 0 }, { id: 'B', label: 'B', value: 0 }],
        edges: [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' }],
      });
      
      expect(result.valid).toBe(true);
    });

    it('accepts negative polarity', () => {
      const result = validateModel({
        version: 1,
        nodes: [{ id: 'A', label: 'A', value: 0 }, { id: 'B', label: 'B', value: 0 }],
        edges: [{ id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '-' }],
      });
      
      expect(result.valid).toBe(true);
    });

    it('reports error for second invalid edge', () => {
      const result = validateModel({
        version: 1,
        nodes: [],
        edges: [
          { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
          { id: 'e2', from: 'B', to: 'C', weight: 0.5, polarity: 'invalid' },
        ],
      });
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Edge at index 1 has invalid "polarity" (expected "+" or "-")');
      }
    });
  });
});
