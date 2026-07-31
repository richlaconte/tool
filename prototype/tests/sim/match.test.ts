import { describe, expect, it } from 'vitest';
import { resolveSquad } from '../../src/sim/combos';
import { simulateMatch } from '../../src/sim/match';
import { generateCard } from '../../src/sim/players';
import { makeRng, type Rng } from '../../src/sim/rng';
import type {
  Archetype,
  Nationality,
  PlayerCard,
  PlayerStats,
  PositionLine,
  Squad,
  SquadSnapshot,
} from '../../src/types';

let idCounter = 0;
function makeCard(overrides: Partial<PlayerCard> & { stats?: Partial<PlayerStats> }): PlayerCard {
  idCounter++;
  return {
    id: `test-card-${idCounter}`,
    name: `T. Testington${idCounter}`,
    nationality: 'ENG' as Nationality,
    archetype: 'Poacher' as Archetype,
    naturalPosition: 'FWD' as PositionLine,
    tier: 3,
    ...overrides,
    stats: { PAC: 70, TEC: 70, DEF: 70, PHY: 70, ...(overrides.stats ?? {}) },
  };
}

function makeSquad(cards: { card: PlayerCard; slot: PositionLine }[]): Squad {
  return {
    cards: cards.map((c) => c.card),
    lineup: cards.map((c) => ({ cardId: c.card.id, slot: c.slot })),
  };
}

function snap(squad: Squad, id = 'test'): SquadSnapshot {
  return resolveSquad(id, squad);
}

function gkCard(stats: Partial<PlayerStats> = {}): PlayerCard {
  return makeCard({
    archetype: 'ShotStopper',
    naturalPosition: 'GK',
    stats: { PAC: 45, TEC: 50, DEF: 80, PHY: 75, ...stats },
  });
}

function balancedOpponent(): Squad {
  return makeSquad([
    { card: gkCard(), slot: 'GK' },
    { card: makeCard({ archetype: 'Sweeper', naturalPosition: 'DEF' }), slot: 'DEF' },
    { card: makeCard({ archetype: 'Destroyer', naturalPosition: 'DEF' }), slot: 'DEF' },
    { card: makeCard({ archetype: 'Playmaker', naturalPosition: 'MID' }), slot: 'MID' },
    { card: makeCard({}), slot: 'FWD' },
  ]);
}

/** Draw a random squad of a tier with sensible placement (natural positions). */
function randomSquad(rng: Rng, tier: 1 | 2 | 3 | 4 | 5, size = 5): Squad {
  const cards: PlayerCard[] = [];
  let gk: PlayerCard | null = null;
  while (!gk) {
    const c = generateCard(rng, tier);
    if (c.naturalPosition === 'GK') gk = c;
  }
  cards.push(gk);
  while (cards.length < size) {
    const c = generateCard(rng, tier);
    if (c.naturalPosition !== 'GK') cards.push(c);
  }
  return makeSquad(cards.map((c) => ({ card: c, slot: c.naturalPosition })));
}

describe('match engine', () => {
  it('AC-3: same seed + same squads → identical event log', () => {
    const a = snap(balancedOpponent(), 'a');
    const b = snap(balancedOpponent(), 'b');
    const r1 = simulateMatch(a, b, 12345);
    const r2 = simulateMatch(a, b, 12345);
    expect(r2.events).toEqual(r1.events);
    expect(r2.homeGoals).toBe(r1.homeGoals);
    expect(r2.awayGoals).toBe(r1.awayGoals);
  });

  it('different seeds produce different matches', () => {
    const a = snap(balancedOpponent(), 'a');
    const b = snap(balancedOpponent(), 'b');
    const r1 = simulateMatch(a, b, 1);
    const r2 = simulateMatch(a, b, 2);
    expect(r2.events).not.toEqual(r1.events);
  });

  it('AC-5: a striker played at GK performs statistically worse than at FWD (1000 sims)', () => {
    const star = () =>
      makeCard({ stats: { PAC: 95, TEC: 92, DEF: 40, PHY: 55 } });
    const supportCast = () => [
      { card: makeCard({ archetype: 'Sweeper', naturalPosition: 'DEF' }), slot: 'DEF' as const },
      { card: makeCard({ archetype: 'Destroyer', naturalPosition: 'DEF' }), slot: 'DEF' as const },
      { card: makeCard({ archetype: 'Playmaker', naturalPosition: 'MID' }), slot: 'MID' as const },
    ];
    // Squad A: star at FWD, real GK in goal.
    const squadA = makeSquad([
      { card: gkCard(), slot: 'GK' },
      ...supportCast(),
      { card: star(), slot: 'FWD' },
    ]);
    // Squad B: same star wasted at GK (no real keeper, one fewer attacker).
    const squadB = makeSquad([
      { card: star(), slot: 'GK' },
      ...supportCast(),
    ]);
    const opp = snap(balancedOpponent(), 'opp');
    let goalsA = 0;
    let goalsB = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      goalsA += simulateMatch(snap(squadA, 'A'), opp, 10_000 + i).homeGoals;
      goalsB += simulateMatch(snap(squadB, 'B'), opp, 10_000 + i).homeGoals;
    }
    expect(goalsA).toBeGreaterThan(goalsB * 1.3);
  });

  it('tuning: average total goals per match between 1.5 and 4.5', () => {
    const rng = makeRng(999);
    let total = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const a = snap(randomSquad(rng, 2), 'a');
      const b = snap(randomSquad(rng, 3), 'b');
      const r = simulateMatch(a, b, 50_000 + i);
      total += r.homeGoals + r.awayGoals;
    }
    const avg = total / N;
    expect(avg).toBeGreaterThan(1.5);
    expect(avg).toBeLessThan(4.5);
  });

  it('tuning: a tier-2-combo squad beats a same-cost random squad >60%', () => {
    // Samba Flair tier 2: 3 BRA Speedsters/Playmakers + keeper + poacher.
    const comboSquad = makeSquad([
      { card: gkCard(), slot: 'GK' },
      {
        card: makeCard({ nationality: 'BRA', archetype: 'Speedster', naturalPosition: 'FWD', stats: { PAC: 85, TEC: 78, DEF: 45, PHY: 55 } }),
        slot: 'FWD',
      },
      {
        card: makeCard({ nationality: 'BRA', archetype: 'Speedster', naturalPosition: 'FWD', stats: { PAC: 83, TEC: 75, DEF: 45, PHY: 55 } }),
        slot: 'FWD',
      },
      {
        card: makeCard({ nationality: 'BRA', archetype: 'Playmaker', naturalPosition: 'MID', stats: { PAC: 65, TEC: 88, DEF: 55, PHY: 60 } }),
        slot: 'MID',
      },
      {
        card: makeCard({ archetype: 'Sweeper', naturalPosition: 'DEF', stats: { PAC: 55, TEC: 60, DEF: 82, PHY: 75 } }),
        slot: 'DEF',
      },
    ]);
    const rng = makeRng(777);
    let wins = 0;
    let draws = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const opp = snap(randomSquad(rng, 3), 'opp');
      const r = simulateMatch(snap(comboSquad, 'combo'), opp, 80_000 + i);
      if (r.homeGoals > r.awayGoals) wins++;
      else if (r.homeGoals === r.awayGoals) draws++;
    }
    expect(wins / N).toBeGreaterThan(0.6);
  });

  it('tuning: a tier-5 squad beats a tier-1 squad >75%', () => {
    const rng = makeRng(4242);
    let wins = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const strong = snap(randomSquad(rng, 5), 'strong');
      const weak = snap(randomSquad(rng, 1), 'weak');
      const r = simulateMatch(strong, weak, 90_000 + i);
      if (r.homeGoals > r.awayGoals) wins++;
    }
    expect(wins / N).toBeGreaterThan(0.75);
  });

  it('invariant 4: running score is consistent after every GOAL', () => {
    const rng = makeRng(31337);
    const a = snap(randomSquad(rng, 4), 'a');
    const b = snap(randomSquad(rng, 4), 'b');
    const r = simulateMatch(a, b, 777);
    let h = 0;
    let aw = 0;
    for (const e of r.events) {
      if (e.type === 'GOAL' || (e.type === 'PENALTY' && e.narrativeKey === 'goal.penalty')) {
        if (e.team === 'HOME') h++; else aw++;
      }
      expect(e.homeScore).toBe(h);
      expect(e.awayScore).toBe(aw);
    }
    expect(r.homeGoals).toBe(h);
    expect(r.awayGoals).toBe(aw);
  });
});
