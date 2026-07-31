// Player generation, template-based (star-merge ready).
// A TEMPLATE defines a unique fictional player (name, nat, archetype, position,
// tier, base stats) deterministically from its templateId. Card instances are
// copies of templates with fresh ids — duplicates can appear, merge, and star up.

import type { Archetype, CostTier, PlayerCard, PlayerStats, PositionLine } from '../types';
import {
  ARCHETYPE_NATURAL_POSITION,
  ARCHETYPE_TILT,
  RUN_POOL_TIER_COUNTS,
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

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export function generateName(rng: Rng, nat: (typeof NATIONALITIES)[number]): string {
  const pool = NAME_POOLS[nat].filter(
    (s) => !BLOCKLIST.has(s.toLowerCase().replace(/\s+/g, '')),
  );
  const surname = pool.length > 0 ? rng.pick(pool) : 'Anonymo';
  return `${rng.pick(FIRST_INITIALS)}. ${surname}`;
}

function rollStats(rng: Rng, tier: CostTier, archetype: Archetype): PlayerStats {
  const target =
    TIER_STAT_TOTAL[tier] + rng.range(-TIER_STAT_JITTER, TIER_STAT_JITTER);
  const tilt = ARCHETYPE_TILT[archetype];
  const keys: (keyof PlayerStats)[] = ['PAC', 'TEC', 'DEF', 'PHY'];

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

/** Build a deterministic template card from its identity triple. */
export function makeTemplate(
  nationality: (typeof NATIONALITIES)[number],
  surname: string,
  archetype: Archetype,
  tier: CostTier,
): PlayerCard {
  const templateId = `${nationality}-${surname}-${archetype}-${tier}`;
  const rng = makeRng(hashString(templateId));
  const initial = rng.pick(FIRST_INITIALS);
  const positions = ARCHETYPE_NATURAL_POSITION[archetype];
  const naturalPosition: PositionLine = rng.pick(positions);
  return {
    id: `template-${templateId}`, // replaced with a fresh id per instance
    templateId,
    star: 1,
    name: `${initial}. ${surname}`,
    nationality,
    archetype,
    naturalPosition,
    tier,
    stats: rollStats(rng, tier, archetype),
  };
}

/** The per-run template pool shops draw from (deterministic from run seed).
 *  Fixed pool = duplicates in shops = merging is achievable (TFT pool feel). */
export function generateRunPool(seed: number): PlayerCard[] {
  const rng = makeRng((seed ^ 0x5bd1e995) >>> 0);
  const pool: PlayerCard[] = [];
  const seen = new Set<string>();
  const tiers = Object.entries(RUN_POOL_TIER_COUNTS) as [string, number][];
  for (const [tierStr, count] of tiers) {
    const tier = Number(tierStr) as CostTier;
    let attempts = 0;
    while (pool.filter((t) => t.tier === tier).length < count && attempts < 500) {
      attempts++;
      const nat = rng.pick(NATIONALITIES);
      const surnames = NAME_POOLS[nat].filter(
        (s) => !BLOCKLIST.has(s.toLowerCase().replace(/\s+/g, '')),
      );
      const surname = rng.pick(surnames);
      const archetype = rng.pick(ARCHETYPES);
      const template = makeTemplate(nat, surname, archetype, tier);
      if (seen.has(template.templateId)) continue;
      seen.add(template.templateId);
      pool.push(template);
    }
  }
  return pool;
}

/** Instantiate a fresh 1★ copy of a template. */
export function instantiate(rng: Rng, template: PlayerCard): PlayerCard {
  return { ...template, id: makeId(rng, 'card'), star: 1, stats: { ...template.stats } };
}

/** One-off random card (used by tests/tools; shops should use the run pool). */
export function generateCard(rng: Rng, tier: CostTier): PlayerCard {
  const nat = rng.pick(NATIONALITIES);
  const surname = rng.pick(NAME_POOLS[nat]);
  const archetype = rng.pick(ARCHETYPES);
  return instantiate(rng, makeTemplate(nat, surname, archetype, tier));
}

export function rollTier(rng: Rng, round: number): CostTier {
  const table =
    SHOP_TIER_ODDS_BY_ROUND[
      Math.min(Math.max(round - 1, 0), SHOP_TIER_ODDS_BY_ROUND.length - 1)
    ];
  return (rng.pickWeighted(table) + 1) as CostTier;
}

/** Draw a shop of SHOP_SIZE cards from the run pool, tier-weighted by round. */
export function generateShop(rng: Rng, round: number, pool: PlayerCard[]): PlayerCard[] {
  const shop: PlayerCard[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    const wantedTier = rollTier(rng, round);
    const candidates = pool.filter((t) => t.tier === wantedTier);
    const template =
      candidates.length > 0 ? rng.pick(candidates) : rng.pick(pool);
    shop.push(instantiate(rng, template));
  }
  return shop;
}
