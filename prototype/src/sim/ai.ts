// AI manager heuristics: transfer window decisions + lineup setting (spec §7).

import type { ManagerState, PlayerCard, PositionLine } from '../types';
import {
  AI_CREDITS_BONUS_PER_ROUND,
  AI_SELL_CREDIT_FLOOR,
  BENCH_MAX,
  COMBO_NATIONAL_PRIDE,
  COMBO_SAMBA_FLAIR,
} from './config';
import { generateShop } from './players';
import { buy, sell } from './shop';
import type { Rng } from './rng';

function statTotal(c: PlayerCard): number {
  return c.stats.PAC + c.stats.TEC + c.stats.DEF + c.stats.PHY;
}

function unfielded(m: ManagerState): number {
  return m.squad.cards.length - m.squad.lineup.length;
}

function ownsGk(m: ManagerState): boolean {
  const gkIds = new Set(
    m.squad.lineup.filter((p) => p.slot === 'GK').map((p) => p.cardId),
  );
  return m.squad.cards.some(
    (c) => c.naturalPosition === 'GK' || gkIds.has(c.id),
  );
}

/** Would this card complete a combo tier given what the manager already owns? */
function comboValue(m: ManagerState, c: PlayerCard): number {
  let v = 0;
  const owned = m.squad.cards;
  const sameNat = owned.filter((o) => o.nationality === c.nationality).length;
  for (const t of COMBO_NATIONAL_PRIDE.tiers) {
    if (sameNat + 1 === t) v += 4;
  }
  if (
    c.nationality === 'BRA' &&
    (c.archetype === 'Speedster' || c.archetype === 'Playmaker')
  ) {
    const samba = owned.filter(
      (o) =>
        o.nationality === 'BRA' &&
        (o.archetype === 'Speedster' || o.archetype === 'Playmaker'),
    ).length;
    for (const t of COMBO_SAMBA_FLAIR.tiers) {
      if (samba + 1 === t) v += 5;
    }
  }
  return v;
}

function cardScore(m: ManagerState, c: PlayerCard): number {
  let score = c.tier * 10 + statTotal(c) / 25 + comboValue(m, c);
  if (c.naturalPosition === 'GK' && !ownsGk(m)) score += 100; // must have a keeper
  return score;
}

/** Full AI transfer window: bonus income → maybe sell → buy best cards → maybe reroll. */
export function aiTakeTransferWindow(
  rng: Rng,
  input: ManagerState,
  round: number,
): ManagerState {
  let m: ManagerState = {
    ...input,
    credits: input.credits + Math.floor(AI_CREDITS_BONUS_PER_ROUND * round),
  };

  // Sell the weakest unfielded card when broke.
  if (m.credits < AI_SELL_CREDIT_FLOOR) {
    const fielded = new Set(m.squad.lineup.map((p) => p.cardId));
    const benchCards = m.squad.cards.filter((c) => !fielded.has(c.id));
    if (benchCards.length > 0) {
      const worst = benchCards.reduce((a, b) => (statTotal(a) <= statTotal(b) ? a : b));
      m = sell(m, worst.id) ?? m;
    }
  }

  // Buy loop.
  let shop = generateShop(rng, round);
  for (let guard = 0; guard < 10; guard++) {
    const affordable = shop.filter((c) => c.tier <= m.credits);
    if (affordable.length === 0) break;
    if (unfielded(m) >= BENCH_MAX) break;
    const best = affordable.reduce((a, b) =>
      cardScore(m, a) >= cardScore(m, b) ? a : b,
    );
    const res = buy(m, shop, best.id);
    if (!res) break;
    m = res.manager;
    shop = res.shop;
  }

  return m;
}

const LINE_ORDER: PositionLine[] = ['GK', 'DEF', 'MID', 'FWD'];

/** Choose the best valid lineup: exactly one GK, best cards in natural lines. */
export function aiSetLineup(input: ManagerState): ManagerState {
  const m: ManagerState = { ...input, squad: { ...input.squad, lineup: [] } };
  const cards = [...m.squad.cards];
  if (cards.length === 0) return m;

  const lineup: { cardId: string; slot: PositionLine }[] = [];
  const used = new Set<string>();
  const take = (c: PlayerCard, slot: PositionLine): void => {
    lineup.push({ cardId: c.id, slot });
    used.add(c.id);
  };

  // 1. Goalkeeper: best natural GK, else best defensive card as emergency keeper.
  const naturalGks = cards
    .filter((c) => c.naturalPosition === 'GK')
    .sort((a, b) => statTotal(b) - statTotal(a));
  if (naturalGks.length > 0) {
    take(naturalGks[0], 'GK');
  } else {
    const emergency = [...cards].sort(
      (a, b) => b.stats.DEF + b.stats.PHY - (a.stats.DEF + a.stats.PHY),
    )[0];
    take(emergency, 'GK');
  }

  // 2. Fill remaining slots with the best remaining cards in their natural line.
  const rest = cards
    .filter((c) => !used.has(c.id))
    .sort((a, b) => b.tier - a.tier || statTotal(b) - statTotal(a));
  for (const c of rest) {
    if (lineup.length >= m.squadCap) break;
    const slot: PositionLine = c.naturalPosition === 'GK' ? 'DEF' : c.naturalPosition;
    take(c, LINE_ORDER.includes(slot) ? slot : 'MID');
  }

  return { ...m, squad: { ...m.squad, lineup } };
}

/** Squad-strength metric used by tests and tuning. */
export function squadStrength(m: ManagerState): number {
  const byId = new Map(m.squad.cards.map((c) => [c.id, c]));
  return m.squad.lineup.reduce((s, p) => {
    const c = byId.get(p.cardId);
    return c ? s + statTotal(c) : s;
  }, 0);
}
