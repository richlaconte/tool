// Player generation: nationality → name from pool → stats by tier & archetype tilt.

import type { Archetype, CostTier, PlayerCard, PlayerStats, PositionLine } from '../types';
import {
  ARCHETYPE_NATURAL_POSITION,
  ARCHETYPE_TILT,
  SHOP_TIER_ODDS_BY_ROUND,
  SHOP_SIZE,
  STAT_MAX,
  STAT_MIN,
  TIER_STAT_JITTER,
  TIER_STAT_TOTAL,
} from './config';
import {
  FIRST_INITIALS,
  NAME_POOLS,
  NATIONALITIES,
  REAL_NAME_BLOCKLIST,
} from './players.data';
import { makeId, makeRng, type Rng } from './rng';

const ARCHETYPES: Archetype[] = [
  'Speedster', 'Playmaker', 'Poacher', 'Destroyer', 'Sweeper', 'ShotStopper',
];

const BLOCKLIST = new Set(REAL_NAME_BLOCKLIST);

export function generateName(rng: Rng, nat: (typeof NATIONALITIES)[number]): string {
  const pool = NAME_POOLS[nat].filter(
    (s) => !BLOCKLIST.has(s.toLowerCase().replace(/\s+/g, '')),
  );
  // Safety net: if a pool were fully blocked, fall back to a synthetic name.
  const surname = pool.length > 0 ? rng.pick(pool) : 'Anonymo';
  return `${rng.pick(FIRST_INITIALS)}. ${surname}`;
}

function rollStats(rng: Rng, tier: CostTier, archetype: Archetype): PlayerStats {
  const target =
    TIER_STAT_TOTAL[tier] + rng.range(-TIER_STAT_JITTER, TIER_STAT_JITTER);
  const tilt = ARCHETYPE_TILT[archetype];
  const keys: (keyof PlayerStats)[] = ['PAC', 'TEC', 'DEF', 'PHY'];

  // Start from an even split plus random weight, then add archetype tilt.
  const weights = keys.map((k) => 1 + rng.next() * 0.6 + (tilt[k] ?? 0) * 4);
  const total = weights.reduce((s, w) => s + w, 0);
  const stats = {} as PlayerStats;
  let assigned = 0;
  keys.forEach((k, i) => {
    let v = Math.round((weights[i] / total) * target);
    v = Math.max(STAT_MIN, Math.min(STAT_MAX, v));
    stats[k] = v;
    assigned += v;
  });
  // Distribute rounding drift onto the highest-tilted stat without exceeding caps.
  let drift = target - assigned;
  const order = [...keys].sort(
    (a, b) => (tilt[b] ?? 0) - (tilt[a] ?? 0) || stats[b] - stats[a],
  );
  let i = 0;
  while (drift !== 0 && i < 200) {
    const k = order[i % order.length];
    const next = stats[k] + Math.sign(drift);
    if (next >= STAT_MIN && next <= STAT_MAX) {
      stats[k] = next;
      drift -= Math.sign(drift);
    }
    i++;
  }
  return stats;
}

function naturalPositionFor(rng: Rng, archetype: Archetype): PositionLine {
  return rng.pick(ARCHETYPE_NATURAL_POSITION[archetype]);
}

export function generateCard(rng: Rng, tier: CostTier): PlayerCard {
  const archetype = rng.pick(ARCHETYPES);
  const nationality = rng.pick(NATIONALITIES);
  return {
    id: makeId(rng, 'card'),
    name: generateName(rng, nationality),
    nationality,
    archetype,
    naturalPosition: naturalPositionFor(rng, archetype),
    tier,
    stats: rollStats(rng, tier, archetype),
  };
}

export function rollTier(rng: Rng, round: number): CostTier {
  const table =
    SHOP_TIER_ODDS_BY_ROUND[
      Math.min(Math.max(round - 1, 0), SHOP_TIER_ODDS_BY_ROUND.length - 1)
    ];
  return (rng.pickWeighted(table) + 1) as CostTier;
}

export function generateShop(rng: Rng, round: number): PlayerCard[] {
  const shop: PlayerCard[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    shop.push(generateCard(rng, rollTier(rng, round)));
  }
  return shop;
}

/** Convenience: seeded shop for a given run/round/manager/call. */
export function shopFor(
  seed: number,
  round: number,
  tag: string | number,
): PlayerCard[] {
  return generateShop(makeRng((seed ^ hashTag(tag, round)) >>> 0), round);
}

function hashTag(tag: string | number, round: number): number {
  let h = round >>> 0;
  const s = String(tag);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
  }
  return h >>> 0;
}
