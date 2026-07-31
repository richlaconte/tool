# 03 — Game Design Spec (Prototype Rules)

This is the complete rulebook the sim implements. Numbers here are v0 tuning values — they are **named constants in `src/sim/config.ts`**, never magic numbers inline, so playtesting can tune them without code archaeology.

## 1. Players

### 1.1 Player card

A player has: fictional name, nationality, archetype, natural position, 4 stats, cost tier. (Full shape in `04-data-contracts.md`.)

**Nationalities (8):** Brazil, Argentina, France, Germany, Spain, England, Portugal, Netherlands. Chosen for instant football legibility; rendered as flag emoji.

**Archetypes (6):** `Speedster`, `Playmaker`, `Poacher`, `Destroyer`, `Sweeper`, `ShotStopper`. Archetype = flavor + a small stat tilt + combo participation.

**Positions (4 lines):** `GK`, `DEF`, `MID`, `FWD`. (No left/right distinction in MVP.)

**Stats (each 40–99):**
| Stat | Drives |
|---|---|
| `PAC` (Pace) | beating a defender on the ball, counter attacks |
| `TEC` (Technique) | chance creation, through balls, set pieces, shot placement |
| `DEF` (Defending) | blocking/intercepting, reducing opponent chance quality |
| `PHY` (Physicality) | duels, headers, penalties/shootouts, pressing |

**Cost tiers:** 1, 2, 3, 4, 5 credits. Stat totals scale with tier (tier 1 ≈ 200 total; tier 5 ≈ 320). Shop odds shift toward higher tiers in later rounds (config table `SHOP_TIER_ODDS_BY_ROUND`).

### 1.2 The swappable data layer (constitution #3)

Player identity (name pools per nationality, flag, archetype label) lives entirely in `src/sim/players.data.ts` as data tables. Generation = pick nationality → pick name from pool → roll stats by tier & archetype tilt. **Names must be clearly invented** (e.g. "R. Caldeira", "T. Bramwell") and checked against a blocklist of real star surnames to prevent accidental soundalikes (constitution #2).

## 2. Economy & Transfer Window

- Starting credits: **8**. 
- Shop: 5 cards, drawn by tier odds for the current round **from a fixed per-run template pool (36 templates; tier mix 10/9/8/6/3)** — a shared-pool feel so duplicates appear and merging is achievable. Reroll: **1 credit**. Sell value: full refund of every merged copy (tier × 3^(star−1)).
- **Star merging (added 2026-07-31):** every card is a copy of a deterministic template (`templateId`). Owning **3 copies of the same template at the same star auto-merges** into one card of the next star (max ★★★): ★★ = 1.8× base stats, ★★★ = 1.8× again (≈3.24×, stats capped at 99). Merges chain (9 copies → ★★★), fielded copies keep their lineup slot, and buying the merging copy is allowed even on a full bench.
- **Prize money after each match:** 4 base + 1 per goal scored (cap +3) + 2 for a win.
- **Squad cap:** starts at 4 fielded players, +1 every 2 rounds, max 7. (Fewer than 11 keeps decisions snappy and the pitch readable — this is an auto-battler, not a full sim. Formation slots: 1 GK + up to 6 across DEF/MID/FWD lines; a lineup must always field a GK.)
- Bench: max 4. Buying with a full bench is blocked.

## 3. Combinations (the "origins/classes" of TFT)

Four families in MVP, each with 2 tiers. Buffs apply to the whole squad during matches as probability modifiers (exact mechanic per family below). Combos count unique fielded players only.

| Family | Requirement (tier 1 → tier 2) | Effect (tier 1 → tier 2) |
|---|---|---|
| **National Pride** (per nationality) | 2 → 3 fielded of same nationality | +8% → +15% chance-creation quality for the whole squad (national chemistry) |
| **Samba Flair** (Brazilian Speedster/Playmaker) | 2 → 3 | Counters & dribble events: +10% → +18% success |
| **Defensive Wall** (DEF-line players incl. Sweeper/Destroyer) | 2 → 3 DEF line fielded | Opponent shot conversion: −10% → −18% |
| **Target Men** (FWD Poachers) | 2 | Headers/penalty-box chances: +15% conversion |

Combo state is computed from the fielded lineup at kickoff (`combos.ts`), displayed live on the Tactics Board as `Family current/next` chips (US-4).

## 4. Positioning matters (AC-5)

Each pitch slot has a *position-fit multiplier* per player: natural position = 1.0, adjacent line = 0.75 (e.g. MID at DEF), GK anywhere else = 0.5, any outfielder at GK = 0.5. Multiplier scales that player's effective stats. Additionally, line *shape* matters: each match, squad "attack weight" = sum of effective attacking stats of MID+FWD; "defense weight" = effective DEF stats of DEF+MID. Empty lines are punished through these aggregates — an all-FWD lineup leaks goals.

## 5. The match engine (`match.ts`)

A match is a fixed **60 event "ticks"** representing 90 minutes (display maps ticks → clock). Playback compresses to ~90s real time or 15s Turbo. Everything below is driven by the seeded RNG.

### 5.1 Per-tick resolution

1. **Possession contest:** weighted coin flip between the two squads' midfield control (effective MID stats + combo buffs).
2. **Attack build-up (only for possession winner):** base 22% chance an attack develops, modified by attack weight differential and `TEC`/Playmaker/Samba buffs.
3. **Chance creation:** if an attack develops, pick the creator (weighted by effective `TEC` among MID/FWD) and the finisher (weighted by effective `PAC`/`TEC` among FWD+Poachers). Chance quality Q (0–1) = f(finisher stats, creator stats, position-fit, combo buffs, opponent defense weight, opponent Defensive Wall debuff).
4. **Outcome:** shot conversion probability = `0.08 + 0.35 × Q`, adjusted by opponent GK effective stats (ShotStopper bonus) and Target Men bonus. Roll → **Goal** / **Saved** / **Blocked** / **Missed**.
5. **Color events** (low base rates, modified by stats): fouls/cards (~4%/tick when defending, `PHY`-weighted), penalty (~1.5% per big chance, conversion 76%), corner (~8% of blocked/saved), counter-attack goal modifier if a team fields 2+ Speedsters.

### 5.2 Event log

Every tick that produces something emits a `MatchEvent` (contract in §04) with: minute, type, acting player(s), narrative string template id, and the probability that was rolled. The narrative feed renders from these (e.g. `"{finisher} latches onto {creator}'s through ball — GOAL!"`). **The rolled probabilities are stored** so US-12 tooltips and post-match analysis need no re-simulation.

### 5.3 Result

Score = goals. Draw is allowed in MVP (damage splits evenly, see §6). Deterministic: identical inputs + seed → identical log (AC-3).

## 6. Tournament structure (`tournament.ts`)

- 8 managers, 20 HP each. Each round: random pairing among survivors (no rematch of previous round if avoidable).
- **Damage:** loser takes `3 + goal difference` HP; draw: both take 1. Win streak bonus: +1 extra damage per consecutive win (cap 3) — keeps runaway leaders threatening, TFT-style.
- Elimination at 0 HP. Round continues until 1 manager stands (or player eliminated → placement = survivors + 1).
- AI matches (the 3 player-less pairings each round) simulate instantly through the same engine.

## 7. AI managers (`ai.ts`)

Heuristic, not learned — must be competent enough to pressure the player (AC-6):

1. **Buy:** purchase the highest-tier affordable card; prefer cards completing a combo tier (check before buying); reroll once if nothing fits and credits > 4.
2. **Field:** always fill all slots; always field a GK-archetype/natural GK at GK; sort others into natural lines; never voluntarily play out-of-position unless bench forces it.
3. **Sell:** sell the lowest-fit bench card when credits < 2 at window start.
4. **Difficulty curve:** AI receives a hidden credits bonus of `+0.5 × round` — squad strength must rise with rounds (AC-6 test).

## 8. Tuning targets (statistical tests in CI)

- Average total goals per match: 1.5–4.5.
- A squad with an active tier-2 combo beats a same-cost random squad > 60% over 1,000 sims.
- The strongest-tier purchasable squad beats a tier-1 squad > 75% (spending must matter).
- 8-manager run length: median 9–14 rounds.
