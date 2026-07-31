// Zustand store — the only mutable thing. UI dispatches intents; the store
// applies them through sim functions and holds the resulting GameState.

import { create } from 'zustand';
import type { GameState, ManagerState, PositionLine } from '../types';
import { buy, reroll, sell } from '../sim/shop';
import {
  advanceRound,
  createRun,
  PLAYER_ID,
  resolveRound,
} from '../sim/tournament';
import { deriveSeed, makeRng } from '../sim/rng';
import { generateRunPool } from '../sim/players';
import { clearRun, loadRun, saveRun } from './persist';

export type Screen = 'LANDING' | 'GAME';

interface StoreState {
  screen: Screen;
  game: GameState | null;
  /** True while the player is watching the match playback (game.phase is already RESULTS). */
  watchingMatch: boolean;
  rerollCount: number;
  saveAvailable: boolean;

  newRun: () => void;
  continueRun: () => void;
  abandonRun: () => void;

  buyCard: (cardId: string) => void;
  sellCard: (cardId: string) => void;
  rerollShop: () => void;
  confirmTransfer: () => void;

  placePlayer: (cardId: string, slot: PositionLine) => void;
  unplacePlayer: (cardId: string) => void;
  kickOff: () => void;

  finishMatch: () => void;
  nextRound: () => void;
  rematch: () => void;
}

function playerOf(game: GameState): ManagerState {
  return game.managers.find((m) => m.id === PLAYER_ID)!;
}

function replacePlayer(game: GameState, next: ManagerState): GameState {
  return {
    ...game,
    managers: game.managers.map((m) => (m.id === PLAYER_ID ? next : m)),
  };
}

function persist(game: GameState | null): void {
  if (game) saveRun(game);
}

export const useStore = create<StoreState>((set, get) => ({
  screen: 'LANDING',
  game: null,
  watchingMatch: false,
  rerollCount: 0,
  saveAvailable: loadRun() !== null,

  newRun: () => {
    const seed = Math.floor(Math.random() * 2 ** 31); // UI-layer entropy only; sim stays seeded
    const game = createRun(seed);
    persist(game);
    set({ screen: 'GAME', game, watchingMatch: false, rerollCount: 0, saveAvailable: true });
  },

  continueRun: () => {
    const game = loadRun();
    if (game) set({ screen: 'GAME', game, watchingMatch: false });
  },

  abandonRun: () => {
    clearRun();
    set({ screen: 'LANDING', game: null, watchingMatch: false, saveAvailable: false });
  },

  buyCard: (cardId) => {
    const { game } = get();
    if (!game || game.phase !== 'TRANSFER_WINDOW') return;
    const res = buy(playerOf(game), game.currentShop, cardId);
    if (!res) return;
    const next = {
      ...replacePlayer(game, res.manager),
      currentShop: res.shop,
    };
    persist(next);
    set({ game: next });
  },

  sellCard: (cardId) => {
    const { game } = get();
    if (!game || game.phase !== 'TRANSFER_WINDOW') return;
    const next_manager = sell(playerOf(game), cardId);
    if (!next_manager) return;
    const next = replacePlayer(game, next_manager);
    persist(next);
    set({ game: next });
  },

  rerollShop: () => {
    const { game, rerollCount } = get();
    if (!game || game.phase !== 'TRANSFER_WINDOW') return;
    const rng = makeRng(deriveSeed(game.seed, 'reroll', game.round, rerollCount));
    const res = reroll(playerOf(game), game.round, rng, generateRunPool(game.seed));
    if (!res) return;
    const next = {
      ...replacePlayer(game, res.manager),
      currentShop: res.shop,
    };
    persist(next);
    set({ game: next, rerollCount: rerollCount + 1 });
  },

  confirmTransfer: () => {
    const { game } = get();
    if (!game || game.phase !== 'TRANSFER_WINDOW') return;
    const next: GameState = { ...game, phase: 'TACTICS' };
    persist(next);
    set({ game: next });
  },

  placePlayer: (cardId, slot) => {
    const { game } = get();
    if (!game || game.phase !== 'TACTICS') return;
    const p = playerOf(game);
    const card = p.squad.cards.find((c) => c.id === cardId);
    if (!card) return;

    let lineup = [...p.squad.lineup];
    const existingIdx = lineup.findIndex((l) => l.cardId === cardId);

    if (slot === 'GK') {
      // Only one GK: remove any existing GK placement first.
      lineup = lineup.filter((l) => l.slot !== 'GK' || l.cardId === cardId);
    }
    if (existingIdx >= 0) {
      lineup[existingIdx] = { cardId, slot };
    } else {
      if (lineup.length >= p.squadCap) return;
      lineup.push({ cardId, slot });
    }
    const next = replacePlayer(game, {
      ...p,
      squad: { ...p.squad, lineup },
    });
    persist(next);
    set({ game: next });
  },

  unplacePlayer: (cardId) => {
    const { game } = get();
    if (!game || game.phase !== 'TACTICS') return;
    const p = playerOf(game);
    const next = replacePlayer(game, {
      ...p,
      squad: {
        ...p.squad,
        lineup: p.squad.lineup.filter((l) => l.cardId !== cardId),
      },
    });
    persist(next);
    set({ game: next });
  },

  kickOff: () => {
    const { game } = get();
    if (!game || game.phase !== 'TACTICS') return;
    const p = playerOf(game);
    const hasGk = p.squad.lineup.some((l) => l.slot === 'GK');
    if (!hasGk || p.squad.lineup.length === 0) return;

    const outcome = resolveRound(game);
    const next = outcome.state;
    persist(next);
    set({
      game: next,
      // Bye round: no match to watch, go straight to results.
      watchingMatch: outcome.playerMatch !== null,
    });
  },

  finishMatch: () => set({ watchingMatch: false }),

  nextRound: () => {
    const { game } = get();
    if (!game || game.phase !== 'RESULTS') return;
    const next = advanceRound(game);
    persist(next);
    set({ game: next, rerollCount: 0 });
  },

  rematch: () => {
    clearRun();
    get().newRun();
  },
}));
