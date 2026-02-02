/**
 * Modelium Simulation Worker
 * Runs step-based simulation off the main thread.
 */

import type { ModeliumModel } from '../model/schema.ts';
import type { Breakpoint, BreakpointHit, SimConfig, SimMessage, SimResult, SimStateSnapshot } from './types.ts';
import { compileGraph, computeStep, createInitialState, type SimState } from './engine.ts';

// Worker state
let model: ModeliumModel | null = null;
let config: SimConfig | null = null;
let compiledGraph: ReturnType<typeof compileGraph> | null = null;
let state: SimState | null = null;
let initialState: SimState | null = null;
let loopId: ReturnType<typeof setInterval> | null = null;
let history: SimStateSnapshot[] = [];
let intervalMs = 16; // Default ~60fps
let breakpoints: Breakpoint[] = [];

function postResult(result: SimResult): void {
  self.postMessage(result);
}

function stopLoop(): void {
  if (loopId !== null) {
    clearInterval(loopId);
    loopId = null;
  }
}

/**
 * Checks if a breakpoint condition is met.
 */
function checkBreakpointCondition(bp: Breakpoint, actualValue: number): boolean {
  switch (bp.condition) {
    case 'eq': return actualValue === bp.value;
    case 'gt': return actualValue > bp.value;
    case 'lt': return actualValue < bp.value;
    case 'gte': return actualValue >= bp.value;
    case 'lte': return actualValue <= bp.value;
    default: return false;
  }
}

/**
 * Checks all breakpoints against current state values.
 * Returns the first hit breakpoint, or null if none are hit.
 */
function checkBreakpoints(values: Record<string, number>): BreakpointHit | null {
  for (const bp of breakpoints) {
    const actualValue = values[bp.nodeId];
    if (actualValue !== undefined && checkBreakpointCondition(bp, actualValue)) {
      return { breakpoint: bp, actualValue };
    }
  }
  return null;
}

function runStep(): boolean {
  if (!state || !compiledGraph || !config) return false;

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
    return false;
  }

  // Check for breakpoints
  const hit = checkBreakpoints(state.values);
  if (hit) {
    stopLoop();
    postResult({ type: 'breakpointHit', hit });
    return false;
  }

  // Check for max steps reached
  if (state.step >= config.steps) {
    stopLoop();
    postResult({ type: 'done', history });
    return false;
  }

  return true;
}

function startLoop(): void {
  stopLoop();
  loopId = setInterval(runStep, intervalMs);
}

self.onmessage = (event: MessageEvent<SimMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      stopLoop();
      model = msg.model;
      config = msg.config;
      intervalMs = config.intervalMs ?? 16;
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

    case 'step':
      if (!state) {
        postResult({ type: 'error', message: 'Not initialized' });
        return;
      }
      // Clear breach flag to allow stepping
      state = { ...state, breached: null };
      // Only send 'stepped' if runStep() didn't hit a breakpoint or breach
      const stepSucceeded = runStep();
      if (stepSucceeded) {
        postResult({ type: 'stepped', snapshot: { step: state.step, values: { ...state.values } } });
      }
      break;

    case 'setSpeed':
      intervalMs = msg.intervalMs;
      // If currently running, restart with new interval
      if (loopId !== null) {
        startLoop();
      }
      break;

    case 'updateBreakpoints':
      breakpoints = msg.breakpoints;
      break;

    default:
      postResult({ type: 'error', message: 'Unknown message type' });
  }
};

console.log('[SimWorker] Worker loaded and ready');
