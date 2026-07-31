# Tactics FC — Core Game Loop & Match Engine Design (v0.1)

**Date:** 2026-07-31
**Scope:** Full game loop: lobby → setup/shop phase → tactics phase → match phase (event-timeline engine) → results. Economy, items/inventory, traits, positioning mechanics.
**Design targets:** Standard match-set ~20 min; Turbo ~12 min. One visible event every 4–6 s during the watch phase; a "vignette moment" every ~10 s. Better squad wins ~70–75% of matches (skill-dominant, upsets possible).

---

## 1. The full game loop (8-player lobby)

```
QUEUE → LOBBY (8 managers) → STARTER DRAFT →
  ┌──────────────── ROUND LOOP (R1 → ~R22) ────────────────┐
  │  1. TRANSFER WINDOW (shop)         ~40–45s             │
  │  2. TACTICS PHASE (formation/items)~30s                │
  │  3. MATCH PHASE (event timeline)   ~60–75s             │
  │  4. RESULTS & DAMAGE               ~15s                │
  │  every 4th round: SCOUTING COMBINE (draft, no match)   │
  │  every 6th round: INTERNATIONAL BREAK (PvE, item drop) │
  └─────────────────────────────────────────────────────────┘
→ ELIMINATIONS at 0 Morale → PLACEMENT → POST-GAME (rank pts, pass XP)
```

**Lobby:** 8 managers, MMR-matched. On entry: **Starter Draft** — each manager picks 1 of 3 offered "starter packs" (a 1★ GK + two 1★ outfielders with a shared trait seed, e.g., an Iberia pair or a Playmaker pair). This front-loads a meaningful decision and seeds early trait direction.

**Elimination:** each manager starts at **100 Morale**. Morale loss per round is driven by goal difference (§7). Last manager standing wins; placement = order of elimination (TFT standard).

---

## 2. Transfer Window (the shop phase)

- **Shop:** 5 player cards offered from the shared lobby pool; refresh costs 2. Lock button carries the shop to next round (free).
- **Player cost tiers:** 1 / 2 / 3 / 4 / 5 credits. Higher manager level improves the odds of high-tier cards appearing (TFT shop-odds curve).
- **Star-up:** 3 identical 1★ → 2★; 3 identical 2★ → 3★. Framed as development: 1★ Prospect → 2★ First-Teamer → 3★ World-Class. Stat multipliers: ×1.0 / ×1.5 / ×2.25.
- **Sell:** full refund at 1★; depreciated at higher stars (TFT rules).
- **Bench:** 8 slots. Players on the bench count toward nothing except Chemistry links marked "squad-wide."

### Economy (income each Transfer Window)

| Source | Amount |
|---|---|
| Base income ("commercial revenue") | 5 |
| Interest ("cash reserves") | +1 per 10 banked, cap +5 |
| Win streak / loss streak | +1 (2–3 streak), +2 (4–5), +3 (6+) |
| Underdog bonus (bottom 2 Morale) | +1 |

### Manager Level & the Salary Cap (the key translation)

TFT's "level = units on board" doesn't map to soccer (a team is always 11). The football-native translation:

- **Every player has a wage = their cost tier.** Your **Wage Budget** = 6 + (2 × Manager Level).
- Fielded XI's total wages may not exceed the Wage Budget. Level 1 → ~8 wage (a cheap XI); Level 9 → ~24 (field some 4–5-cost stars).
- **XP purchase:** spend 4 credits → +4 XP, exactly like TFT — preserving the core tension of *spend-to-power-now vs save-for-interest*.
- This makes leveling a **squad-quality** decision rather than a squad-size one, and keeps superstar cards (4–5 cost) gated behind economy play.

---

## 3. Inventory & items

**Item inventory:** 6 slots (items overflow to a "loan out/sell for 1 credit" prompt).

| Item | Slot | Effect |
|---|---|---|
| Strike Boots | Player | +SHO on shot resolution |
| Captain's Armband | Player (1/team) | Aura: adjacent teammates (pitch-adjacency!) +duel win |
| Keeper Gloves | GK | +REF on save resolution |
| Engine Room Vest | MID | +buildup success when in starting XI |
| Set-Piece Playbook | Team | +corner/ FK attack quality |
| Energy Gel | Consumable | One match: +PAC, +late-phase event boost |
| Tactical Foul | Consumable | Cancel one opponent counter-attack per match |

**Acquisition:** International Break PvE rounds (§5) drop 1–2 items; occasional "Sponsor Package" choice (pick 1 of 3) after Scouting Combines.

---

## 4. Tactics Phase (positioning — the TFT board analog)

### Formation
Pick a formation (start with 6: 4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 5-3-2, 4-1-4-1). Each defines 11 slots with zone coordinates (GK / LB CB RB / DM CM AM / LW ST RW etc.). Drag players onto slots (touch-friendly: raised slots, magnetic snap, ≥48dp targets).

**Position fit:** each player has a primary position + 1–2 secondary positions. Out-of-position placement = −25% effective stats (red badge on the slot). This creates real bench-depth decisions and makes versatile players valuable.

### The Matchup Matrix (why placement wins games)
Pre-match, the engine computes — and **shows the player** — three attack lanes vs the opponent's three defensive lanes:

```
YOUR ATTACK WEIGHT (per lane) = Σ(stats of attackers/mids assigned to that lane, modified by traits & form)
THEIR DEFENSE WEIGHT (per lane) = same, for defenders/defensive mids
LANE MODIFIER = clamp(your attack − their defense) → ±% applied to buildup & chance-quality rolls for attacks from that lane
```

The Tactics screen shows a **matchup preview**: "LEFT FLANK: ▲ ADVANTAGE" / "CENTER: ▼ EXPOSED." Scouting the upcoming opponent (tap their mini-pitch) lets you reshuffle to exploit or patch lanes. This is the single most important mechanic: it makes placement decisions *legible* and lets players attribute match events to their choices ("my left overload produced 4 chances").

### Game Plan toggles (3 per match, free)
- **Pressing:** High (+buildup disruption, +concede counters) / Balanced / Low block (−opponent chance quality, −own attacks)
- **Defensive line:** High (+compress, +through-ball vulnerability) / Deep
- **Tempo:** Fast (+attacks per match, +variance) / Controlled (−attacks, −variance)

---

## 5. Round cadence

| Round | Content |
|---|---|
| R1–R3 | Standard rounds (weak opponents first via pairing) |
| R4 | **Scouting Combine** (carousel): all 8 managers draft 1 player from a shared pool of 8, in **reverse Morale order** — the comeback mechanic. No match this round. |
| R6 | **International Break** (PvE): everyone plays a neutral AI youth XI; win → item drops + small Morale heal (+3). |
| R8 | Scouting Combine |
| R12 | International Break |
| R16 | Scouting Combine (pool now includes 4–5-cost stars) |
| R18+ | "Run-in": no more breaks; match damage +1 (endgame pressure) |

Pairing: Swiss-style — you don't face the same opponent twice in a row; standings-based pairing from R8 onward.

---

## 6. The Match Phase — the event-timeline engine (your concept, formalized)

A match = **compressed 90 minutes over ~60–75 s**, divided into **6 phases**: Opening (0–15'), Mid-1H (15–35'), Late-1H (35–45+), HT (3 s pause), Mid-2H (45–70'), Late-2H + stoppage (70–90+).

Per phase, each team gets **1–3 attacks** (modified by Tempo toggle, midfield control differential, and traits). Expect **8–14 attacks per team per match** — the sample size that makes skill dominant but keeps upsets alive.

### 6.1 The attack chain (every attack resolves through 4 nodes)

```
① ORIGIN        Which lane does the attack come through?
               P(lane) ∝ your lane attack weight vs their lane defense weight
               (positioning + formation matchup enters HERE)

② BUILDUP       Your buildup rating (MID PAS + playmaker traits)
               vs their disruption (DEF/DM DEF + pressing traits + their Pressing toggle)
               FAIL → attack fizzles: feed event "attack broken up in midfield"
               PASS → chance created; roll chance type:
                 • open-play shot      (baseline)
                 • cutback/cross header (needs wide lane origin; Target Man boosts)
                 • through ball         (needs their High line; Speedster boosts)
                 • long shot            (fallback when lanes are closed)

③ CHANCE QUALITY  → xG value rolled in a range by chance type,
                 ± lane modifier, ± traits, ± shooter star level
                 (clear-cut 0.30–0.55 / half-chance 0.10–0.25 / long shot 0.02–0.08)

④ RESOLUTION     Shot: P(goal) = xG × (SHO/100) × keeper factor (1 − REF/250)
                 Outcomes: GOAL / SAVED / BLOCKED / OFF TARGET / WOODWORK (2%)
                 Saved/blocked → 35% chance of CORNER (see set pieces)
```

### 6.2 Special events (rolled per attack, low frequency)

| Event | Trigger odds | Resolution |
|---|---|---|
| **Penalty** | ~1.5% per box-entry attack (dribbler vs tackler duel) | Penalty duel: P(goal) ≈ 0.75 × SHO mod vs REF mod. Maximum drama — always a vignette |
| **Direct free kick** | ~2% per fizzled attack in final third | If squad has FK specialist trait: xG 0.05–0.12; otherwise wasted |
| **Corner** | 35% after saved/blocked shots | Aerial duel: attacker PHY/heading vs defender PHY + keeper claim roll → goal ~8–12%, cleared, or recycled |
| **Counter-attack** | After a failed attack vs High press | Speedster-tagged players: instant ②-skip attack with +lane modifier |
| **Yellow/Red card** | ~1.5% / 0.3% per defensive duel lost vs fast attacker | Red = player off, rest of match 10v11 (−20% all lane weights) — match-swinging event |
| **Injury** | ~0.5% per phase, weighted to high-PHY duelers | Player off → auto-sub from bench (this is why bench construction matters) |

### 6.3 Stat model (keep it compact — 6 stats)

| Stat | Used in |
|---|---|
| PAC (pace) | counters, lane duels, pressing |
| SHO (shooting) | node ④ resolution |
| PAS (passing) | node ② buildup |
| DEF (defending) | disruption, duels |
| PHY (physical) | corners, aerials, duels, injury resist |
| REF (reflexes, GK) | node ④ keeper factor |

Base stats by cost tier; archetype (role) sets the distribution (a Target Man is PHY/SHO-heavy; a Playmaker PAS-heavy). Star multiplier ×1.0/×1.5/×2.25.

### 6.4 What the player SEES (the watch phase UI)

- **Top:** score bug + compressed match clock + phase indicator.
- **Center:** pitch with moving player avatars/dots; ball carries across lanes — continuous motion so the screen is never dead.
- **Bottom:** the **Event Timeline** — your "status timeline" — a live feed of cards:
  `12' 🔵 Attack building down the left…` → `12' ❌ Cut out by their DM` · `23' 🟡 Half-chance — dragged wide` · `34' ⚽ GOAL! Cutback finished (xG 0.41)` · `57' 🟥 PENALTY!… SAVED!!`
- **Vignettes:** shots, penalties, red cards, and corners zoom to a 3–5 s cinematic (shooter vs defender vs keeper; the roll is telegraphed visually — keeper commits left, shot goes right). Routine buildup failures stay as feed ticks only.
- **Post-match:** result, xG map, **matchup report** ("Your left-flank advantage created 4 of 6 chances"), Morale damage dealt, one-line "what decided it" summary.

Cadence check: ~16–24 feed events + ~6–9 vignettes per match ≈ one event every 4–6 s, one vignette every ~10 s. Hits the design target.

---

## 7. Results, damage & elimination

| Match outcome | Morale damage to loser |
|---|---|
| Draw | 1 to both (a 0–0 still stings — discourages passivity) |
| Loss by 1 | 3 |
| Loss by 2 | 5 |
| Loss by 3+ | 7 (cap) |
| From R18 ("Run-in") | +1 all damage |
| Win bonus | +2 Morale heal to winner (comeback-friendly, keeps all 8 alive longer) |

Placement awards rank points TFT-style (top 4 = gain). Post-game: season-pass XP, quest progress, recap of biggest trait contributors ("Playmaker 4 generated 11 chances — MVP system").

---

## 8. Traits → engine mapping (examples; full set in the product plan)

Every trait breakpoint must buff a *visible engine node*:

| Trait | 2-piece | 4-piece | Node affected |
|---|---|---|---|
| Playmaker (role) | +10% buildup success | +1 attack per match | ② |
| Speedster (role) | counters +20% quality | unlock counter after any defensive win | ②/③ |
| Target Man (role) | headers +15% | corners +25% | ③/④ |
| Iberia (nationality-flavored) | +8% chance quality | +16% | ③ |
| Graft League (league-flavored) | +10% PHY duels | +20% | corners/duels |
| Club-mate Chemistry (link) | adjacent club-mates +6% duels | +12% | lane weights (placement-dependent!) |
| Rivalry (link) | both players +5% all stats when fielded together | — | global |

Chemistry being **pitch-adjacency-dependent** is deliberate: it makes *where* you place linked players a real decision (put linked fullback + winger on the same flank to activate the bonus) — the deepest soccer-native twist on the TFT formula.

---

## 9. Session-length math

- Standard: ~22 rounds × (45 s shop + 30 s tactics + 70 s match + 15 s results) ≈ **~19–21 min** for finalists; earlier elimination = shorter.
- Turbo: shop 25 s / tactics 20 s / match 45 s (5 phases, 6–10 attacks per side) ≈ **~11–13 min**.
- Eliminated players: spectate-or-leave with full rewards (TFT convention).

---

## 10. Anti-frustration & fairness rules

1. **Attribution visibility:** every goal's vignette ends with a one-line causal tag ("Left-lane overload +Playmaker 4"). If players can't see *why*, positioning stops feeling skill-based.
2. **Variance ceiling:** chance-quality ranges capped; no single event can swing >1 goal except penalties/red cards (which are rare and telegraphed).
3. **Comeback mechanics:** loss-streak income, reverse-order Scouting Combines, damage cap, win-heal.
4. **Disconnects:** match sims server-side regardless; an AFK manager's last saved tactics play on. No pause exploits.
5. **Draws are allowed** (it's soccer) but cost both sides Morale — low-block stonewalling is viable, not free.

---

## 11. Prototype checklist (Phase 0–1 of the strategy memo)

1. Python/spreadsheet sim of §6 chain: run 10k matches; tune until better-squad win rate ≈ 70–75%, draw rate ≈ 12–18%, avg goals/match ≈ 2.5–3.5, blowouts (3+) ≤ 15%.
2. Verify lane modifier is *felt*: a deliberate flank overload should shift chance origin share by ≥ 20% and be visible in the matchup report.
3. Verify trait breakpoints are *felt*: Playmaker 2→4 should measurably raise attacks/match in the sim stats.
4. Only then build the visual timeline/vignette layer — the numbers must be fun before the presentation is.
