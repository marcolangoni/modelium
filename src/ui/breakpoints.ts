/**
 * Breakpoint Manager
 * Manages breakpoints for simulation debugging.
 */

import type { Breakpoint, BreakpointCondition } from '../sim/types.ts';

type BreakpointChangeCallback = (breakpoints: Breakpoint[]) => void;

export interface BreakpointManager {
  add(nodeId: string, condition: BreakpointCondition, value: number): void;
  remove(nodeId: string): void;
  removeAll(): void;
  getAll(): Breakpoint[];
  get(nodeId: string): Breakpoint | undefined;
  has(nodeId: string): boolean;
  onChange(callback: BreakpointChangeCallback): void;
}

export function createBreakpointManager(): BreakpointManager {
  const breakpoints = new Map<string, Breakpoint>();
  const changeCallbacks: BreakpointChangeCallback[] = [];

  function notifyChange(): void {
    const all = Array.from(breakpoints.values());
    for (const cb of changeCallbacks) {
      cb(all);
    }
  }

  return {
    add(nodeId: string, condition: BreakpointCondition, value: number): void {
      breakpoints.set(nodeId, { nodeId, condition, value });
      notifyChange();
    },

    remove(nodeId: string): void {
      if (breakpoints.delete(nodeId)) {
        notifyChange();
      }
    },

    removeAll(): void {
      if (breakpoints.size > 0) {
        breakpoints.clear();
        notifyChange();
      }
    },

    getAll(): Breakpoint[] {
      return Array.from(breakpoints.values());
    },

    get(nodeId: string): Breakpoint | undefined {
      return breakpoints.get(nodeId);
    },

    has(nodeId: string): boolean {
      return breakpoints.has(nodeId);
    },

    onChange(callback: BreakpointChangeCallback): void {
      changeCallbacks.push(callback);
    },
  };
}
