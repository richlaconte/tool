// Transfer window logic: buy / sell / reroll + star merging. Pure functions —
// they return new state or null when the action is invalid (invariants 2 & 3).

import type { ManagerState, PlayerCard, PlayerStats, StarLevel } from '../types';
import {
  BENCH_MAX,
  REROLL_COST,
  STAR_COPY_REQUIREMENT,
  STAR_MAX,
  STAR_MULTIPLIER,
  STAT_MAX,
  STAT_MIN,
} from './config';
import { generateShop } from './players';
import type { Rng } from './rng';

export function unfieldedCount(m: ManagerState): number {
  return m.squad.cards.length - m.squad.lineup.length;
}

export function canAfford(m: ManagerState, cost: number): boolean {
  return m.credits >= cost;
}

/** Sell value: full refund of every merged copy's tier price. */
export function sellValue(card: PlayerCard): number {
  return card.tier * Math.pow(STAR_COPY_REQUIREMENT, card.star - 1);
}

function clampStats(stats: PlayerStats): PlayerStats {
  const out = {} as PlayerStats;
  for (const k of ['PAC', 'TEC', 'DEF', 'PHY'] as const) {
    out[k] = Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(stats[k])));
  }
  return out;
}

function starUp(copy: PlayerCard): PlayerCard {
  const nextStar = (copy.star + 1) as StarLevel;
  const mult = STAR_MULTIPLIER[nextStar as 2 | 3];
  return {
    ...copy,
    id: `merged-${copy.templateId}-s${nextStar}-${copy.id}`,
    star: nextStar,
    stats: clampStats({
      PAC: copy.stats.PAC * mult,
      TEC: copy.stats.TEC * mult,
      DEF: copy.stats.DEF * mult,
      PHY: copy.stats.PHY * mult,
    }),
  };
}

/**
 * Auto-merge owned copies: whenever STAR_COPY_REQUIREMENT copies of the same
 * template+star exist, consume 3 → produce one star-(N+1) copy. Chains apply
 * (9× 1★ → 3★). Fielded copies are consumed last; if a merged card was
 * fielded, the upgraded copy takes over its lineup slot.
 */
export function applyMerges(m: ManagerState): ManagerState {
  const cards = [...m.squad.cards];
  const lineup = m.squad.lineup.map((p) => ({ ...p }));
  let mergedAny = false;

  for (let star: StarLevel = 1; star < STAR_MAX; star = (star + 1) as StarLevel) {
    // Repeat within the star level: 6 copies → two merges worth of progress.
    for (let guard = 0; guard < 4; guard++) {
      const groups = new Map<string, PlayerCard[]>();
      for (const c of cards) {
        if (c.star !== star) continue;
        const g = groups.get(c.templateId) ?? [];
        g.push(c);
        groups.set(c.templateId, g);
      }
      let mergedThisPass = false;
      for (const group of groups.values()) {
        if (group.length < STAR_COPY_REQUIREMENT) continue;
        const consumed = group.slice(0, STAR_COPY_REQUIREMENT);
        const consumedIds = new Set(consumed.map((c) => c.id));
        const upgraded = starUp(consumed[0]);
        // Remove consumed cards; insert upgraded copy.
        for (let i = cards.length - 1; i >= 0; i--) {
          if (consumedIds.has(cards[i].id)) cards.splice(i, 1);
        }
        cards.push(upgraded);
        // Fielded slots pointing at consumed cards now point at the upgrade.
        let slotReassigned = false;
        for (const p of lineup) {
          if (consumedIds.has(p.cardId)) {
            if (!slotReassigned) {
              p.cardId = upgraded.id;
              slotReassigned = true;
            } else {
              p.cardId = ''; // mark duplicate slots for removal
            }
          }
        }
        const cleaned = lineup.filter((p) => p.cardId !== '');
        lineup.length = 0;
        lineup.push(...cleaned);
        mergedThisPass = true;
        mergedAny = true;
      }
      if (!mergedThisPass) break;
    }
  }

  if (!mergedAny) return m;
  return { ...m, squad: { cards, lineup } };
}

/** Buy a shop card onto the squad (unfielded), then auto-merge. Null if invalid. */
export function buy(
  m: ManagerState,
  shop: PlayerCard[],
  cardId: string,
): { manager: ManagerState; shop: PlayerCard[] } | null {
  const card = shop.find((c) => c.id === cardId);
  if (!card) return null;
  if (!canAfford(m, card.tier)) return null;
  // Bench full is OK if this copy immediately triggers a merge (frees 2 slots).
  const mergingCopies = m.squad.cards.filter(
    (c) => c.templateId === card.templateId && c.star === card.star,
  ).length;
  if (
    unfieldedCount(m) >= BENCH_MAX &&
    mergingCopies < STAR_COPY_REQUIREMENT - 1
  ) {
    return null;
  }
  const bought: ManagerState = {
    ...m,
    credits: m.credits - card.tier,
    squad: { ...m.squad, cards: [...m.squad.cards, card] },
  };
  return {
    manager: applyMerges(bought),
    shop: shop.filter((c) => c.id !== cardId),
  };
}

/** Sell an owned card for its full merged value. Removes from lineup if fielded. */
export function sell(m: ManagerState, cardId: string): ManagerState | null {
  const card = m.squad.cards.find((c) => c.id === cardId);
  if (!card) return null;
  return {
    ...m,
    credits: m.credits + sellValue(card),
    squad: {
      cards: m.squad.cards.filter((c) => c.id !== cardId),
      lineup: m.squad.lineup.filter((p) => p.cardId !== cardId),
    },
  };
}

/** Pay REROLL_COST for a fresh shop drawn from the run pool. Null if unaffordable. */
export function reroll(
  m: ManagerState,
  round: number,
  rng: Rng,
  pool: PlayerCard[],
): { manager: ManagerState; shop: PlayerCard[] } | null {
  if (!canAfford(m, REROLL_COST)) return null;
  return {
    manager: { ...m, credits: m.credits - REROLL_COST },
    shop: generateShop(rng, round, pool),
  };
}
