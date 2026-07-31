// All tuning numbers from docs/mvp/03-game-design-spec.md live here.
// No game numbers may appear anywhere else in the codebase.

import type { Archetype, CostTier, PlayerStats, PositionLine } from '../types';

// ─── Economy ────────────────────────────────────────────────────────
export const STARTING_CREDITS = 8;
export const STARTING_HP = 20;
export const SHOP_SIZE = 5;
export const REROLL_COST = 1;
export const BENCH_MAX = 4;

export const PRIZE_BASE = 4;
export const PRIZE_PER_GOAL = 1;
export const PRIZE_GOAL_CAP = 3;
export const PRIZE_WIN = 2;

// ─── Squad caps ─────────────────────────────────────────────────────
export const SQUAD_CAP_START = 4;
export const SQUAD_CAP_MAX = 7;
export const CAP_INCREASE_EVERY_ROUNDS = 2;

// ─── Damage ─────────────────────────────────────────────────────────
export const DAMAGE_BASE = 3;
export const DRAW_DAMAGE = 1;
export const WIN_STREAK_DAMAGE_CAP = 3;

// ─── Shop tier odds by round ────────────────────────────────────────
// Index into this table: min(round, last index). Weights for tiers 1..5.
export const SHOP_TIER_ODDS_BY_ROUND: number[][] = [
  [0.5, 0.3, 0.15, 0.05, 0.0], // rounds 1-2 (index 0 reused for r1)
  [0.5, 0.3, 0.15, 0.05, 0.0], // round 2
  [0.35, 0.3, 0.2, 0.12, 0.03], // round 3
  [0.35, 0.3, 0.2, 0.12, 0.03], // round 4
  [0.22, 0.28, 0.25, 0.18, 0.07], // round 5
  [0.22, 0.28, 0.25, 0.18, 0.07], // round 6
  [0.12, 0.22, 0.28, 0.24, 0.14], // round 7+
];

// ─── Player generation ──────────────────────────────────────────────
export const STAT_MIN = 40;
export const STAT_MAX = 99;

// ─── Star merging (TFT-style) ───────────────────────────────────────
export const STAR_COPY_REQUIREMENT = 3; // 3 copies of star N → one star N+1
export const STAR_MAX = 3;
export const STAR_MULTIPLIER: Record<2 | 3, number> = {
  2: 1.8, // × base stats
  3: 1.8, // × star-2 stats (≈ 3.24× base)
};
// Sell refund: full cost of all merged copies (tier × 3^(star-1)).
// Run pool: fixed set of templates shops draw from, so duplicates appear
// and merging is achievable (TFT shared-pool feel, without scarcity).
export const RUN_POOL_TIER_COUNTS: Record<CostTier, number> = {
  1: 10,
  2: 9,
  3: 8,
  4: 6,
  5: 3,
};

export const TIER_STAT_TOTAL: Record<CostTier, number> = {
  1: 200,
  2: 230,
  3: 260,
  4: 290,
  5: 320,
};
export const TIER_STAT_JITTER = 10;

// Archetype stat tilts: fraction of the stat total nudged toward these stats
export const ARCHETYPE_TILT: Record<Archetype, Partial<PlayerStats>> = {
  Speedster: { PAC: 0.15 },
  Playmaker: { TEC: 0.15 },
  Poacher: { TEC: 0.08, PAC: 0.07 },
  Destroyer: { DEF: 0.08, PHY: 0.07 },
  Sweeper: { DEF: 0.15 },
  ShotStopper: { DEF: 0.1, PHY: 0.05 },
};

export const ARCHETYPE_NATURAL_POSITION: Record<Archetype, PositionLine[]> = {
  Speedster: ['FWD', 'MID'],
  Playmaker: ['MID', 'FWD'],
  Poacher: ['FWD'],
  Destroyer: ['DEF', 'MID'],
  Sweeper: ['DEF'],
  ShotStopper: ['GK'],
};

// ─── Position fit multipliers ───────────────────────────────────────
export const FIT_NATURAL = 1.0;
export const FIT_ADJACENT = 0.75;
export const FIT_GK_MISMATCH = 0.5; // outfielder at GK or GK outfield

const ADJACENT: Record<PositionLine, PositionLine[]> = {
  GK: [],
  DEF: ['MID'],
  MID: ['DEF', 'FWD'],
  FWD: ['MID'],
};

export function positionFit(natural: PositionLine, slot: PositionLine): number {
  if (natural === slot) return FIT_NATURAL;
  if (natural === 'GK' || slot === 'GK') return FIT_GK_MISMATCH;
  if (ADJACENT[natural].includes(slot)) return FIT_ADJACENT;
  return FIT_GK_MISMATCH;
}

// ─── Combinations ───────────────────────────────────────────────────
export const COMBO_NATIONAL_PRIDE = { tiers: [2, 3], buff: [0.08, 0.15] };
export const COMBO_SAMBA_FLAIR = { tiers: [2, 3], buff: [0.1, 0.18] };
export const COMBO_DEFENSIVE_WALL = { tiers: [2, 3], debuff: [0.1, 0.18] };
export const COMBO_TARGET_MEN = { tiers: [2], buff: [0.15] };

// ─── Match engine ───────────────────────────────────────────────────
export const MATCH_TICKS = 60;
export const MATCH_MINUTES = 90;

export const ATTACK_BASE_CHANCE = 0.22;
export const ATTACK_MIN_CHANCE = 0.05;
export const ATTACK_MAX_CHANCE = 0.45;
export const ATTACK_DIFF_DIVISOR = 2000; // attack-weight differential scaling
export const COUNTER_SPEEDSTER_COUNT = 2;
export const COUNTER_ATTACK_BONUS = 0.04;

export const CONVERSION_BASE = 0.08;
export const CONVERSION_QUALITY_SCALE = 0.35;
export const GK_SAVE_FACTOR = 0.12; // × normalized GK ability

// Chance quality weights
export const Q_FINISHER_TEC = 0.3;
export const Q_FINISHER_PAC = 0.2;
export const Q_CREATOR_TEC = 0.2;
export const Q_BASE = 0.15;

// Color events
export const FOUL_CHANCE_PER_TICK = 0.04;
export const CARD_CHANCE_PER_FOUL = 0.2;
export const CORNER_CHANCE_ON_SAVE_BLOCK = 0.08;
export const PENALTY_QUALITY_THRESHOLD = 0.6;
export const PENALTY_CHANCE_ON_BIG_CHANCE = 0.06;
export const PENALTY_CONVERSION = 0.76;

// Non-goal outcome split (of the remaining probability after a goal roll fails)
export const OUTCOME_SAVED_SHARE = 0.4;
export const OUTCOME_BLOCKED_SHARE = 0.3;
// remainder = missed

// ─── AI ─────────────────────────────────────────────────────────────
export const AI_CREDITS_BONUS_PER_ROUND = 0.5;
export const AI_REROLL_CREDIT_FLOOR = 4;
export const AI_SELL_CREDIT_FLOOR = 2;

// ─── Tournament ─────────────────────────────────────────────────────
export const MANAGER_COUNT = 8;
export const MAX_ROUNDS = 30; // safety cap

// ─── Stat normalization helper ─────────────────────────────────────
export function normStat(v: number): number {
  return Math.max(0, Math.min(1, (v - STAT_MIN) / (STAT_MAX - STAT_MIN)));
}
