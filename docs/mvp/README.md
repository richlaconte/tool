# Tactics FC — MVP Documentation Kit (for AI-Driven Development)

**Purpose:** This kit is the complete input an AI coding agent (Claude Code, Cursor, Copilot, etc.) needs to build the Tactics FC playable prototype. It follows **spec-driven development (SDD)** — the pattern validated by GitHub Spec Kit, Anthropic's Claude Code guidance, and Martin Fowler's SDD tooling survey: specs are the source of truth, code is a consequence of the specs, and no phase starts before the previous one is human-approved.

## Kit contents (read in order)

| File | SDD phase | Contents | Status |
|---|---|---|---|
| `00-constitution.md` | Constitution | Immutable project principles. Never violated, never amended casually. | LOCKED |
| `01-product-spec.md` | Specify | What we're building and why: user stories, scope (MoSCoW), screens, acceptance criteria. No tech decisions. | LOCKED |
| `02-technical-plan.md` | Plan | Stack, architecture, project structure, commands, testing, deployment. | LOCKED |
| `03-game-design-spec.md` | Plan (domain) | The actual game rules: economy, draft, synergies, positioning, match engine, AI opponents. | LOCKED |
| `04-data-contracts.md` | Contracts | TypeScript types that are the exact API between sim engine, state, and UI. **Code that deviates from these contracts is drift — fix the code, not the contract.** | LOCKED |
| `05-task-breakdown.md` | Tasks | Ordered, atomic, independently verifiable tasks. | Working doc |

Background research (not needed by the coding agent, for founders only): `../soccer-auto-battler-research-plan.md`, `../game-loop-design.md`, `../strategy-decision-memo.md`, `../platform-audience-strategy.md`.

---

## How to run the build with an AI agent

These rules come from SDD best practice and are not optional — they are what prevents "house of cards code."

1. **One task per session.** Start each task in a *fresh* agent session. Paste or reference only: the constitution, the relevant contract sections, and the single task from `05-task-breakdown.md`. Accumulated chat context from previous tasks introduces wrong assumptions.
2. **Human gate after each phase.** You (the founders) review and approve the output of each task before starting the next. The agent cannot approve its own work. A task is done only when its acceptance criteria verifiably pass.
3. **Commit after every task.** Not at the end of the day — after each task. Clean history is your rollback mechanism when drift is discovered.
4. **Contracts are law.** If the agent writes code that violates `04-data-contracts.md`, the code is wrong, full stop. If a contract genuinely needs to change, amend the contract file first, then the code.
5. **Sim tests are the drift detector.** The match engine is pure and deterministic, so every game rule is unit-testable. If a test breaks, either the code drifted or the spec changed — find out which before proceeding.
6. **No scope additions mid-build.** Every "wouldn't it be cool if…" goes into `05-task-breakdown.md` §Post-MVP, not into the current task.

## Kickoff prompt template (for the coding agent)

```
You are building the Tactics FC prototype. Read these files in this order and treat them as binding:
1. docs/mvp/00-constitution.md  (immutable principles)
2. docs/mvp/04-data-contracts.md (locked type contracts)
3. docs/mvp/02-technical-plan.md (stack, structure, commands)
4. docs/mvp/03-game-design-spec.md (game rules — reference)

Your current assignment is TASK <N> from docs/mvp/05-task-breakdown.md — do ONLY that task.
When finished: run the verification commands for that task, show me the results, and list
the acceptance criteria with pass/fail evidence. Do not start the next task.
```

## Definition of done for the whole MVP

- [ ] All tasks in `05-task-breakdown.md` marked done with passing acceptance criteria
- [ ] `pnpm test` green (sim determinism + rules coverage)
- [ ] `pnpm build` green and the build deploys to a public URL with no server
- [ ] A first-time user can reach a match within 60 seconds of opening the URL
- [ ] A full session (lobby of 8, ~7 rounds) completes without errors
- [ ] 3 founders'-friends playtest: at least 2 voluntarily start a second run
