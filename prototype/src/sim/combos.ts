// Combination detection + squad resolution (position fit & buffs → effective stats).

import type {
  ComboState,
  PlayerCard,
  PositionLine,
  ResolvedPlayer,
  Squad,
  SquadSnapshot,
} from '../types';
import {
  COMBO_DEFENSIVE_WALL,
  COMBO_NATIONAL_PRIDE,
  COMBO_SAMBA_FLAIR,
  COMBO_TARGET_MEN,
  positionFit,
} from './config';

function tierFor(count: number, thresholds: number[]): 0 | 1 | 2 {
  if (thresholds.length >= 2 && count >= thresholds[1]) return 2;
  if (count >= thresholds[0]) return 1;
  return 0;
}

export function fieldedCards(squad: Squad): { card: PlayerCard; slot: PositionLine }[] {
  const byId = new Map(squad.cards.map((c) => [c.id, c]));
  return squad.lineup
    .map((p) => {
      const card = byId.get(p.cardId);
      return card ? { card, slot: p.slot } : null;
    })
    .filter((x): x is { card: PlayerCard; slot: PositionLine } => x !== null);
}

/** Detect all combo states for the currently fielded lineup. */
export function detectCombos(squad: Squad): ComboState[] {
  const fielded = fieldedCards(squad);
  const combos: ComboState[] = [];

  // National Pride — one entry per nationality with ≥1 fielded player.
  const byNat = new Map<string, number>();
  for (const { card } of fielded) {
    byNat.set(card.nationality, (byNat.get(card.nationality) ?? 0) + 1);
  }
  for (const [nat, count] of byNat) {
    combos.push({
      family: 'NationalPride',
      key: nat as ComboState['key'],
      count,
      tier: tierFor(count, COMBO_NATIONAL_PRIDE.tiers),
    });
  }

  // Samba Flair — Brazilian Speedsters + Playmakers.
  const samba = fielded.filter(
    ({ card }) =>
      card.nationality === 'BRA' &&
      (card.archetype === 'Speedster' || card.archetype === 'Playmaker'),
  ).length;
  combos.push({
    family: 'SambaFlair',
    count: samba,
    tier: tierFor(samba, COMBO_SAMBA_FLAIR.tiers),
  });

  // Defensive Wall — DEF-line fielded (any archetype).
  const wall = fielded.filter(({ slot }) => slot === 'DEF').length;
  combos.push({
    family: 'DefensiveWall',
    count: wall,
    tier: tierFor(wall, COMBO_DEFENSIVE_WALL.tiers),
  });

  // Target Men — FWD-slot Poachers.
  const targetMen = fielded.filter(
    ({ card, slot }) => slot === 'FWD' && card.archetype === 'Poacher',
  ).length;
  combos.push({
    family: 'TargetMen',
    count: targetMen,
    tier: tierFor(targetMen, COMBO_TARGET_MEN.tiers),
  });

  return combos;
}

/** Active (tier ≥ 1) combos only. */
export function activeCombos(squad: Squad): ComboState[] {
  return detectCombos(squad).filter((c) => c.tier > 0);
}

/** Resolve a squad into a match-ready snapshot: effective stats = base × fit.
 *  Inputs are deep-cloned so mid-match edits can't corrupt a replay (invariant 6). */
export function resolveSquad(managerId: string, squad: Squad): SquadSnapshot {
  const players: ResolvedPlayer[] = fieldedCards(squad).map(({ card, slot }) => {
    const fit = positionFit(card.naturalPosition, slot);
    return {
      card,
      slot,
      effective: {
        PAC: card.stats.PAC * fit,
        TEC: card.stats.TEC * fit,
        DEF: card.stats.DEF * fit,
        PHY: card.stats.PHY * fit,
      },
    };
  });
  const snapshot: SquadSnapshot = {
    managerId,
    players,
    activeCombos: activeCombos(squad),
  };
  return structuredClone(snapshot);
}
