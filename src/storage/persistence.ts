/**
 * Persistence Module
 * Saves and loads diagram state from localStorage.
 */

import type { ModeliumModel } from '../model/schema.ts';
import { validateModel } from '../model/schema.ts';

const STORAGE_KEY = 'modelium-state';

export interface PersistedState {
  version: 1;
  model: ModeliumModel;
  positions: Record<string, { x: number; y: number }>;
  speedIntervalMs: number;
  savedAt: string;
}

/**
 * Validates a persisted state object.
 */
function isValidPersistedState(state: unknown): state is PersistedState {
  if (typeof state !== 'object' || state === null) return false;
  
  const obj = state as Record<string, unknown>;
  
  if (obj['version'] !== 1) return false;
  if (typeof obj['speedIntervalMs'] !== 'number') return false;
  if (typeof obj['savedAt'] !== 'string') return false;
  if (typeof obj['positions'] !== 'object' || obj['positions'] === null) return false;
  
  // Validate the model
  const modelResult = validateModel(obj['model']);
  if (!modelResult.valid) return false;
  
  return true;
}

/**
 * Saves the current state to localStorage.
 */
export function saveState(
  model: ModeliumModel,
  positions: Record<string, { x: number; y: number }>,
  speedIntervalMs: number
): void {
  const state: PersistedState = {
    version: 1,
    model,
    positions,
    speedIntervalMs,
    savedAt: new Date().toISOString(),
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[Persistence] Failed to save state:', e);
  }
}

/**
 * Loads the saved state from localStorage.
 * Returns null if no valid state is found.
 */
export function loadState(): PersistedState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    
    const parsed = JSON.parse(json);
    if (!isValidPersistedState(parsed)) {
      console.warn('[Persistence] Invalid saved state, ignoring');
      return null;
    }
    
    return parsed;
  } catch (e) {
    console.warn('[Persistence] Failed to load state:', e);
    return null;
  }
}

/**
 * Clears the saved state from localStorage.
 */
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[Persistence] Failed to clear state:', e);
  }
}

/**
 * Debounced save function to avoid excessive writes during simulation.
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

export function debouncedSave(
  model: ModeliumModel,
  positions: Record<string, { x: number; y: number }>,
  speedIntervalMs: number
): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(() => {
    saveState(model, positions, speedIntervalMs);
    saveTimeout = null;
  }, DEBOUNCE_MS);
}

/**
 * Immediately saves the state, cancelling any pending debounced save.
 */
export function flushSave(
  model: ModeliumModel,
  positions: Record<string, { x: number; y: number }>,
  speedIntervalMs: number
): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveState(model, positions, speedIntervalMs);
}
