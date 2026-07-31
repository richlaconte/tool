// LOCKED CONTRACTS — mirror of docs/mvp/04-data-contracts.md
// Code that deviates from these shapes is drift. Amend the doc first, then this file.

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
  PAC: number;
  TEC: number;
  DEF: number;
  PHY: number;
}

export interface PlayerCard {
  id: string;
  name: string;
  nationality: Nationality;
  archetype: Archetype;
  naturalPosition: PositionLine;
  tier: CostTier;
  stats: PlayerStats;
}

// ─── Squad & placement ──────────────────────────────────────────────

export interface Placement {
  cardId: string;
  slot: PositionLine;
}

export interface Squad {
  cards: PlayerCard[];      // ALL owned cards (fielded + unfielded)
  lineup: Placement[];      // fielded players; cardId must exist in cards;
                            // exactly one slot 'GK'; length ≤ squadCap
}
// "Bench" is derived: cards whose id is not in lineup. Bench size = cards.length
// - lineup.length, and must stay ≤ 4 (BENCH_MAX).

// ─── Combinations ───────────────────────────────────────────────────

export type ComboFamily =
  | 'NationalPride'
  | 'SambaFlair'
  | 'DefensiveWall'
  | 'TargetMen';

export interface ComboState {
  family: ComboFamily;
  key?: Nationality;
  count: number;
  tier: 0 | 1 | 2;
}

// ─── Match engine ───────────────────────────────────────────────────

export type MatchEventType =
  | 'KICKOFF' | 'ATTACK' | 'CHANCE'
  | 'GOAL' | 'SAVED' | 'BLOCKED' | 'MISSED'
  | 'FOUL' | 'CARD' | 'PENALTY' | 'CORNER' | 'COUNTER'
  | 'FULLTIME';

export interface MatchEvent {
  tick: number;
  type: MatchEventType;
  team: 'HOME' | 'AWAY';
  actorId?: string;
  secondaryId?: string;
  probability?: number;
  narrativeKey: string;
  homeScore: number;
  awayScore: number;
}

export interface MatchResult {
  seed: number;
  home: SquadSnapshot;
  away: SquadSnapshot;
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
}

export interface SquadSnapshot {
  managerId: string;
  players: ResolvedPlayer[];
  activeCombos: ComboState[];
}

export interface ResolvedPlayer {
  card: PlayerCard;
  slot: PositionLine;
  effective: PlayerStats;
}

// ─── Tournament / run state ─────────────────────────────────────────

export type ManagerId = string;

export interface ManagerState {
  id: ManagerId;
  name: string;
  hp: number;
  credits: number;
  squad: Squad;
  squadCap: number;
  winStreak: number;
  eliminated: boolean;
  placement?: number;
}

export type GamePhase =
  | 'TRANSFER_WINDOW'
  | 'TACTICS'
  | 'MATCH'
  | 'RESULTS'
  | 'RUN_OVER';

export interface GameState {
  saveVersion: 1;
  seed: number;
  round: number;
  phase: GamePhase;
  managers: ManagerState[];
  currentShop: PlayerCard[];
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

// ─── Note on card ownership ─────────────────────────────────────────
// All owned cards live in Squad.cards (fielded + benched). lineup entries
// reference cards by id. "Bench" = cards not referenced by lineup.

