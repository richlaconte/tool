// sessionStorage persistence for runs (constitution #6: browser-only state).

import type { GameState } from '../types';

const KEY = 'tactics-fc-save';
const SAVE_VERSION = 1;

export function saveRun(state: GameState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full/blocked — run continues in memory only
  }
}

export function loadRun(): GameState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.saveVersion !== SAVE_VERSION) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function hasSave(): boolean {
  return loadRun() !== null;
}
