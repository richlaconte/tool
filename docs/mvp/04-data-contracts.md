# 04 — Data Contracts (LOCKED)

These TypeScript types are the exact API between sim, state, and UI. They are mirrored verbatim in `prototype/src/types/index.ts`. **Code that deviates is drift — fix the code, not this file.** Amendments require founder sign-off and a spec note.

```ts
// ─── Identity & enums ───────────────────────────────────────────────

export type Nationality =
  | 'BRA' | 'ARG' | 'FRA' | 'GER' | 'ESP' | 'ENG' | 'POR' | 'NED';

export type Archetype =
  | 'Speedster' | 'Playmaker' | 'Poacher'
  | 'Destroyer' | 'Sweeper' | 'ShotStopper';

export type PositionLine = 'GK' | 'DEF' | 'MID' | 'FWD';

export type CostTier = 1 | 2 | 3 | 4 | 5;

// ─── Players ────────────────────────────────────────────────────────

export interface PlayerStats {
  PAC: number; // 40–99
  TEC: number; // 40–99
  DEF: number; // 40–99
  PHY: number; // 40–99
}

export interface PlayerCard {
  id: string;              // unique per card instance (uuid-ish, sim-generated)
  name: string;            // fictional, from data layer pools
  nationality: Nationality;
  archetype: Archetype;
  naturalPosition: PositionLine;
  tier: CostTier;
  stats: PlayerStats;
}

// ─── Squad & placement ──────────────────────────────────────────────

/** One fielded player: which card, and which line slot they occupy. */
export interface Placement {
  cardId: string;
  slot: PositionLine;      // where they actually play (may ≠ naturalPosition)
}

// AMENDMENT 2026-07-31 (founder-approved during build): bench storage was
// ambiguous — fielded cards had no home. Squad now owns all cards; bench is
// derived (cards not referenced by lineup), max 4 unfielded.
export interface Squad {
  cards: PlayerCard[];      // ALL owned cards (fielded + unfielded)
  lineup: Placement[];     // fielded players; cardId must exist in cards;
                           // exactly one slot 'GK'; length ≤ squadCap
}

// ─── Combinations ───────────────────────────────────────────────────

export type ComboFamily =
  | 'NationalPride'        // keyed by nationality in ComboState.key
  | 'SambaFlair'
  | 'DefensiveWall'
  | 'TargetMen';

export interface ComboState {
  family: ComboFamily;
  key?: Nationality;       // only for NationalPride
  count: number;           // qualifying fielded players
  tier: 0 | 1 | 2;         // 0 = inactive
}

// ─── Match engine ───────────────────────────────────────────────────

export type MatchEventType =
  | 'KICKOFF' | 'ATTACK' | 'CHANCE'
  | 'GOAL' | 'SAVED' | 'BLOCKED' | 'MISSED'
  | 'FOUL' | 'CARD' | 'PENALTY' | 'CORNER' | 'COUNTER'
  | 'FULLTIME';

export interface MatchEvent {
  tick: number;            // 0–59; display minute = floor(tick * 90 / 60)
  type: MatchEventType;
  team: 'HOME' | 'AWAY';   // HOME = the human player's squad in their own match
  actorId?: string;        // primary player (e.g. finisher)
  secondaryId?: string;    // e.g. creator/assister
  probability?: number;    // the roll's success probability (for tooltips/analysis)
  narrativeKey: string;    // i18n-ish template id, e.g. 'goal.throughBall'
  homeScore: number;       // running score AFTER this event
  awayScore: number;
}

export interface MatchResult {
  seed: number;
  home: SquadSnapshot;     // deep-frozen input squads (see below)
  away: SquadSnapshot;
  events: MatchEvent[];    // complete log; playback renders from this only
  homeGoals: number;
  awayGoals: number;
}

/** A squad fully resolved for simulation: effective stats already include
 *  position-fit multipliers and combo buffs. The UI never constructs these;
 *  only sim/prep code does. */
export interface SquadSnapshot {
  managerId: string;
  players: ResolvedPlayer[];
  activeCombos: ComboState[];
}

export interface ResolvedPlayer {
  card: PlayerCard;
  slot: PositionLine;
  effective: PlayerStats;  // stats × positionFit × combo multipliers
}

// ─── Tournament / run state ─────────────────────────────────────────

export type ManagerId = string; // 'player' or 'ai-1'…'ai-7'

export interface ManagerState {
  id: ManagerId;
  name: string;            // fictional manager/club-style names for AI
  hp: number;              // start 20; eliminated at 0
  credits: number;
  squad: Squad;
  squadCap: number;        // fielded limit; starts 4, +1 per 2 rounds, max 7
  winStreak: number;
  eliminated: boolean;
  placement?: number;      // set on elimination
}

export type GamePhase =
  | 'TRANSFER_WINDOW'
  | 'TACTICS'
  | 'MATCH'
  | 'RESULTS'
  | 'RUN_OVER';

export interface GameState {
  saveVersion: 1;          // bump on any breaking shape change; old saves discarded
  seed: number;            // run seed; all randomness derives from this
  round: number;           // 1-based
  phase: GamePhase;
  managers: ManagerState[];      // always 8 entries (player + 7 AI)
  currentShop: PlayerCard[];     // 5 cards for the human player
  currentPairing: { home: ManagerId; away: ManagerId } | null;
  lastMatch: MatchResult | null;
  standingsHistory: { round: number; hp: Record<ManagerId, number> }[];
}

// ─── Friend challenge (US-11, optional) ─────────────────────────────

export interface ChallengePayload {
  v: 1;
  seed: number;
  squad: Squad;
}
// Serialized as base64url(JSON.stringify(payload)) in URL hash: #challenge=...
```

## Invariants the sim must enforce (test these)

1. `Squad.lineup` contains exactly one placement with `slot === 'GK'`.
2. `Squad.lineup.length ≤ ManagerState.squadCap`; every `lineup.cardId` exists in `Squad.cards`; unfielded cards (`cards.length - lineup.length`) ≤ 4.
3. `ManagerState.credits` never goes negative — invalid actions are rejected by sim functions, not by UI hiding buttons.
4. Every `MatchEvent` after a `GOAL` reflects the updated running score.
5. `GameState.seed` is the sole entropy source; no sim function accepts or uses any other randomness.
6. `MatchResult.home/away` snapshots are deep-frozen at match start — mid-match edits to squads cannot corrupt a replay.
