// Transfer window logic: buy / sell / reroll. Pure functions — they return
// new state or null when the action is invalid (invariants 2 & 3).

import type { ManagerState, PlayerCard } from '../types';
import { BENCH_MAX, REROLL_COST } from './config';
import { generateShop } from './players';
import type { Rng } from './rng';

export function unfieldedCount(m: ManagerState): number {
  return m.squad.cards.length - m.squad.lineup.length;
}

export function canAfford(m: ManagerState, cost: number): boolean {
  return m.credits >= cost;
}

/** Buy a shop card onto the squad (unfielded). Null if invalid. */
export function buy(
  m: ManagerState,
  shop: PlayerCard[],
  cardId: string,
): { manager: ManagerState; shop: PlayerCard[] } | null {
  const card = shop.find((c) => c.id === cardId);
  if (!card) return null;
  if (!canAfford(m, card.tier)) return null;
  if (unfieldedCount(m) >= BENCH_MAX) return null;
  return {
    manager: {
      ...m,
      credits: m.credits - card.tier,
      squad: { ...m.squad, cards: [...m.squad.cards, card] },
    },
    shop: shop.filter((c) => c.id !== cardId),
  };
}

/** Sell an owned card for its full tier price. Removes from lineup if fielded. */
export function sell(m: ManagerState, cardId: string): ManagerState | null {
  const card = m.squad.cards.find((c) => c.id === cardId);
  if (!card) return null;
  return {
    ...m,
    credits: m.credits + card.tier,
    squad: {
      cards: m.squad.cards.filter((c) => c.id !== cardId),
      lineup: m.squad.lineup.filter((p) => p.cardId !== cardId),
    },
  };
}

/** Pay REROLL_COST for a fresh shop. Null if unaffordable. */
export function reroll(
  m: ManagerState,
  round: number,
  rng: Rng,
): { manager: ManagerState; shop: PlayerCard[] } | null {
  if (!canAfford(m, REROLL_COST)) return null;
  return {
    manager: { ...m, credits: m.credits - REROLL_COST },
    shop: generateShop(rng, round),
  };
}
