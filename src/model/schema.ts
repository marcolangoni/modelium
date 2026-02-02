/**
 * Modelium JSON Schema v1
 */

export type NodeType = 'regular' | 'event';
export type EventType = 'random' | 'fixed';

export interface ModeliumNode {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  // Event node fields
  nodeType?: NodeType;      // 'regular' (default) or 'event'
  eventType?: EventType;    // 'random' or 'fixed' (only if nodeType === 'event')
  intervalMin?: number;     // For random events: min steps between triggers
  intervalMax?: number;     // For random events: max steps between triggers
  interval?: number;        // For fixed events: trigger every N steps
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
    // Validate optional min
    if (node['min'] !== undefined) {
      if (typeof node['min'] !== 'number' || !Number.isFinite(node['min'])) {
        return { valid: false, error: `Node at index ${i} has invalid "min"` };
      }
    }
    // Validate optional max
    if (node['max'] !== undefined) {
      if (typeof node['max'] !== 'number' || !Number.isFinite(node['max'])) {
        return { valid: false, error: `Node at index ${i} has invalid "max"` };
      }
    }
    // Validate min <= max if both present
    if (
      node['min'] !== undefined &&
      node['max'] !== undefined &&
      (node['min'] as number) > (node['max'] as number)
    ) {
      return { valid: false, error: `Node at index ${i} has min > max` };
    }

    // Validate optional nodeType
    if (node['nodeType'] !== undefined) {
      if (node['nodeType'] !== 'regular' && node['nodeType'] !== 'event') {
        return { valid: false, error: `Node at index ${i} has invalid "nodeType" (expected "regular" or "event")` };
      }
    }

    // Validate event-specific fields
    if (node['nodeType'] === 'event') {
      if (node['eventType'] !== 'random' && node['eventType'] !== 'fixed') {
        return { valid: false, error: `Node at index ${i} has invalid "eventType" (expected "random" or "fixed")` };
      }

      if (node['eventType'] === 'random') {
        // Random events require intervalMin and intervalMax
        if (node['intervalMin'] !== undefined) {
          if (typeof node['intervalMin'] !== 'number' || !Number.isFinite(node['intervalMin']) || node['intervalMin'] < 1) {
            return { valid: false, error: `Node at index ${i} has invalid "intervalMin" (must be a positive number)` };
          }
        }
        if (node['intervalMax'] !== undefined) {
          if (typeof node['intervalMax'] !== 'number' || !Number.isFinite(node['intervalMax']) || node['intervalMax'] < 1) {
            return { valid: false, error: `Node at index ${i} has invalid "intervalMax" (must be a positive number)` };
          }
        }
        // Validate intervalMin <= intervalMax if both present
        if (
          node['intervalMin'] !== undefined &&
          node['intervalMax'] !== undefined &&
          (node['intervalMin'] as number) > (node['intervalMax'] as number)
        ) {
          return { valid: false, error: `Node at index ${i} has intervalMin > intervalMax` };
        }
      } else if (node['eventType'] === 'fixed') {
        // Fixed events require interval
        if (node['interval'] !== undefined) {
          if (typeof node['interval'] !== 'number' || !Number.isFinite(node['interval']) || node['interval'] < 1) {
            return { valid: false, error: `Node at index ${i} has invalid "interval" (must be a positive number)` };
          }
        }
      }
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
