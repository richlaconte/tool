import { describe, expect, it } from 'vitest';
import { activeCombos, detectCombos, resolveSquad } from '../../src/sim/combos';
import { positionFit } from '../../src/sim/config';
import type { PlayerCard, PositionLine, Squad } from '../../src/types';

let n = 0;
function card(overrides: Partial<PlayerCard>): PlayerCard {
  n++;
  return {
    id: `c${n}`,
    name: `X. Player${n}`,
    nationality: 'ENG',
    archetype: 'Poacher',
    naturalPosition: 'FWD',
    tier: 2,
    stats: { PAC: 80, TEC: 70, DEF: 60, PHY: 65 },
    ...overrides,
  };
}

function squad(entries: { card: PlayerCard; slot: PositionLine }[]): Squad {
  return {
    cards: entries.map((e) => e.card),
    lineup: entries.map((e) => ({ cardId: e.card.id, slot: e.slot })),
  };
}

describe('position fit', () => {
  it('natural = 1.0, adjacent = 0.75, GK mismatches = 0.5', () => {
    expect(positionFit('FWD', 'FWD')).toBe(1.0);
    expect(positionFit('MID', 'DEF')).toBe(0.75);
    expect(positionFit('MID', 'FWD')).toBe(0.75);
    expect(positionFit('DEF', 'FWD')).toBe(0.5);
    expect(positionFit('GK', 'FWD')).toBe(0.5);
    expect(positionFit('FWD', 'GK')).toBe(0.5);
  });
});

describe('combos', () => {
  it('National Pride triggers at 2 and tiers up at 3, keyed by nationality', () => {
    const s = squad([
      { card: card({ nationality: 'BRA' }), slot: 'FWD' },
      { card: card({ nationality: 'BRA' }), slot: 'FWD' },
      { card: card({ nationality: 'BRA', naturalPosition: 'MID' }), slot: 'MID' },
      { card: card({ nationality: 'FRA', naturalPosition: 'DEF' }), slot: 'DEF' },
      { card: card({ archetype: 'ShotStopper', naturalPosition: 'GK' }), slot: 'GK' },
    ]);
    const combos = detectCombos(s);
    const bra = combos.find((c) => c.family === 'NationalPride' && c.key === 'BRA');
    const fra = combos.find((c) => c.family === 'NationalPride' && c.key === 'FRA');
    expect(bra).toMatchObject({ count: 3, tier: 2 });
    expect(fra).toMatchObject({ count: 1, tier: 0 });
  });

  it('Samba Flair counts only BRA Speedsters/Playmakers', () => {
    const s = squad([
      { card: card({ nationality: 'BRA', archetype: 'Speedster' }), slot: 'FWD' },
      { card: card({ nationality: 'BRA', archetype: 'Playmaker', naturalPosition: 'MID' }), slot: 'MID' },
      { card: card({ nationality: 'BRA', archetype: 'Poacher' }), slot: 'FWD' }, // Poacher doesn't count
      { card: card({ archetype: 'ShotStopper', naturalPosition: 'GK' }), slot: 'GK' },
    ]);
    const samba = detectCombos(s).find((c) => c.family === 'SambaFlair');
    expect(samba).toMatchObject({ count: 2, tier: 1 });
  });

  it('Defensive Wall counts DEF-line slots', () => {
    const s = squad([
      { card: card({ naturalPosition: 'DEF' }), slot: 'DEF' },
      { card: card({ naturalPosition: 'DEF' }), slot: 'DEF' },
      { card: card({ naturalPosition: 'MID' }), slot: 'DEF' }, // out of position but still a body at DEF
      { card: card({ archetype: 'ShotStopper', naturalPosition: 'GK' }), slot: 'GK' },
    ]);
    const wall = detectCombos(s).find((c) => c.family === 'DefensiveWall');
    expect(wall).toMatchObject({ count: 3, tier: 2 });
  });

  it('Target Men counts FWD-slot Poachers (single tier)', () => {
    const s = squad([
      { card: card({ archetype: 'Poacher' }), slot: 'FWD' },
      { card: card({ archetype: 'Poacher' }), slot: 'FWD' },
      { card: card({ archetype: 'Poacher' }), slot: 'FWD' },
      { card: card({ archetype: 'ShotStopper', naturalPosition: 'GK' }), slot: 'GK' },
    ]);
    const tm = detectCombos(s).find((c) => c.family === 'TargetMen');
    expect(tm).toMatchObject({ count: 3, tier: 1 }); // no tier 2 for Target Men
  });

  it('resolveSquad applies fit multipliers to effective stats', () => {
    const c = card({ naturalPosition: 'FWD', stats: { PAC: 80, TEC: 80, DEF: 80, PHY: 80 } });
    const s = squad([{ card: c, slot: 'MID' }]);
    const resolved = resolveSquad('m', s);
    expect(resolved.players[0].effective.PAC).toBeCloseTo(60); // 80 × 0.75
  });

  it('resolveSquad deep-clones (replay safety, invariant 6)', () => {
    const c = card({});
    const s = squad([{ card: c, slot: 'FWD' }]);
    const resolved = resolveSquad('m', s);
    c.stats.PAC = 1;
    s.lineup[0].slot = 'DEF';
    expect(resolved.players[0].effective.PAC).toBeCloseTo(80);
    expect(resolved.players[0].slot).toBe('FWD');
  });

  it('activeCombos filters out tier-0 families', () => {
    const s = squad([
      { card: card({}), slot: 'FWD' },
      { card: card({ archetype: 'ShotStopper', naturalPosition: 'GK' }), slot: 'GK' },
    ]);
    for (const c of activeCombos(s)) {
      expect(c.tier).toBeGreaterThan(0);
    }
  });
});
