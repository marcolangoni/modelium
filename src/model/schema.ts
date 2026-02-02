/**
 * Modelium JSON Schema v1
 */

export interface ModeliumNode {
  id: string;
  label: string;
  value: number;
}

export interface ModeliumEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  polarity: '+' | '-';
}

export interface ModeliumMeta {
  name?: string;
  createdAt?: string;
}

export interface ModeliumModel {
  version: 1;
  meta?: ModeliumMeta;
  nodes: ModeliumNode[];
  edges: ModeliumEdge[];
}

export type ValidationResult =
  | { valid: true; model: ModeliumModel }
  | { valid: false; error: string };

/**
 * Validates a parsed JSON object against the Modelium schema.
 * Returns a discriminated union for type-safe handling.
 */
export function validateModel(json: unknown): ValidationResult {
  if (typeof json !== 'object' || json === null) {
    return { valid: false, error: 'Invalid JSON: expected an object' };
  }

  const obj = json as Record<string, unknown>;

  // Check version
  if (obj['version'] !== 1) {
    return { valid: false, error: 'Unsupported or missing version (expected 1)' };
  }

  // Check nodes array
  if (!Array.isArray(obj['nodes'])) {
    return { valid: false, error: 'Missing or invalid "nodes" array' };
  }

  for (let i = 0; i < obj['nodes'].length; i++) {
    const node = obj['nodes'][i] as Record<string, unknown>;
    if (typeof node !== 'object' || node === null) {
      return { valid: false, error: `Node at index ${i} is not an object` };
    }
    if (typeof node['id'] !== 'string' || node['id'] === '') {
      return { valid: false, error: `Node at index ${i} has invalid "id"` };
    }
    if (typeof node['label'] !== 'string') {
      return { valid: false, error: `Node at index ${i} has invalid "label"` };
    }
    if (typeof node['value'] !== 'number' || !Number.isFinite(node['value'])) {
      return { valid: false, error: `Node at index ${i} has invalid "value"` };
    }
  }

  // Check edges array
  if (!Array.isArray(obj['edges'])) {
    return { valid: false, error: 'Missing or invalid "edges" array' };
  }

  for (let i = 0; i < obj['edges'].length; i++) {
    const edge = obj['edges'][i] as Record<string, unknown>;
    if (typeof edge !== 'object' || edge === null) {
      return { valid: false, error: `Edge at index ${i} is not an object` };
    }
    if (typeof edge['id'] !== 'string' || edge['id'] === '') {
      return { valid: false, error: `Edge at index ${i} has invalid "id"` };
    }
    if (typeof edge['from'] !== 'string' || edge['from'] === '') {
      return { valid: false, error: `Edge at index ${i} has invalid "from"` };
    }
    if (typeof edge['to'] !== 'string' || edge['to'] === '') {
      return { valid: false, error: `Edge at index ${i} has invalid "to"` };
    }
    if (typeof edge['weight'] !== 'number' || !Number.isFinite(edge['weight'])) {
      return { valid: false, error: `Edge at index ${i} has invalid "weight"` };
    }
    if (edge['polarity'] !== '+' && edge['polarity'] !== '-') {
      return { valid: false, error: `Edge at index ${i} has invalid "polarity" (expected "+" or "-")` };
    }
  }

  return { valid: true, model: obj as unknown as ModeliumModel };
}
