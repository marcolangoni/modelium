import type { ModeliumModel } from '../model/schema.ts';

/**
 * Simulation configuration options.
 */
export interface SimConfig {
  dt: number;           // Time step size
  steps: number;        // Number of steps to run
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
  | { type: 'stop' };

/**
 * State snapshot at a given simulation step.
 */
export interface SimStateSnapshot {
  step: number;
  values: Record<string, number>;
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
  | { type: 'paused'; breach: BreachInfo }
  | { type: 'resumed' }
  | { type: 'done'; history: SimStateSnapshot[] }
  | { type: 'error'; message: string };
