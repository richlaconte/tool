import { describe, expect, it } from 'vitest';
import {
  ARCHETYPE_TILT,
  STAT_MAX,
  STAT_MIN,
  TIER_STAT_JITTER,
  TIER_STAT_TOTAL,
} from '../../src/sim/config';
import { generateCard, generateShop, rollTier } from '../../src/sim/players';
import { REAL_NAME_BLOCKLIST } from '../../src/sim/players.data';
import { makeRng } from '../../src/sim/rng';
import type { PlayerCard } from '../../src/types';

const BLOCKLIST = new Set(REAL_NAME_BLOCKLIST);

function statTotal(c: PlayerCard): number {
  return c.stats.PAC + c.stats.TEC + c.stats.DEF + c.stats.PHY;
}

describe('players', () => {
  it('generated cards respect tier stat-total bands (with jitter)', () => {
    const rng = makeRng(123);
    for (let i = 0; i < 500; i++) {
      const tier = ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5;
      const card = generateCard(rng, tier);
      const total = statTotal(card);
      // jitter distribution can drift a little beyond ±Jitter after clamping
      expect(total).toBeGreaterThanOrEqual(TIER_STAT_TOTAL[tier] - TIER_STAT_JITTER - 8);
      expect(total).toBeLessThanOrEqual(TIER_STAT_TOTAL[tier] + TIER_STAT_JITTER + 8);
      for (const k of ['PAC', 'TEC', 'DEF', 'PHY'] as const) {
        expect(card.stats[k]).toBeGreaterThanOrEqual(STAT_MIN);
        expect(card.stats[k]).toBeLessThanOrEqual(STAT_MAX);
      }
    }
  });

  it('archetype tilts push the tilted stat above the mean', () => {
    const rng = makeRng(555);
    let speedsterPacWins = 0;
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const card = generateCard(rng, 3);
      if (card.archetype !== 'Speedster') continue;
      n++;
      const tilted = ARCHETYPE_TILT[card.archetype];
      const tiltKey = Object.keys(tilted)[0] as 'PAC';
      const others = (['TEC', 'DEF', 'PHY'] as const);
      const meanOther =
        others.reduce((s, k) => s + card.stats[k], 0) / others.length;
      if (card.stats[tiltKey] > meanOther) speedsterPacWins++;
    }
    expect(n).toBeGreaterThan(20);
    expect(speedsterPacWins / n).toBeGreaterThan(0.6);
  });

  it('never generates a blocklisted surname', () => {
    const rng = makeRng(2024);
    for (let i = 0; i < 2000; i++) {
      const card = generateCard(rng, rollTier(rng, 5));
      const surname = card.name.split('. ')[1] ?? card.name;
      expect(BLOCKLIST.has(surname.toLowerCase().replace(/\s+/g, ''))).toBe(false);
    }
  });

  it('covers all 8 nationalities and all archetypes over many draws', () => {
    const rng = makeRng(77);
    const nats = new Set<string>();
    const archs = new Set<string>();
    for (let i = 0; i < 800; i++) {
      const c = generateCard(rng, 2);
      nats.add(c.nationality);
      archs.add(c.archetype);
    }
    expect(nats.size).toBe(8);
    expect(archs.size).toBe(6);
  });

  it('generateShop returns 5 cards and ids are unique', () => {
    const rng = makeRng(31);
    const shop = generateShop(rng, 4);
    expect(shop).toHaveLength(5);
    expect(new Set(shop.map((c) => c.id)).size).toBe(5);
  });

  it('shop tier odds shift upward in later rounds', () => {
    const early = makeRng(8);
    const late = makeRng(8);
    let earlySum = 0;
    let lateSum = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) earlySum += rollTier(early, 1);
    for (let i = 0; i < N; i++) lateSum += rollTier(late, 7);
    expect(lateSum / N).toBeGreaterThan(earlySum / N);
  });
});
