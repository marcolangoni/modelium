/**
 * Keyboard Shortcuts Handler
 * Provides keyboard controls for simulation debugging.
 */

import type { SimController } from './sim-controls.ts';

export interface KeyboardHandler {
  dispose(): void;
}

/**
 * Gets a human-readable label for a speed interval.
 */
export function getSpeedLabel(intervalMs: number): string {
  const baseInterval = 16;
  const ratio = baseInterval / intervalMs;

  if (ratio >= 1) {
    return `${ratio}x`;
  } else {
    return `${(1 / ratio).toFixed(1)}x slower`;
  }
}

/**
 * Initializes keyboard shortcuts for simulation control.
 * Speed changes use the provided callbacks to work with or without simController.
 */
export function initKeyboardShortcuts(
  getController: () => SimController | null,
  onSpeedChange: (intervalMs: number, label: string) => void,
  getIntervalMs: () => number,
  setIntervalMs: (intervalMs: number) => void
): KeyboardHandler {
  function halveSpeed(): void {
    const currentInterval = getIntervalMs();
    const newInterval = Math.min(currentInterval * 2, 512);
    if (newInterval !== currentInterval) {
      setIntervalMs(newInterval);
      onSpeedChange(newInterval, getSpeedLabel(newInterval));
    }
  }

  function doubleSpeed(): void {
    const currentInterval = getIntervalMs();
    const newInterval = Math.max(currentInterval / 2, 4);
    if (newInterval !== currentInterval) {
      setIntervalMs(newInterval);
      onSpeedChange(newInterval, getSpeedLabel(newInterval));
    }
  }

  function togglePlayPause(): void {
    const controller = getController();
    if (!controller) return;

    const status = controller.getStatus();
    if (status === 'running') {
      controller.pause();
    } else if (status === 'paused') {
      controller.resume();
    }
  }

  function stepOnce(): void {
    const controller = getController();
    if (!controller) return;

    const status = controller.getStatus();
    if (status === 'paused' || status === 'idle') {
      controller.step();
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // Skip if typing in an input or textarea
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        togglePlayPause();
        break;

      case '-':
      case '[':
        event.preventDefault();
        halveSpeed();
        break;

      case '=':
      case '+':
      case ']':
        event.preventDefault();
        doubleSpeed();
        break;

      case 's':
      case 'S':
      case 'n':
      case 'N':
        event.preventDefault();
        stepOnce();
        break;
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  return {
    dispose(): void {
      document.removeEventListener('keydown', handleKeyDown);
    },
  };
}
