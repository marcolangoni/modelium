/**
 * Modelium Simulation Worker
 * Runs step-based simulation off the main thread.
 */

import type { ModeliumModel } from '../model/schema.ts';
import type { SimConfig, SimMessage, SimResult, SimStateSnapshot } from './types.ts';
import { compileGraph, computeStep, createInitialState, type SimState } from './engine.ts';

// Worker state
let model: ModeliumModel | null = null;
let config: SimConfig | null = null;
let compiledGraph: ReturnType<typeof compileGraph> | null = null;
let state: SimState | null = null;
let initialState: SimState | null = null;
let loopId: ReturnType<typeof setInterval> | null = null;
let history: SimStateSnapshot[] = [];

function postResult(result: SimResult): void {
  self.postMessage(result);
}

function stopLoop(): void {
  if (loopId !== null) {
    clearInterval(loopId);
    loopId = null;
  }
}

function runStep(): void {
  if (!state || !compiledGraph || !config) return;

  const newState = computeStep(state, compiledGraph, config.dt);
  state = newState;

  const snapshot: SimStateSnapshot = {
    step: state.step,
    values: { ...state.values },
  };
  history.push(snapshot);

  postResult({ type: 'state', snapshot });

  // Check for breach - auto-pause
  if (state.breached) {
    stopLoop();
    postResult({ type: 'paused', breach: state.breached });
    return;
  }

  // Check for max steps reached
  if (state.step >= config.steps) {
    stopLoop();
    postResult({ type: 'done', history });
  }
}

function startLoop(): void {
  stopLoop();
  // Run at ~60fps (16ms intervals)
  loopId = setInterval(runStep, 16);
}

self.onmessage = (event: MessageEvent<SimMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      stopLoop();
      model = msg.model;
      config = msg.config;
      compiledGraph = compileGraph(model);
      initialState = createInitialState(model);
      state = { ...initialState, values: { ...initialState.values } };
      history = [];
      postResult({ type: 'ready' });
      break;

    case 'run':
      if (!state) {
        postResult({ type: 'error', message: 'Not initialized' });
        return;
      }
      history = [];
      startLoop();
      break;

    case 'pause':
      stopLoop();
      break;

    case 'resume':
      if (!state) {
        postResult({ type: 'error', message: 'Not initialized' });
        return;
      }
      // Clear breach flag to allow continuation
      state = { ...state, breached: null };
      postResult({ type: 'resumed' });
      startLoop();
      break;

    case 'reset':
      stopLoop();
      if (!initialState) {
        postResult({ type: 'error', message: 'Not initialized' });
        return;
      }
      state = { ...initialState, values: { ...initialState.values } };
      history = [];
      postResult({
        type: 'state',
        snapshot: { step: state.step, values: { ...state.values } },
      });
      break;

    case 'stop':
      stopLoop();
      postResult({ type: 'done', history });
      break;

    default:
      postResult({ type: 'error', message: 'Unknown message type' });
  }
};

console.log('[SimWorker] Worker loaded and ready');
