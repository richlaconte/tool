# 00 — Constitution (Immutable Principles)

These principles govern every task, every file, every AI session. If code conflicts with this document, the code is wrong.

## Product principles

1. **Fun is the only metric that matters.** This prototype exists to answer one question: *is the watch-build-watch loop fun?* Every scope decision resolves toward proving or disproving that fastest. No features that don't serve the loop.
2. **Fictional players only, and no soundalikes.** No real player names, no "M. Essi"-style disguised names, no real club names, no real likenesses. Players are invented but *legible* (a Brazilian flair winger reads as a Brazilian flair winger through archetype, nationality flag, and stats). This is an IP/legal constraint, not a style choice. See `../player-name-likeness-legal-research.md`.
3. **The data layer is swappable.** Player names, portraits, nationalities, and trait text are pure data, imported from a single data module. Swapping in licensed real players later must be a data import, not a code change. Never hardcode player identity into game logic.
4. **Mobile-first UX, desktop-first build.** The prototype runs in a desktop browser (Steam-festival-era demo), but every screen must be responsive down to 390px width, touch-friendly, and readable in portrait. Match viewing must offer a Turbo mode that compresses a match to ~15 seconds.

## Technical principles

5. **The simulation engine is pure, deterministic, and UI-free.** The match engine and game-state reducer live in a framework-free TypeScript module (`src/sim/`). No DOM, no React, no `Date.now()`, no `Math.random()` — all randomness flows through a seeded RNG passed in. Same seed + same inputs = identical output, every time. This is what makes the game testable, replayable, and multiplayer-ready later.
6. **No backend. No auth. No accounts.** All state lives in the browser (in-memory + `sessionStorage`/`localStorage`). The deployed artifact is a static site. The only network capability is optional URL-based friend challenges (state encoded in the URL itself).
7. **Types are contracts.** `04-data-contracts.md` defines the exact shapes. The sim, the store, and the UI all import from one `src/types/` module. Drift = bug.
8. **Thin UI, fat sim.** All game rules live in the sim layer. React components render state and dispatch intents; they contain zero game logic. If a rule can be tested without a browser, it must be.

## Process principles

9. **One task per AI session, fresh context, commit after each task.**
10. **Tests before merge.** `pnpm test` and `pnpm build` must pass after every task. The agent reports pass/fail with evidence; the human gate approves.
11. **No new dependencies without asking.** The stack in `02-technical-plan.md` is complete. Adding a package requires founder approval (write it in the task file).
12. **Specs change by amendment, not by coding around them.** If reality disagrees with a spec, stop, amend the spec, then continue.
