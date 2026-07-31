// The match engine. Pure & deterministic: squads + seed in → full event log out.
// Playback in the UI renders this log; it never re-simulates.

import type {
  MatchEvent,
  MatchResult,
  ResolvedPlayer,
  SquadSnapshot,
} from '../types';
import {
  ATTACK_BASE_CHANCE,
  ATTACK_DIFF_DIVISOR,
  ATTACK_MAX_CHANCE,
  ATTACK_MIN_CHANCE,
  CARD_CHANCE_PER_FOUL,
  COMBO_DEFENSIVE_WALL,
  COMBO_NATIONAL_PRIDE,
  COMBO_SAMBA_FLAIR,
  COMBO_TARGET_MEN,
  CONVERSION_BASE,
  CONVERSION_QUALITY_SCALE,
  CORNER_CHANCE_ON_SAVE_BLOCK,
  COUNTER_ATTACK_BONUS,
  COUNTER_SPEEDSTER_COUNT,
  FOUL_CHANCE_PER_TICK,
  GK_SAVE_FACTOR,
  MATCH_TICKS,
  OUTCOME_BLOCKED_SHARE,
  OUTCOME_SAVED_SHARE,
  PENALTY_CHANCE_ON_BIG_CHANCE,
  PENALTY_CONVERSION,
  PENALTY_QUALITY_THRESHOLD,
  Q_BASE,
  Q_CREATOR_TEC,
  Q_FINISHER_PAC,
  Q_FINISHER_TEC,
  normStat,
} from './config';
import { makeRng, type Rng } from './rng';

// ─── Squad aggregates ───────────────────────────────────────────────

function bySlot(snap: SquadSnapshot, slot: string): ResolvedPlayer[] {
  return snap.players.filter((p) => p.slot === slot);
}

function sum(players: ResolvedPlayer[], f: (p: ResolvedPlayer) => number): number {
  return players.reduce((s, p) => s + f(p), 0);
}

export function midfieldControl(snap: SquadSnapshot): number {
  const mid = sum(bySlot(snap, 'MID'), (p) => p.effective.TEC);
  const rest = sum(
    snap.players.filter((p) => p.slot !== 'MID' && p.slot !== 'GK'),
    (p) => p.effective.TEC,
  );
  return mid + 0.4 * rest + 1; // +1 avoids div-by-zero
}

export function attackWeight(snap: SquadSnapshot): number {
  return (
    sum(bySlot(snap, 'FWD'), (p) => p.effective.PAC + p.effective.TEC) +
    0.6 * sum(bySlot(snap, 'MID'), (p) => p.effective.PAC + p.effective.TEC)
  );
}

export function defenseWeight(snap: SquadSnapshot): number {
  return (
    sum(bySlot(snap, 'DEF'), (p) => p.effective.DEF + p.effective.PHY) +
    0.5 * sum(bySlot(snap, 'MID'), (p) => p.effective.DEF + p.effective.PHY)
  );
}

function gkAbility(snap: SquadSnapshot): number {
  const gk = bySlot(snap, 'GK')[0];
  if (!gk) return 0;
  return (gk.effective.DEF + gk.effective.PHY) / 2;
}

function comboBuff(snap: SquadSnapshot, family: string, key?: string): number {
  for (const c of snap.activeCombos) {
    if (c.family !== family || c.tier === 0) continue;
    if (family === 'NationalPride' && key && c.key !== key) continue;
    if (family === 'NationalPride') {
      // strongest national pride applies
      const v = COMBO_NATIONAL_PRIDE.buff[c.tier - 1];
      return v;
    }
    if (family === 'SambaFlair') return COMBO_SAMBA_FLAIR.buff[c.tier - 1];
    if (family === 'DefensiveWall') return COMBO_DEFENSIVE_WALL.debuff[c.tier - 1];
    if (family === 'TargetMen') return COMBO_TARGET_MEN.buff[0];
  }
  return 0;
}

function nationalPrideBuff(snap: SquadSnapshot): number {
  let best = 0;
  for (const c of snap.activeCombos) {
    if (c.family === 'NationalPride' && c.tier > 0) {
      best = Math.max(best, COMBO_NATIONAL_PRIDE.buff[c.tier - 1]);
    }
  }
  return best;
}

function hasCounterThreat(snap: SquadSnapshot): boolean {
  return (
    snap.players.filter((p) => p.card.archetype === 'Speedster').length >=
    COUNTER_SPEEDSTER_COUNT
  );
}

// ─── Chance construction ────────────────────────────────────────────

function pickCreator(rng: Rng, snap: SquadSnapshot): ResolvedPlayer {
  const pool = snap.players.filter((p) => p.slot === 'MID' || p.slot === 'FWD');
  const candidates = pool.length > 0 ? pool : snap.players;
  const weights = candidates.map((p) => Math.max(1, p.effective.TEC));
  return candidates[rng.pickWeighted(weights)];
}

function pickFinisher(rng: Rng, snap: SquadSnapshot): ResolvedPlayer {
  const fwd = snap.players.filter((p) => p.slot === 'FWD');
  const candidates = fwd.length > 0 ? fwd : snap.players.filter((p) => p.slot !== 'GK');
  const pool = candidates.length > 0 ? candidates : snap.players;
  const weights = pool.map((p) => Math.max(1, p.effective.PAC + p.effective.TEC));
  return pool[rng.pickWeighted(weights)];
}

// ─── Main loop ──────────────────────────────────────────────────────

export function simulateMatch(
  home: SquadSnapshot,
  away: SquadSnapshot,
  seed: number,
): MatchResult {
  const rng = makeRng(seed);
  const events: MatchEvent[] = [];
  let homeGoals = 0;
  let awayGoals = 0;

  const push = (
    e: Omit<MatchEvent, 'homeScore' | 'awayScore'>,
  ): void => {
    events.push({ ...e, homeScore: homeGoals, awayScore: awayGoals });
  };

  push({ tick: 0, type: 'KICKOFF', team: 'HOME', narrativeKey: 'match.kickoff' });

  const snaps = { HOME: home, AWAY: away } as const;
  const atkW = { HOME: attackWeight(home), AWAY: attackWeight(away) };
  const defW = { HOME: defenseWeight(home), AWAY: defenseWeight(away) };
  const ctrl = { HOME: midfieldControl(home), AWAY: midfieldControl(away) };
  const gk = { HOME: gkAbility(home), AWAY: gkAbility(away) };
  const counter = { HOME: hasCounterThreat(home), AWAY: hasCounterThreat(away) };

  for (let tick = 1; tick <= MATCH_TICKS; tick++) {
    // 1. Possession contest
    const pHome = Math.min(0.8, Math.max(0.2, ctrl.HOME / (ctrl.HOME + ctrl.AWAY)));
    const attacking: 'HOME' | 'AWAY' = rng.chance(pHome) ? 'HOME' : 'AWAY';
    const defending: 'HOME' | 'AWAY' = attacking === 'HOME' ? 'AWAY' : 'HOME';
    const atk = snaps[attacking];
    const def = snaps[defending];

    // 2. Attack build-up
    let attackChance =
      ATTACK_BASE_CHANCE + (atkW[attacking] - defW[defending]) / ATTACK_DIFF_DIVISOR;
    attackChance += nationalPrideBuff(atk) * 0.5; // chemistry helps moves develop
    if (counter[attacking]) attackChance += COUNTER_ATTACK_BONUS;
    attackChance = Math.min(ATTACK_MAX_CHANCE, Math.max(ATTACK_MIN_CHANCE, attackChance));
    if (!rng.chance(attackChance)) continue;

    if (counter[attacking] && rng.chance(0.3)) {
      push({ tick, type: 'COUNTER', team: attacking, narrativeKey: 'counter.breaks' });
    } else {
      push({ tick, type: 'ATTACK', team: attacking, narrativeKey: 'attack.builds' });
    }

    // 3. Chance creation
    const creator = pickCreator(rng, atk);
    const finisher = pickFinisher(rng, atk);
    const defAvg =
      def.players.length > 0
        ? sum(def.players, (p) => p.effective.DEF) / def.players.length
        : 0;
    let quality =
      Q_BASE +
      Q_FINISHER_TEC * normStat(finisher.effective.TEC) +
      Q_FINISHER_PAC * normStat(finisher.effective.PAC) +
      Q_CREATOR_TEC * normStat(creator.effective.TEC) +
      nationalPrideBuff(atk) +
      comboBuff(atk, 'SambaFlair') * 0.5 -
      0.2 * normStat(defAvg);
    quality = Math.min(1, Math.max(0, quality));

    // 3a. Big chances can become penalties
    if (
      quality > PENALTY_QUALITY_THRESHOLD &&
      rng.chance(PENALTY_CHANCE_ON_BIG_CHANCE)
    ) {
      let pPen = PENALTY_CONVERSION - GK_SAVE_FACTOR * normStat(gk[defending]);
      pPen = Math.min(0.95, Math.max(0.4, pPen));
      const scored = rng.chance(pPen);
      if (scored) {
        if (attacking === 'HOME') homeGoals++; else awayGoals++;
      }
      push({
        tick,
        type: 'PENALTY',
        team: attacking,
        actorId: finisher.card.id,
        secondaryId: bySlot(def, 'GK')[0]?.card.id,
        probability: pPen,
        narrativeKey: scored ? 'goal.penalty' : 'penalty.saved',
        ...(scored ? {} : {}),
      });
      continue;
    }

    push({
      tick,
      type: 'CHANCE',
      team: attacking,
      actorId: finisher.card.id,
      secondaryId: creator.card.id,
      probability: quality,
      narrativeKey: 'chance.created',
    });

    // 4. Outcome
    let p = CONVERSION_BASE + CONVERSION_QUALITY_SCALE * quality;
    p -= GK_SAVE_FACTOR * normStat(gk[defending]);
    p -= comboBuff(def, 'DefensiveWall');
    if (comboBuff(atk, 'TargetMen') > 0 && finisher.card.archetype === 'Poacher') {
      p += COMBO_TARGET_MEN.buff[0];
    }
    p = Math.min(0.9, Math.max(0.02, p));

    const outcomeRoll = rng.next();
    if (outcomeRoll < p) {
      if (attacking === 'HOME') homeGoals++; else awayGoals++;
      const isCounter =
        counter[attacking] &&
        (finisher.card.archetype === 'Speedster' || creator.card.archetype === 'Speedster');
      push({
        tick,
        type: 'GOAL',
        team: attacking,
        actorId: finisher.card.id,
        secondaryId: creator.card.id,
        probability: p,
        narrativeKey: isCounter ? 'goal.counter' : 'goal.openPlay',
      });
    } else {
      const rest = (outcomeRoll - p) / (1 - p); // normalize into [0,1)
      const type =
        rest < OUTCOME_SAVED_SHARE
          ? 'SAVED'
          : rest < OUTCOME_SAVED_SHARE + OUTCOME_BLOCKED_SHARE
            ? 'BLOCKED'
            : 'MISSED';
      const gkPlayer = bySlot(def, 'GK')[0];
      const blocker =
        type === 'BLOCKED' && bySlot(def, 'DEF').length > 0
          ? bySlot(def, 'DEF')[Math.floor(rng.next() * bySlot(def, 'DEF').length)]
          : undefined;
      push({
        tick,
        type,
        team: attacking,
        actorId: finisher.card.id,
        secondaryId: type === 'SAVED' ? gkPlayer?.card.id : blocker?.card.id,
        probability: p,
        narrativeKey:
          type === 'SAVED' ? 'shot.saved' : type === 'BLOCKED' ? 'shot.blocked' : 'shot.missed',
      });
      if ((type === 'SAVED' || type === 'BLOCKED') && rng.chance(CORNER_CHANCE_ON_SAVE_BLOCK)) {
        push({ tick, type: 'CORNER', team: attacking, narrativeKey: 'setpiece.corner' });
      }
    }

    // 5. Color: fouls & cards by the defending side
    const defPhyAvg =
      def.players.length > 0
        ? sum(def.players, (p2) => p2.effective.PHY) / def.players.length
        : 50;
    if (rng.chance(FOUL_CHANCE_PER_TICK * (0.7 + 0.6 * normStat(defPhyAvg)))) {
      const culprit = def.players[Math.floor(rng.next() * def.players.length)];
      push({
        tick,
        type: 'FOUL',
        team: defending,
        actorId: culprit?.card.id,
        narrativeKey: 'foul.committed',
      });
      if (rng.chance(CARD_CHANCE_PER_FOUL)) {
        push({
          tick,
          type: 'CARD',
          team: defending,
          actorId: culprit?.card.id,
          narrativeKey: 'foul.card',
        });
      }
    }
  }

  push({
    tick: MATCH_TICKS,
    type: 'FULLTIME',
    team: 'HOME',
    narrativeKey: 'match.fulltime',
  });

  return {
    seed,
    home: structuredClone(home),
    away: structuredClone(away),
    events,
    homeGoals,
    awayGoals,
  };
}
