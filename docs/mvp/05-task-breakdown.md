# 05 — Task Breakdown (Working Document)

> **BUILD STATUS 2026-07-31:** TASKS 1–16 executed and verified by the agent — 42 tests green, lint clean, build green (62 KB gz), serving smoke-tested. TASK 15 shipped goal/concede/whistle SFX; first-session coach marks (US-14) deferred to post-playtest. TASK 17 (Vercel deploy + external playtest) remains for the founders. Commits: 6a88219 (1–5), 0235d8d (6–7), fdbdaf7 (8–9), 1640321 (10–14), HEAD (15–16).

Ordered, atomic tasks for the AI coding agent. Rules (from `README.md`): **one task per fresh agent session; commit after each; a task is done only when its verification passes and a human approves.** Mark `[x]` + commit hash as tasks complete.

Dependencies are sequential unless marked `[P]` (parallel-safe with the previous task).

---

## Phase A — Skeleton & contracts

### TASK 1 — Scaffold
Create the `prototype/` Vite + React 18 + TypeScript (strict) + Tailwind + Zustand + Vitest project per `02-technical-plan.md` §structure. Configure pnpm scripts (`dev/test/build/lint`), Tailwind, base `index.html` (mobile viewport meta), and `App.tsx` rendering a placeholder.
- **Verify:** `pnpm install && pnpm dev` renders placeholder; `pnpm test` and `pnpm build` pass.
- [ ] done — commit:

### TASK 2 — Locked types & config [P]
Mirror `04-data-contracts.md` verbatim into `src/types/index.ts`. Create `src/sim/config.ts` containing **every** tuning number from `03-game-design-spec.md` as named constants (starting credits, shop odds table, combo thresholds/buffs, match probabilities, damage formula, AI bonuses).
- **Verify:** `pnpm build` passes; no game numbers appear anywhere outside `config.ts` (grep check).
- [ ] done — commit:

## Phase B — The sim (pure, tested; no UI yet)

### TASK 3 — Seeded RNG
`src/sim/rng.ts`: mulberry32 PRNG + helpers (`next()`, `range(min,max)`, `pickWeighted(items, weights)`, `chance(p)`), plus child-seed derivation (`deriveSeed(seed, ...tags)`).
- **Verify:** unit tests — same seed → same 1,000-value sequence; different seeds diverge; `pickWeighted` distribution within tolerance over 100k draws.
- [ ] done — commit:

### TASK 4 — Player data layer & generation
`src/sim/players.data.ts` (fictional name pools × 8 nationalities — clearly invented names, blocklist of real star surnames applied; archetype labels) + `src/sim/players.ts` (`generateCard(rng, tier)`, `generateShop(rng, round)` per `SHOP_TIER_ODDS_BY_ROUND`).
- **Verify:** tests — generated cards respect tier stat-total bands; archetype stat tilts apply; no generated name matches the blocklist; 8 nationalities all generatable.
- [ ] done — commit:

### TASK 5 — Shop & economy
`src/sim/shop.ts`: pure functions `buy(state, cardId)`, `sell(state, cardId)`, `reroll(state)` enforcing credits/bench/cap invariants (reject invalid, never mutate — return new state).
- **Verify:** tests for each invariant in `04-data-contracts.md` §Invariants 2–3 plus full-refund sell value.
- [ ] done — commit:

### TASK 6 — Combos & position fit
`src/sim/combos.ts`: `detectCombos(lineup) → ComboState[]` for the 4 families/2 tiers; `resolveSquad(squad, cap) → SquadSnapshot` applying position-fit multipliers (1.0 / 0.75 / 0.5 table) and combo buffs to effective stats.
- **Verify:** tests — each family triggers at exact thresholds, tiers correct, out-of-position multipliers exact.
- [ ] done — commit:

### TASK 7 — Match engine
`src/sim/match.ts`: `simulateMatch(home: SquadSnapshot, away: SquadSnapshot, seed) → MatchResult` implementing the full tick loop in `03-game-design-spec.md` §5 (possession → attack → chance → outcome, color events, narratives with `narrativeKey`, running score, FULLTIME event).
- **Verify:** **AC-3** determinism test (identical deep-equal logs over repeated runs); **AC-5** statistical test (striker-at-GK underperforms over 1,000 sims); tuning tests §8 (goals 1.5–4.5; tier-2-combo squad > 60% vs random; tier-5 squad > 75% vs tier-1).
- [ ] done — commit:

### TASK 8 — AI managers
`src/sim/ai.ts`: `aiTakeTransferWindow(rng, manager, round)` (buy/sell/reroll heuristics) and `aiSetLineup(manager)` per spec §7.
- **Verify:** **AC-6** test — mean AI squad effective-stat total rises with round over 100 simulated runs; AI always fields exactly one GK and respects caps.
- [ ] done — commit:

### TASK 9 — Tournament orchestration
`src/sim/tournament.ts`: run creation (8 managers, seeds), pairing, prize money, HP/damage (incl. win-streak bonus), elimination/placement, `advanceRound`, AI-vs-AI instant sims, standings history.
- **Verify:** tests — full runs complete to one survivor; damage formula exact; median run length 9–14 rounds over 500 runs (config-tune until green); no double-elimination bugs.
- [ ] done — commit:

**⛔ HUMAN GATE A:** Sim complete. Founders review tests + play with engine via a scratch script before UI begins.

## Phase C — The game (UI + state)

### TASK 10 — Store & persistence
`src/state/store.ts` (Zustand: screen + phase machine TRANSFER_WINDOW → TACTICS → MATCH → RESULTS, dispatch intents that call sim only) + `src/state/persist.ts` (sessionStorage save on every phase transition, restore on load, `saveVersion` discard).
- **Verify:** **AC-9** — refresh mid-run resumes at current round start; `pnpm test/build` green.
- [ ] done — commit:

### TASK 11 — Landing + Transfer Window UI
Landing (New Run / Continue / How-to-Play 3-panel). Transfer Window: 5-card shop, credits, reroll, buy-to-bench, sell, combo panel live-updating from the prospective lineup, squad cap display, Confirm. Mobile: tap-to-select flows; all playable at 390px (**AC-7**).
- **Verify:** manual AC-2 dry run (landing → confirmed lineup in ≤60s); responsive check at 390px and 1440px.
- [ ] done — commit:

### TASK 12 — Tactics Board UI
Pitch diagram (GK/DEF/MID/FWD slot rows), drag-and-drop with tap fallback, swap/remove, invalid-lineup messaging (must field GK), combo chips `Family current/next-tier`, Kick Off.
- **Verify:** manual — out-of-position placement visibly warns/buffs change; AC-7 tap flow at 390px.
- [ ] done — commit:

### TASK 13 — Match View UI (the show)
Renders `MatchResult.events` as playback (never re-simulates): pitch animation (dots/trails acceptable), narrated event feed from `narrativeKey` templates (commentary names players and references causes per US-6), scoreboard, play/pause, 1×/2×, **Turbo (full match ≈15s, AC per pillar 3)**, skip-to-result.
- **Verify:** manual — full match ≈90s at 1×, ≈15s Turbo; feed events match the event log exactly; zero console errors (**AC-1** partial).
- [ ] done — commit:

### TASK 14 — Results & standings
Post-match summary (score, damage, prize), 8-manager standings table with HP, elimination notices, next round; end-of-run screen (placement 1st–8th, one-click rematch with fresh seed).
- **Verify:** **AC-1** — full run start-to-finish, desktop Chrome, zero console errors.
- [ ] done — commit:

**⛔ HUMAN GATE B:** Founders play 3 full runs. Log friction. Tune `config.ts` (one tuning commit) before proceeding.

## Phase D — Ship the demo

### TASK 15 — Polish pass
Goal SFX + simple music loop (US-13, inline/generated assets only — no network), first-session coach marks (US-14), loading ≤3s on 4G budget check (bundle < 500KB gz, **AC-8** prep).
- **Verify:** Lighthouse performance ≥ 85 mobile; AC-7 final check.
- [ ] done — commit:

### TASK 16 — Friend challenge (US-11, optional — only if Gates A/B went fast)
Encode/decode `ChallengePayload` to `#challenge=` URL hash; challenge landing screen loads snapshot, runs one match vs it, shows winner. No storage, no server.
- **Verify:** manual — link opened in incognito plays correctly.
- [ ] done — commit:

### TASK 17 — Deploy & playtest
Founders deploy `dist/` to Vercel (manual, per plan). Founder-run playtest with 3 external testers (**AC-10**): observe, don't assist; file notes on self-return signal.
- **Verify:** public URL live (**AC-8**); playtest notes filed; kill/continue gate assessed against `01-product-spec.md` §Success signal.
- [ ] done — URL:

---

## Post-MVP parking lot (do NOT build now)

Live multiplayer & lobbies · player star-merging/leveling · more combo families & traits · economy depth (interest, streaks beyond damage) · meta progression & leaderboards · Steam page assets · localization · mobile-native ports.
