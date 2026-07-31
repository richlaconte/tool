// Tournament orchestration: run creation, rounds, pairing, prizes, damage,
// elimination, standings. Pure & deterministic from GameState.seed.

import type { GameState, ManagerId, ManagerState, MatchResult } from '../types';
import {
  CAP_INCREASE_EVERY_ROUNDS,
  DAMAGE_BASE,
  DRAW_DAMAGE,
  MANAGER_COUNT,
  MAX_ROUNDS,
  PRIZE_BASE,
  PRIZE_GOAL_CAP,
  PRIZE_PER_GOAL,
  PRIZE_WIN,
  SQUAD_CAP_MAX,
  SQUAD_CAP_START,
  STARTING_CREDITS,
  STARTING_HP,
  WIN_STREAK_DAMAGE_CAP,
} from './config';
import { aiSetLineup, aiTakeTransferWindow } from './ai';
import { resolveSquad } from './combos';
import { simulateMatch } from './match';
import { generateRunPool, generateShop } from './players';
import { AI_MANAGER_NAMES } from './players.data';
import { deriveSeed, makeRng } from './rng';

export const PLAYER_ID: ManagerId = 'player';

// Scratch pairing storage keyed by GameState object (never serialized).
const pairings = new WeakMap<GameState, { home: ManagerId; away: ManagerId | null }[]>();

function capForRound(round: number): number {
  return Math.min(
    SQUAD_CAP_MAX,
    SQUAD_CAP_START + Math.floor((round - 1) / CAP_INCREASE_EVERY_ROUNDS),
  );
}

export function createRun(seed: number): GameState {
  const managers: ManagerState[] = [
    {
      id: PLAYER_ID,
      name: 'You',
      hp: STARTING_HP,
      credits: STARTING_CREDITS,
      squad: { cards: [], lineup: [] },
      squadCap: SQUAD_CAP_START,
      winStreak: 0,
      eliminated: false,
    },
  ];
  for (let i = 1; i < MANAGER_COUNT; i++) {
    managers.push({
      id: `ai-${i}`,
      name: AI_MANAGER_NAMES[(i - 1) % AI_MANAGER_NAMES.length],
      hp: STARTING_HP,
      credits: STARTING_CREDITS,
      squad: { cards: [], lineup: [] },
      squadCap: SQUAD_CAP_START,
      winStreak: 0,
      eliminated: false,
    });
  }
  const state: GameState = {
    saveVersion: 1,
    seed,
    round: 1,
    phase: 'TRANSFER_WINDOW',
    managers,
    currentShop: [],
    currentPairing: null,
    lastMatch: null,
    standingsHistory: [],
  };
  return prepareRound(state);
}

function survivors(state: GameState): ManagerState[] {
  return state.managers.filter((m) => !m.eliminated);
}

/** Shuffle deterministically with the run seed + round. */
function shuffled<T>(items: T[], seed: number): T[] {
  const rng = makeRng(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Start a round: caps, AI transfer windows, AI lineups, player shop, pairing. */
export function prepareRound(input: GameState): GameState {
  const state = structuredClone(input);
  const cap = capForRound(state.round);
  const pool = generateRunPool(state.seed);

  for (const m of state.managers) {
    if (m.eliminated) continue;
    m.squadCap = cap;
    if (m.id !== PLAYER_ID) {
      const rng = makeRng(deriveSeed(state.seed, 'ai', state.round, m.id));
      const withBuys = aiTakeTransferWindow(rng, m, state.round, pool);
      const withLineup = aiSetLineup(withBuys);
      m.squad = withLineup.squad;
      m.credits = withLineup.credits;
    } else {
      // Repair an invalid player lineup defensively (UI should prevent this).
      const hasGk = m.squad.lineup.some((p) => p.slot === 'GK');
      if (m.squad.cards.length > 0 && (!hasGk || m.squad.lineup.length === 0)) {
        const fixed = aiSetLineup(m);
        m.squad = fixed.squad;
      }
    }
  }

  // Player shop.
  state.currentShop = generateShop(
    makeRng(deriveSeed(state.seed, 'shop', state.round, 'player')),
    state.round,
    pool,
  );

  // Pairing: shuffle survivors, pair adjacents, odd one out gets a bye.
  const alive = shuffled(
    survivors(state).map((m) => m.id),
    deriveSeed(state.seed, 'pairing', state.round),
  );
  let playerPairing: GameState['currentPairing'] = null;
  const pairs: { home: ManagerId; away: ManagerId | null }[] = [];
  for (let i = 0; i < alive.length; i += 2) {
    const home = alive[i];
    const away = alive[i + 1] ?? null;
    pairs.push({ home, away });
    if (home === PLAYER_ID || away === PLAYER_ID) {
      playerPairing = away ? { home, away } : null; // null pairing = bye
    }
  }
  pairings.set(state, pairs);
  state.currentPairing = playerPairing;
  state.phase = 'TRANSFER_WINDOW';
  return state;
}

export interface RoundOutcome {
  state: GameState;
  playerMatch: MatchResult | null;
  aiMatches: MatchResult[];
  byeManager: ManagerId | null;
}

/** Resolve all matches for the round and apply prizes/damage/eliminations. */
export function resolveRound(input: GameState): RoundOutcome {
  const state = structuredClone(input);
  const pairs = pairings.get(input) ?? recomputePairs(state);
  const byId = new Map(state.managers.map((m) => [m.id, m]));

  let playerMatch: MatchResult | null = null;
  const aiMatches: MatchResult[] = [];
  let byeManager: ManagerId | null = null;

  for (const { home, away } of pairs) {
    if (away === null) {
      byeManager = home;
      const m = byId.get(home)!;
      m.credits += PRIZE_BASE;
      continue;
    }
    const homeM = byId.get(home)!;
    const awayM = byId.get(away)!;
    const matchSeed = deriveSeed(state.seed, 'match', state.round, home, away);
    const result = simulateMatch(
      resolveSquad(home, homeM.squad),
      resolveSquad(away, awayM.squad),
      matchSeed,
    );
    if (home === PLAYER_ID || away === PLAYER_ID) {
      playerMatch = result;
      state.lastMatch = result;
    } else {
      aiMatches.push(result);
    }
    applyOutcome(homeM, awayM, result);
  }

  // Eliminations.
  const aliveBefore = survivors(state).length;
  for (const m of state.managers) {
    if (!m.eliminated && m.hp <= 0) {
      m.eliminated = true;
      m.hp = 0;
      m.placement = aliveBefore; // ties share the same placement band
    }
  }

  // Standings snapshot.
  const hp: Record<ManagerId, number> = {};
  for (const m of state.managers) hp[m.id] = m.hp;
  state.standingsHistory.push({ round: state.round, hp });

  // Run over?
  const alive = survivors(state);
  const player = byId.get(PLAYER_ID)!;
  if (player.eliminated || alive.length <= 1 || state.round >= MAX_ROUNDS) {
    if (alive.length === 1) alive[0].placement = 1;
    if (player.eliminated && player.placement === undefined) {
      player.placement = alive.length + 1;
    }
    if (!player.eliminated && alive.length > 1 && state.round >= MAX_ROUNDS) {
      // Safety cap reached: rank survivors by HP.
      const ranked = [...alive].sort((a, b) => b.hp - a.hp);
      ranked.forEach((m, i) => (m.placement = i + 1));
    }
    // Fill any missing placements (e.g. surviving AIs when the player is out):
    // rank by remaining HP into the unused placement slots.
    const used = new Set(
      state.managers.map((m) => m.placement).filter((p): p is number => p !== undefined),
    );
    const open = Array.from({ length: MANAGER_COUNT }, (_, i) => i + 1).filter(
      (p) => !used.has(p),
    );
    const unranked = state.managers
      .filter((m) => m.placement === undefined)
      .sort((a, b) => b.hp - a.hp);
    unranked.forEach((m, i) => (m.placement = open[i]));
    state.phase = 'RUN_OVER';
  } else {
    state.phase = 'RESULTS';
  }

  return { state, playerMatch, aiMatches, byeManager };
}

function recomputePairs(state: GameState): { home: ManagerId; away: ManagerId | null }[] {
  const alive = shuffled(
    survivors(state).map((m) => m.id),
    deriveSeed(state.seed, 'pairing', state.round),
  );
  const pairs: { home: ManagerId; away: ManagerId | null }[] = [];
  for (let i = 0; i < alive.length; i += 2) {
    pairs.push({ home: alive[i], away: alive[i + 1] ?? null });
  }
  return pairs;
}

function applyOutcome(home: ManagerState, away: ManagerState, r: MatchResult): void {
  const homeGoals = r.homeGoals;
  const awayGoals = r.awayGoals;

  // Prizes.
  home.credits += PRIZE_BASE + Math.min(homeGoals, PRIZE_GOAL_CAP) * PRIZE_PER_GOAL;
  away.credits += PRIZE_BASE + Math.min(awayGoals, PRIZE_GOAL_CAP) * PRIZE_PER_GOAL;

  if (homeGoals === awayGoals) {
    home.hp -= DRAW_DAMAGE;
    away.hp -= DRAW_DAMAGE;
    home.winStreak = 0;
    away.winStreak = 0;
    return;
  }

  const winner = homeGoals > awayGoals ? home : away;
  const loser = homeGoals > awayGoals ? away : home;
  const gd = Math.abs(homeGoals - awayGoals);

  winner.credits += PRIZE_WIN;
  winner.winStreak += 1;
  const streakBonus = Math.min(Math.max(winner.winStreak - 1, 0), WIN_STREAK_DAMAGE_CAP);
  loser.hp -= DAMAGE_BASE + gd + streakBonus;
  loser.winStreak = 0;
}

/** Advance to the next round after RESULTS. */
export function advanceRound(input: GameState): GameState {
  const state = structuredClone(input);
  state.round += 1;
  return prepareRound(state);
}
