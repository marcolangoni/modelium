import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ModeliumModel } from '../model/schema.ts';

/**
 * Helper to create a valid model for testing.
 */
function createValidModel(): ModeliumModel {
  return {
    version: 1,
    nodes: [
      { id: 'A', label: 'Node A', value: 10 },
      { id: 'B', label: 'Node B', value: 20 },
    ],
    edges: [
      { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
    ],
  };
}

/**
 * Helper to create positions for testing.
 */
function createPositions(): Record<string, { x: number; y: number }> {
  return {
    A: { x: 100, y: 200 },
    B: { x: 300, y: 400 },
  };
}

const STORAGE_KEY = 'modelium-state';

/**
 * Mock localStorage for testing.
 */
function createMockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(key => delete store[key]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store, // For test inspection
  };
}

describe('persistence', () => {
  let mockStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    // Create a fresh mock localStorage for each test
    mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);
    // Clear any timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('saveState', () => {
    it('saves state to localStorage', async () => {
      const { saveState } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();

      saveState(model, positions, 100);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String)
      );

      const stored = mockStorage._store[STORAGE_KEY];
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe(1);
      expect(parsed.model).toEqual(model);
      expect(parsed.positions).toEqual(positions);
      expect(parsed.speedIntervalMs).toBe(100);
      expect(parsed.savedAt).toBeDefined();
    });

    it('overwrites existing state', async () => {
      const { saveState } = await import('./persistence.ts');
      const model1 = createValidModel();
      const model2: ModeliumModel = {
        version: 1,
        nodes: [{ id: 'X', label: 'New Node', value: 50 }],
        edges: [],
      };
      const positions = createPositions();

      saveState(model1, positions, 100);
      saveState(model2, positions, 200);

      const stored = mockStorage._store[STORAGE_KEY];
      const parsed = JSON.parse(stored!);
      expect(parsed.model.nodes[0].id).toBe('X');
      expect(parsed.speedIntervalMs).toBe(200);
    });

    it('handles localStorage errors gracefully', async () => {
      const { saveState } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();

      // Mock localStorage.setItem to throw
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      expect(() => saveState(model, positions, 100)).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        '[Persistence] Failed to save state:',
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });
  });

  describe('loadState', () => {
    it('returns null when no state is saved', async () => {
      const { loadState } = await import('./persistence.ts');

      const result = loadState();

      expect(result).toBeNull();
    });

    it('loads and returns valid saved state', async () => {
      const { saveState, loadState } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();
      saveState(model, positions, 100);

      const result = loadState();

      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.model).toEqual(model);
      expect(result!.positions).toEqual(positions);
      expect(result!.speedIntervalMs).toBe(100);
    });

    it('returns null for invalid JSON', async () => {
      const { loadState } = await import('./persistence.ts');
      mockStorage._store[STORAGE_KEY] = 'not valid json';
      mockStorage.getItem.mockReturnValue('not valid json');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('returns null for missing version', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        model: createValidModel(),
        positions: createPositions(),
        speedIntervalMs: 100,
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for wrong version', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 2,
        model: createValidModel(),
        positions: createPositions(),
        speedIntervalMs: 100,
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for missing speedIntervalMs', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 1,
        model: createValidModel(),
        positions: createPositions(),
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for invalid speedIntervalMs type', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 1,
        model: createValidModel(),
        positions: createPositions(),
        speedIntervalMs: 'not a number',
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for missing savedAt', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 1,
        model: createValidModel(),
        positions: createPositions(),
        speedIntervalMs: 100,
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for missing positions', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 1,
        model: createValidModel(),
        speedIntervalMs: 100,
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for invalid positions type', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 1,
        model: createValidModel(),
        positions: 'not an object',
        speedIntervalMs: 100,
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('returns null for invalid model', async () => {
      const { loadState } = await import('./persistence.ts');
      const invalidState = JSON.stringify({
        version: 1,
        model: { version: 'invalid' },  // Invalid model
        positions: createPositions(),
        speedIntervalMs: 100,
        savedAt: new Date().toISOString(),
      });
      mockStorage._store[STORAGE_KEY] = invalidState;
      mockStorage.getItem.mockReturnValue(invalidState);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();

      warnSpy.mockRestore();
    });

    it('handles localStorage errors gracefully', async () => {
      const { loadState } = await import('./persistence.ts');
      mockStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadState();

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('clearState', () => {
    it('removes state from localStorage', async () => {
      const { saveState, clearState } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();
      saveState(model, positions, 100);

      expect(mockStorage._store[STORAGE_KEY]).toBeDefined();

      clearState();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('does nothing when no state exists', async () => {
      const { clearState } = await import('./persistence.ts');

      // Should not throw
      expect(() => clearState()).not.toThrow();
    });

    it('handles localStorage errors gracefully', async () => {
      const { clearState } = await import('./persistence.ts');
      mockStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      expect(() => clearState()).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('debouncedSave', () => {
    it('saves state after debounce delay', async () => {
      const { debouncedSave } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();

      debouncedSave(model, positions, 100);

      // State should not be saved immediately
      expect(mockStorage._store[STORAGE_KEY]).toBeUndefined();

      // Fast-forward time
      vi.advanceTimersByTime(500);

      // Now state should be saved
      expect(mockStorage._store[STORAGE_KEY]).toBeDefined();
    });

    it('resets debounce timer on subsequent calls', async () => {
      const { debouncedSave } = await import('./persistence.ts');
      const model1 = createValidModel();
      const model2: ModeliumModel = {
        version: 1,
        nodes: [{ id: 'X', label: 'New Node', value: 50 }],
        edges: [],
      };
      const positions = createPositions();

      debouncedSave(model1, positions, 100);

      // Advance part of the way
      vi.advanceTimersByTime(300);

      // Call again with different model
      debouncedSave(model2, positions, 200);

      // Advance remaining time from first call (200ms more)
      vi.advanceTimersByTime(200);

      // Should not be saved yet (timer was reset)
      expect(mockStorage._store[STORAGE_KEY]).toBeUndefined();

      // Advance full debounce from second call
      vi.advanceTimersByTime(300);

      // Now should be saved with second model
      const stored = mockStorage._store[STORAGE_KEY];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.model.nodes[0].id).toBe('X');
      expect(parsed.speedIntervalMs).toBe(200);
    });
  });

  describe('flushSave', () => {
    it('saves state immediately', async () => {
      const { flushSave } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();

      flushSave(model, positions, 100);

      // State should be saved immediately (no timer needed)
      expect(mockStorage._store[STORAGE_KEY]).toBeDefined();
    });

    it('cancels pending debounced save', async () => {
      const { debouncedSave, flushSave } = await import('./persistence.ts');
      const model1 = createValidModel();
      const model2: ModeliumModel = {
        version: 1,
        nodes: [{ id: 'X', label: 'New Node', value: 50 }],
        edges: [],
      };
      const positions = createPositions();

      // Start a debounced save
      debouncedSave(model1, positions, 100);

      // Flush with different model
      flushSave(model2, positions, 200);

      // Should have the flushed model
      let stored = mockStorage._store[STORAGE_KEY];
      let parsed = JSON.parse(stored!);
      expect(parsed.model.nodes[0].id).toBe('X');

      // Fast-forward past debounce time
      vi.advanceTimersByTime(1000);

      // Should still have the flushed model (debounced save was cancelled)
      stored = mockStorage._store[STORAGE_KEY];
      parsed = JSON.parse(stored!);
      expect(parsed.model.nodes[0].id).toBe('X');
      expect(parsed.speedIntervalMs).toBe(200);
    });

    it('works when no pending debounced save exists', async () => {
      const { flushSave } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();

      // Should not throw
      expect(() => flushSave(model, positions, 100)).not.toThrow();

      expect(mockStorage._store[STORAGE_KEY]).toBeDefined();
    });
  });

  describe('round-trip', () => {
    it('saves and loads state correctly', async () => {
      const { saveState, loadState } = await import('./persistence.ts');
      const model = createValidModel();
      const positions = createPositions();
      const speedIntervalMs = 150;

      saveState(model, positions, speedIntervalMs);
      const loaded = loadState();

      expect(loaded).not.toBeNull();
      expect(loaded!.model).toEqual(model);
      expect(loaded!.positions).toEqual(positions);
      expect(loaded!.speedIntervalMs).toBe(speedIntervalMs);
    });

    it('preserves complex model data', async () => {
      const { saveState, loadState } = await import('./persistence.ts');
      const model: ModeliumModel = {
        version: 1,
        meta: {
          name: 'Test Model',
          createdAt: '2026-02-01T00:00:00Z',
        },
        nodes: [
          { id: 'A', label: 'Input', value: 10 },
          { id: 'B', label: 'Buffer', value: 0, min: -20, max: 50 },
          { id: 'C', label: 'Output', value: 5, max: 100 },
        ],
        edges: [
          { id: 'e1', from: 'A', to: 'B', weight: 0.5, polarity: '+' },
          { id: 'e2', from: 'B', to: 'C', weight: 0.3, polarity: '-' },
        ],
      };
      const positions = {
        A: { x: 100, y: 200 },
        B: { x: 300, y: 400 },
        C: { x: 500, y: 600 },
      };

      saveState(model, positions, 250);
      const loaded = loadState();

      expect(loaded).not.toBeNull();
      expect(loaded!.model).toEqual(model);
      expect(loaded!.positions).toEqual(positions);
    });
  });
});
