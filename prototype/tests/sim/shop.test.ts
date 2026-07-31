import { describe, expect, it } from 'vitest';
import { BENCH_MAX, REROLL_COST, STARTING_CREDITS } from '../../src/sim/config';
import { generateCard, generateRunPool, generateShop } from '../../src/sim/players';
import { buy, reroll, sell, unfieldedCount } from '../../src/sim/shop';
import { makeRng } from '../../src/sim/rng';
import type { ManagerState } from '../../src/types';

function freshManager(rngCredits = STARTING_CREDITS): ManagerState {
  return {
    id: 'player',
    name: 'You',
    hp: 20,
    credits: rngCredits,
    squad: { cards: [], lineup: [] },
    squadCap: 4,
    winStreak: 0,
    eliminated: false,
  };
}

describe('shop', () => {
  it('buy deducts tier price and adds the card unfielded', () => {
    const rng = makeRng(1);
    const shop = generateShop(rng, 1, generateRunPool(1));
    const m = freshManager();
    const card = shop[0];
    const res = buy(m, shop, card.id);
    expect(res).not.toBeNull();
    expect(res!.manager.credits).toBe(m.credits - card.tier);
    expect(res!.manager.squad.cards.map((c) => c.id)).toContain(card.id);
    expect(unfieldedCount(res!.manager)).toBe(1);
    expect(res!.shop.find((c) => c.id === card.id)).toBeUndefined();
  });

  it('buy rejects when credits are insufficient (never goes negative)', () => {
    const rng = makeRng(2);
    const shop = generateShop(rng, 7, generateRunPool(7)); // high-tier shop
    const expensive = shop.reduce((a, b) => (a.tier > b.tier ? a : b));
    const m = freshManager(expensive.tier - 1);
    expect(buy(m, shop, expensive.id)).toBeNull();
    expect(m.credits).toBeGreaterThanOrEqual(0);
  });

  it('buy rejects when bench is full', () => {
    const rng = makeRng(3);
    let m = freshManager(999);
    let shop = generateShop(rng, 3, generateRunPool(3));
    for (let i = 0; i < BENCH_MAX; i++) {
      const res = buy(m, shop, shop[0].id);
      expect(res).not.toBeNull();
      m = res!.manager;
      shop = res!.shop;
    }
    expect(unfieldedCount(m)).toBe(BENCH_MAX);
    const extra = generateCard(rng, 1);
    expect(buy(m, [...shop, extra], extra.id)).toBeNull();
  });

  it('sell refunds the full tier price and removes from lineup', () => {
    const rng = makeRng(4);
    const shop = generateShop(rng, 2, generateRunPool(2));
    let m = freshManager();
    const card = shop[0];
    m = buy(m, shop, card.id)!.manager;
    m = {
      ...m,
      squad: {
        ...m.squad,
        lineup: [{ cardId: card.id, slot: card.naturalPosition }],
      },
    };
    const before = m.credits;
    const after = sell(m, card.id);
    expect(after).not.toBeNull();
    expect(after!.credits).toBe(before + card.tier);
    expect(after!.squad.cards).toHaveLength(0);
    expect(after!.squad.lineup).toHaveLength(0);
  });

  it('reroll costs 1 credit and returns a fresh 5-card shop', () => {
    const rng = makeRng(5);
    const m = freshManager();
    const res = reroll(m, 1, rng, generateRunPool(1));
    expect(res).not.toBeNull();
    expect(res!.manager.credits).toBe(m.credits - REROLL_COST);
    expect(res!.shop).toHaveLength(5);
  });

  it('reroll rejects when broke', () => {
    const rng = makeRng(6);
    const m = freshManager(0);
    expect(reroll(m, 1, rng, generateRunPool(1))).toBeNull();
  });
});
