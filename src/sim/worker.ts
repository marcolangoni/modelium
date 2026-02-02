/**
 * Modelium Simulation Worker (Skeleton)
 *
 * This worker will handle step-based simulation off the main thread.
 * For Phase 0, it only logs messages and replies with stubs.
 */

import type { SimMessage, SimResult } from './types.ts';

self.onmessage = (event: MessageEvent<SimMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      console.log('[SimWorker] Received init:', msg.model.nodes.length, 'nodes,', msg.model.edges.length, 'edges');
      console.log('[SimWorker] Config:', msg.config);
      postResult({ type: 'ready' });
      break;

    case 'step':
      console.log('[SimWorker] Step requested (no-op)');
      // Future: compute next state and post snapshot
      break;

    case 'stop':
      console.log('[SimWorker] Stop requested');
      postResult({ type: 'done', history: [] });
      break;

    default:
      console.warn('[SimWorker] Unknown message type');
  }
};

function postResult(result: SimResult): void {
  self.postMessage(result);
}

// Signal that worker is loaded
console.log('[SimWorker] Worker loaded and ready');
