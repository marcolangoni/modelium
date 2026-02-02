/**
 * Keyboard Shortcuts Handler
 * Provides keyboard controls for simulation debugging.
 */

import type { SimController } from './sim-controls.ts';

// Speed levels in milliseconds (lower = faster)
const SPEED_LEVELS = [4, 8, 16, 32, 64, 128, 256, 512];
const DEFAULT_SPEED_INDEX = 2; // 16ms = 1x speed

type SpeedChangeCallback = (intervalMs: number, label: string) => void;

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
 */
export function initKeyboardShortcuts(
  getController: () => SimController | null,
  onSpeedChange?: SpeedChangeCallback
): KeyboardHandler {
  let currentSpeedIndex = DEFAULT_SPEED_INDEX;

  function halveSpeed(): void {
    const controller = getController();
    if (!controller) return;

    if (currentSpeedIndex < SPEED_LEVELS.length - 1) {
      currentSpeedIndex++;
      const intervalMs = SPEED_LEVELS[currentSpeedIndex]!;
      controller.setSpeed(intervalMs);
      onSpeedChange?.(intervalMs, getSpeedLabel(intervalMs));
    }
  }

  function doubleSpeed(): void {
    const controller = getController();
    if (!controller) return;

    if (currentSpeedIndex > 0) {
      currentSpeedIndex--;
      const intervalMs = SPEED_LEVELS[currentSpeedIndex]!;
      controller.setSpeed(intervalMs);
      onSpeedChange?.(intervalMs, getSpeedLabel(intervalMs));
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
