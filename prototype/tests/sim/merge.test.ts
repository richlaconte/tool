import { describe, expect, it } from 'vitest';
import { STAR_COPY_REQUIREMENT, STAT_MAX } from '../../src/sim/config';
import { generateRunPool, instantiate } from '../../src/sim/players';
import { applyMerges, buy, sellValue } from '../../src/sim/shop';
import { makeRng } from '../../src/sim/rng';
import type { ManagerState, PlayerCard } from '../../src/types';

function managerWith(cards: PlayerCard[], lineup: { cardId: string; slot: 'GK' | 'DEF' | 'MID' | 'FWD' }[] = []): ManagerState {
  return {
    id: 'player',
    name: 'You',
    hp: 20,
    credits: 100,
    squad: { cards, lineup },
    squadCap: 4,
    winStreak: 0,
    eliminated: false,
  };
}

function copiesOf(template: PlayerCard, n: number): PlayerCard[] {
  const rng = makeRng(1);
  return Array.from({ length: n }, () => instantiate(rng, template));
}

const template = generateRunPool(9).find((t) => t.naturalPosition === 'FWD')!;

describe('star merging', () => {
  it('3 copies of the same template merge into a 2★ with multiplied stats', () => {
    const m = managerWith(copiesOf(template, 3));
    const merged = applyMerges(m);
    expect(merged.squad.cards).toHaveLength(1);
    const star2 = merged.squad.cards[0];
    expect(star2.star).toBe(2);
    expect(star2.templateId).toBe(template.templateId);
    expect(star2.stats.PAC).toBeGreaterThan(template.stats.PAC);
  });

  it('9 copies chain-merge into a single 3★', () => {
    const m = managerWith(copiesOf(template, 9));
    const merged = applyMerges(m);
    expect(merged.squad.cards).toHaveLength(1);
    expect(merged.squad.cards[0].star).toBe(3);
    for (const k of ['PAC', 'TEC', 'DEF', 'PHY'] as const) {
      expect(merged.squad.cards[0].stats[k]).toBeLessThanOrEqual(STAT_MAX);
    }
  });

  it('2 copies do not merge', () => {
    const m = managerWith(copiesOf(template, 2));
    expect(applyMerges(m).squad.cards).toHaveLength(2);
  });

  it('different templates never merge together', () => {
    const pool = generateRunPool(9);
    const other = pool.find((t) => t.templateId !== template.templateId)!;
    const m = managerWith([...copiesOf(template, 2), ...copiesOf(other, 1)]);
    expect(applyMerges(m).squad.cards).toHaveLength(3);
  });

  it('a fielded copy keeps its lineup slot through the merge', () => {
    const copies = copiesOf(template, 3);
    const m = managerWith(copies, [{ cardId: copies[0].id, slot: 'FWD' }]);
    const merged = applyMerges(m);
    expect(merged.squad.lineup).toHaveLength(1);
    expect(merged.squad.lineup[0].cardId).toBe(merged.squad.cards[0].id);
  });

  it('buying the third copy auto-merges through the real shop path', () => {
    const rng = makeRng(5);
    const owned = copiesOf(template, 2);
    let m = managerWith(owned);
    const thirdCopy = instantiate(rng, template);
    const res = buy(m, [thirdCopy], thirdCopy.id);
    expect(res).not.toBeNull();
    m = res!.manager;
    expect(m.squad.cards).toHaveLength(1);
    expect(m.squad.cards[0].star).toBe(2);
  });

  it('sell value scales with merged copies: tier × 3^(star-1)', () => {
    const star1 = copiesOf(template, 1)[0];
    expect(sellValue(star1)).toBe(template.tier);
    const star2 = applyMerges(managerWith(copiesOf(template, 3))).squad.cards[0];
    expect(sellValue(star2)).toBe(template.tier * 3);
    const star3 = applyMerges(managerWith(copiesOf(template, 9))).squad.cards[0];
    expect(sellValue(star3)).toBe(template.tier * 9);
  });

  it('copy requirement constant is 3 (TFT rule)', () => {
    expect(STAR_COPY_REQUIREMENT).toBe(3);
  });
});
