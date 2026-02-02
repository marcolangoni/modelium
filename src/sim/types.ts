import type { ModeliumModel } from '../model/schema.ts';

/**
 * Simulation configuration options.
 */
export interface SimConfig {
  dt: number;           // Time step size
  steps: number;        // Number of steps to run
  clamp?: {
    min: number;
    max: number;
  };
}

/**
 * Messages sent from main thread to simulation worker.
 */
export type SimMessage =
  | { type: 'init'; model: ModeliumModel; config: SimConfig }
  | { type: 'step' }
  | { type: 'stop' };

/**
 * State snapshot at a given simulation step.
 */
export interface SimStateSnapshot {
  step: number;
  values: Record<string, number>;
}

/**
 * Messages sent from simulation worker back to main thread.
 */
export type SimResult =
  | { type: 'ready' }
  | { type: 'state'; snapshot: SimStateSnapshot }
  | { type: 'done'; history: SimStateSnapshot[] }
  | { type: 'error'; message: string };
