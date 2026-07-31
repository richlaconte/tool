# 02 — Technical Plan

## Stack (fixed — constitution principle 11)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5.x (strict mode) | Contracts are the whole point |
| Framework | React 18 + Vite 5 | Fast static builds, agent-fluent |
| UI styling | Tailwind CSS 3 | Fast iteration, responsive by default |
| State | Zustand | Thin store over the sim reducer; no boilerplate |
| Sim engine | Pure TypeScript module (`src/sim/`), zero deps | Determinism, testability |
| RNG | `mulberry32`-style seeded PRNG, implemented in-repo (~15 lines) | No dependency, full determinism |
| Tests | Vitest | Same toolchain as Vite |
| Icons/flags | Emoji flags + inline SVG | Zero asset pipeline |
| Hosting | Static deploy — Vercel or Netlify free tier (founders pick; Vercel default) | Public URL, no server |
| Package manager | pnpm | Repo standard (AGENTS.md) |

No router library needed (5 screens — a state-driven screen switch is fine). No animation library; CSS transitions suffice for MVP dots-and-trails match view.

## Project location & structure

The prototype lives in this repo at `prototype/` (standalone pnpm package; not wired into the existing Next app in `server.ts`).

```
prototype/
  index.html
  package.json
  vite.config.ts
  tailwind.config.js
  src/
    types/          # LOCKED contracts — mirror of docs/mvp/04-data-contracts.md
      index.ts
    sim/            # PURE game logic. No React, no DOM, no Date.now/Math.random
      rng.ts        # seeded PRNG
      players.ts    # player generation & the swappable DATA LAYER
      shop.ts       # transfer window logic (roll, buy, sell, reroll)
      combos.ts     # combination detection & buffs
      match.ts      # match engine: squads in → event log + score out
      ai.ts         # AI manager squad-building heuristics
      tournament.ts # 8-manager lobby orchestration, pairing, HP, standings
    state/
      store.ts      # Zustand store: screen, phase, GameState, persistence
      persist.ts    # sessionStorage save/load (serialize GameState)
    ui/
      screens/      # Landing, Planning (merged shop+board, TFT-style), MatchView, Results
      components/   # Hud, PlayerCardView, PitchView, ComboPanel, EventFeed, StandingsTable
      App.tsx
    main.tsx
  tests/
    sim/            # Vitest: determinism, rules, AC-5/AC-6 statistical tests
```

## Architecture rules

1. **One-way data flow:** UI dispatches intents → store applies them by calling sim functions → store holds new `GameState` → UI re-renders. The store is the only mutable thing.
2. **All randomness enters through `GameState.seed`.** Each sim call derives a child seed (`seed + round + callIndex`) so a saved run resumes deterministically.
3. **Match playback is a renderer, not a runner.** `match.ts` computes the *entire* event log instantly. The Match View just plays back timed events with animation. Pause/turbo/scrub = changing playback speed, never re-simulating. This guarantees what-you-see-is-what-happened.
4. **Persistence = serialize `GameState`** (JSON, versioned with a `saveVersion` field) to `sessionStorage` on every phase transition; restore on load if present.
5. **Friend challenge (US-11, optional):** encode `{ squad, seed }` as base64url JSON in the URL hash (`#challenge=...`). Opening the link loads a one-off match screen vs that snapshot. No storage writes, no server.

## Commands (put these in the agent's context verbatim)

```bash
cd prototype
pnpm install        # once
pnpm dev            # local dev server
pnpm test           # Vitest — must pass after every task
pnpm build          # tsc + vite build → dist/ — must pass after every task
pnpm lint           # eslint, zero errors required
```

Node version per repo `.nvmrc`.

## Testing strategy

- **Determinism test:** same seed/squads → deep-equal event logs (AC-3).
- **Rules tests:** shop reroll cost, buy/sell economy, squad cap, combo detection at each tier, HP damage formula, prize money.
- **Statistical tests** (run 1,000 sims, assert with generous margins — these validate *design*, not just code):
  - AC-5: out-of-position striker underperforms.
  - AC-6: AI squad strength grows by round.
  - Balance sanity: average goals/match between 1.5 and 4.5; the strongest synergy squad beats a random squad > 60% of the time.
- No UI tests for MVP (manual playtest covers it).

## Boundaries

- ✅ Always: run `pnpm test` and `pnpm build` before reporting a task done; keep sim pure; write everything in TypeScript strict.
- ⚠️ Ask first: adding any dependency; changing a locked contract; deviating from the file structure above.
- 🚫 Never: any network call at runtime (no fonts CDN, no analytics, no APIs); real player names anywhere including test fixtures; `Math.random()` or `Date.now()` inside `src/sim/`; editing files outside `prototype/`.

## Deployment

`pnpm build` → `dist/` → connect repo to Vercel (root dir `prototype`, build command `pnpm build`, output `dist`). Founders do this manually; the agent only needs to keep the build green.
