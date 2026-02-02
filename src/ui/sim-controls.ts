/**
 * Simulation Controller
 * Manages the Web Worker lifecycle and exposes status callbacks.
 */

import type { ModeliumModel } from '../model/schema.ts';
import type { SimConfig, SimMessage, SimResult, SimStateSnapshot, BreachInfo } from '../sim/types.ts';

export type SimStatus = 'idle' | 'running' | 'paused' | 'done';

type StateCallback = (snapshot: SimStateSnapshot) => void;
type StatusCallback = (status: SimStatus, breach?: BreachInfo) => void;

export interface SimController {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  getStatus(): SimStatus;
  onStateChange(callback: StateCallback): void;
  onStatusChange(callback: StatusCallback): void;
  dispose(): void;
}

const DEFAULT_CONFIG: SimConfig = {
  dt: 0.1,
  steps: 1000,
};

export function createSimController(getModel: () => ModeliumModel): SimController {
  const worker = new Worker(
    new URL('../sim/worker.ts', import.meta.url),
    { type: 'module' }
  );

  let status: SimStatus = 'idle';
  const stateCallbacks: StateCallback[] = [];
  const statusCallbacks: StatusCallback[] = [];

  function setStatus(newStatus: SimStatus, breach?: BreachInfo): void {
    status = newStatus;
    for (const cb of statusCallbacks) {
      cb(status, breach);
    }
  }

  function postMessage(msg: SimMessage): void {
    worker.postMessage(msg);
  }

  worker.onmessage = (event: MessageEvent<SimResult>) => {
    const result = event.data;

    switch (result.type) {
      case 'ready':
        // Worker is ready after init
        break;

      case 'state':
        for (const cb of stateCallbacks) {
          cb(result.snapshot);
        }
        break;

      case 'paused':
        setStatus('paused', result.breach);
        break;

      case 'resumed':
        setStatus('running');
        break;

      case 'done':
        setStatus('done');
        break;

      case 'error':
        console.error('[SimController] Worker error:', result.message);
        setStatus('idle');
        break;
    }
  };

  worker.onerror = (error) => {
    console.error('[SimController] Worker error:', error);
    setStatus('idle');
  };

  return {
    start(): void {
      const model = getModel();
      postMessage({ type: 'init', model, config: DEFAULT_CONFIG });
      // Small delay to ensure init completes, then run
      setTimeout(() => {
        postMessage({ type: 'run' });
        setStatus('running');
      }, 10);
    },

    pause(): void {
      postMessage({ type: 'pause' });
      setStatus('paused');
    },

    resume(): void {
      postMessage({ type: 'resume' });
      // Status will be set to 'running' when worker responds with 'resumed'
    },

    reset(): void {
      postMessage({ type: 'reset' });
      setStatus('idle');
    },

    getStatus(): SimStatus {
      return status;
    },

    onStateChange(callback: StateCallback): void {
      stateCallbacks.push(callback);
    },

    onStatusChange(callback: StatusCallback): void {
      statusCallbacks.push(callback);
    },

    dispose(): void {
      worker.terminate();
    },
  };
}
