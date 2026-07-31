import { describe, expect, it } from 'vitest';
import { aiSetLineup, aiTakeTransferWindow, squadStrength } from '../../src/sim/ai';
import { MANAGER_COUNT, MAX_ROUNDS, STARTING_CREDITS } from '../../src/sim/config';
import { buy } from '../../src/sim/shop';
import { generateShop } from '../../src/sim/players';
import { advanceRound, createRun, PLAYER_ID, resolveRound } from '../../src/sim/tournament';
import { makeRng } from '../../src/sim/rng';
import type { GameState, ManagerState } from '../../src/types';

/** Let an AI policy also drive the human manager, for full-run simulation. */
function autoPlayPlayer(state: GameState): GameState {
  const s = structuredClone(state);
  const rng = makeRng(state.seed ^ 0xabcdef);
  const idx = s.managers.findIndex((m) => m.id === PLAYER_ID);
  const withBuys = aiTakeTransferWindow(rng, s.managers[idx], s.round);
  s.managers[idx] = aiSetLineup(withBuys);
  return s;
}

function playRunToEnd(seed: number): GameState {
  let state = createRun(seed);
  for (let guard = 0; guard < MAX_ROUNDS + 5; guard++) {
    if (state.phase === 'RUN_OVER') return state;
    state = autoPlayPlayer(state);
    const outcome = resolveRound(state);
    state = outcome.state;
    if (state.phase === 'RUN_OVER') return state;
    state = advanceRound(state);
  }
  return state;
}

describe('ai', () => {
  it('AC-6: AI squad strength grows round over round (100 runs)', () => {
    const strengthsByRound: Record<number, number[]> = { 1: [], 5: [] };
    for (let run = 0; run < 100; run++) {
      let state = createRun(1000 + run);
      for (let r = 1; r <= 5; r++) {
        if (r === 1 || r === 5) {
          for (const m of state.managers) {
            if (m.id === PLAYER_ID) continue;
            strengthsByRound[r].push(squadStrength(m));
          }
        }
        state = autoPlayPlayer(state);
        const outcome = resolveRound(state);
        state = outcome.state;
        if (state.phase === 'RUN_OVER') break;
        state = advanceRound(state);
      }
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(strengthsByRound[5])).toBeGreaterThan(mean(strengthsByRound[1]) * 1.15);
  });

  it('AI always fields exactly one GK and respects caps', () => {
    for (let run = 0; run < 50; run++) {
      let state = createRun(5000 + run);
      state = autoPlayPlayer(state);
      resolveRound(state);
      for (const m of state.managers) {
        if (m.squad.cards.length === 0) continue;
        const gks = m.squad.lineup.filter((p) => p.slot === 'GK');
        expect(gks.length).toBe(1);
        expect(m.squad.lineup.length).toBeLessThanOrEqual(m.squadCap);
        const ids = new Set(m.squad.cards.map((c) => c.id));
        for (const p of m.squad.lineup) expect(ids.has(p.cardId)).toBe(true);
      }
    }
  });
});

describe('tournament', () => {
  it('creates 8 managers with correct starting state', () => {
    const s = createRun(42);
    expect(s.managers).toHaveLength(MANAGER_COUNT);
    expect(s.managers.every((m) => m.hp === 20)).toBe(true);
    expect(s.round).toBe(1);
    expect(s.phase).toBe('TRANSFER_WINDOW');
    expect(s.currentShop).toHaveLength(5);
  });

  it('full runs complete with one survivor and all placements set (30 runs)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const end = playRunToEnd(7777 + seed);
      expect(end.phase).toBe('RUN_OVER');
      expect(end.round).toBeLessThanOrEqual(MAX_ROUNDS);
      const alive = end.managers.filter((m) => !m.eliminated);
      const player = end.managers.find((m) => m.id === PLAYER_ID)!;
      // Run ends when: one survivor, player eliminated, or MAX_ROUNDS cap.
      if (!player.eliminated && end.round < MAX_ROUNDS) {
        expect(alive.length).toBeLessThanOrEqual(1);
      } else {
        expect(alive.length).toBeGreaterThan(0);
      }
      for (const m of end.managers) {
        expect(m.placement).toBeDefined();
        expect(m.placement!).toBeGreaterThanOrEqual(1);
        expect(m.placement!).toBeLessThanOrEqual(MANAGER_COUNT);
      }
    }
  });

  it('damage formula: loser takes 3 + goal difference (+ streak bonus)', () => {
    // Rig a deterministic single-round state and inspect HP deltas.
    const state = autoPlayPlayer(createRun(31415));
    const before = new Map(state.managers.map((m) => [m.id, m.hp]));
    const outcome = resolveRound(state);
    const after = new Map(outcome.state.managers.map((m) => [m.id, m.hp]));
    for (const r of [outcome.playerMatch, ...outcome.aiMatches]) {
      if (!r) continue;
      const home = r.home.managerId;
      const away = r.away.managerId;
      const gd = Math.abs(r.homeGoals - r.awayGoals);
      const loserId = r.homeGoals === r.awayGoals ? null : r.homeGoals > r.awayGoals ? away : home;
      const dmg = (before.get(loserId ?? home) ?? 0) - (after.get(loserId ?? home) ?? 0);
      if (loserId === null) {
        // draw: both take exactly 1
        expect((before.get(home) ?? 0) - (after.get(home) ?? 0)).toBe(1);
        expect((before.get(away) ?? 0) - (after.get(away) ?? 0)).toBe(1);
      } else {
        expect(dmg).toBeGreaterThanOrEqual(3 + gd); // + streak bonus (0 in round 1)
        expect(dmg).toBeLessThanOrEqual(3 + gd + 3);
      }
    }
  });

  it('median run length is 9–14 rounds (tuning target, 300 runs)', () => {
    const lengths: number[] = [];
    for (let seed = 0; seed < 300; seed++) {
      lengths.push(playRunToEnd(20_000 + seed).round);
    }
    lengths.sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)];
    expect(median).toBeGreaterThanOrEqual(9);
    expect(median).toBeLessThanOrEqual(14);
  });

  it('player receives prize credits after a round', () => {
    const state = autoPlayPlayer(createRun(60606));
    const before = state.managers.find((m) => m.id === PLAYER_ID)!.credits;
    const outcome = resolveRound(state);
    const after = outcome.state.managers.find((m) => m.id === PLAYER_ID)!.credits;
    expect(after).toBeGreaterThanOrEqual(before + 4); // PRIZE_BASE minimum
  });

  it('shop economy integration: buy through the real shop path', () => {
    const rng = makeRng(1);
    const shop = generateShop(rng, 1);
    const m: ManagerState = {
      id: 'x',
      name: 'X',
      hp: 20,
      credits: STARTING_CREDITS,
      squad: { cards: [], lineup: [] },
      squadCap: 4,
      winStreak: 0,
      eliminated: false,
    };
    const affordable = shop.filter((c) => c.tier <= m.credits);
    expect(affordable.length).toBeGreaterThan(0);
    const res = buy(m, shop, affordable[0].id);
    expect(res).not.toBeNull();
  });
});
