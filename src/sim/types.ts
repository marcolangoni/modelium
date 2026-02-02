import type { ModeliumModel } from '../model/schema.ts';

/**
 * Breakpoint condition types for simulation debugging.
 */
export type BreakpointCondition = 'eq' | 'gt' | 'lt' | 'gte' | 'lte';

/**
 * A breakpoint that pauses simulation when a node reaches a specific value.
 */
export interface Breakpoint {
  nodeId: string;
  condition: BreakpointCondition;
  value: number;
}

/**
 * Information about a breakpoint that was hit.
 */
export interface BreakpointHit {
  breakpoint: Breakpoint;
  actualValue: number;
}

/**
 * Simulation configuration options.
 */
export interface SimConfig {
  dt: number;           // Time step size
  steps: number;        // Number of steps to run
  intervalMs: number;   // Update interval in milliseconds
}

/**
 * Messages sent from main thread to simulation worker.
 */
export type SimMessage =
  | { type: 'init'; model: ModeliumModel; config: SimConfig }
  | { type: 'run' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'stop' }
  | { type: 'step' }
  | { type: 'setSpeed'; intervalMs: number }
  | { type: 'updateBreakpoints'; breakpoints: Breakpoint[] };

/**
 * State snapshot at a given simulation step.
 */
export interface SimStateSnapshot {
  step: number;
  values: Record<string, number>;
  triggeredEvents?: string[];  // IDs of events that triggered this step
}

/**
 * Information about a constraint breach.
 */
export interface BreachInfo {
  nodeId: string;
  constraint: 'min' | 'max';
  value: number;
  limit: number;
}

/**
 * Messages sent from simulation worker back to main thread.
 */
export type SimResult =
  | { type: 'ready' }
  | { type: 'state'; snapshot: SimStateSnapshot }
  | { type: 'paused'; breach?: BreachInfo }
  | { type: 'resumed' }
  | { type: 'done'; history: SimStateSnapshot[] }
  | { type: 'error'; message: string }
  | { type: 'breakpointHit'; hit: BreakpointHit }
  | { type: 'stepped'; snapshot: SimStateSnapshot };
