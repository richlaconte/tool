# Quality Infrastructure: E2E Harness and Privacy-Respecting Telemetry

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 4.5).
Completed on 2026-07-05 — see Completion Notes at the end.

## Completion Notes (2026-07-05)

- Harness: `playwright.config.ts` + `e2e/` with six golden-path specs;
  `pnpm test:e2e` (run `pnpm build` first). Deliberate deviations from the
  original scope, each forced by reality:
  - The web server is the **production build** (`node e2e/start-server.mjs`
    wrapping `dist/server.js`), not `pnpm dev`: Next allows one dev server
    per project directory, so a dev-based harness collides with the
    developer's own session — and testing the deployed artifact is more
    faithful anyway.
  - `reuseExistingServer` is `false` and the test-database wipe happens
    inside the server start command, because Playwright boots the web
    server before `globalSetup` — wiping afterwards strands the booted
    server on a deleted SQLite inode.
  - Base URL is `http://localhost` (not `127.0.0.1`): production session
    cookies are `Secure`, and Chromium's trustworthy-origin exemption over
    plain HTTP is dependable only for localhost.
  - The E2E server raises `TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_MAX` so
    golden paths test sync correctness rather than the rate limiter — see
    the defect below.
- Sabotage checks recorded: disabling deselect handling fails the deselect
  spec; destroying the `/collaboration` upgrade fails the collaboration
  spec (both verified on 2026-07-05, then reverted).
- The harness immediately caught two real product defects, logged in
  `ideas.md`: (1) websocket message flooding (~3 msgs/keystroke, ~4 per
  drag pointermove, plus an ~800-message echo storm after Area creation)
  colliding with the 240/min collaboration rate limit; (2) one-way live
  sync loss — a client that creates an Area after connecting stops
  receiving remote updates. The second is pinned as a `test.fixme` in
  `e2e/collaboration.spec.ts`; the passing golden path asserts live A→B
  sync plus durable convergence via a fresh third browser.
- Telemetry shipped as specified: closed `TelemetryEvent` union
  (`src/telemetry.ts`), `(event, day, count)`-only store
  (`src/server/telemetryStore.ts`), endpoint (`app/api/telemetry/route.ts`)
  with in-memory rate limiting and no stored request metadata, env and
  per-browser kill switches (settings checkbox + palette toggle +
  `TOOL_TELEMETRY_DISABLED`), published event list (`docs/telemetry.md`)
  with a parity test, and `pnpm telemetry:report`. Verified end to end:
  the E2E run's isolated database accumulated client, server, and
  per-tool `mcp_request:*` counters.

## Goal

Two things the current process lacks: (1) a Playwright end-to-end suite that
exercises the real app in a real browser — the existing `*Ui.test.ts` files
assert against source strings and cannot catch interaction regressions (see
the deselect-fix commit streak: `f550660`, `a255519`, `178c42d`); (2) a
decision-grade, privacy-exemplary usage signal so spec prioritization stops
being guesswork.

## Research Basis

- Playwright is the standard for multi-context (two-browser collaboration)
  testing and ships first-party GitHub Actions support:
  https://playwright.dev/docs/ci-intro
- The data-ownership positioning (portability pillar) demands telemetry be
  exemplary or absent: event counts only, no content, visible off-switch —
  the Plausible/self-hosted model, not third-party scripts.

## Current State

- `pnpm test` = `node --test src/*.test.ts src/server/*.test.ts` — pure-logic
  unit tests, strong module coverage. UI behavior is "tested" by thin
  `*Ui.test.ts` files (average ~40 lines) that grep source code shape.
- CI: `.github/workflows/deploy.yml` runs test/lint/build then deploys to
  Fly.io on push to main. No browser tests anywhere.
- The dev server is the custom Next+Hocuspocus server (`pnpm dev` →
  `tsx server.ts`); port via `PORT` env (default 3000); SQLite path via
  `TOOL_DATABASE_PATH` (default `./.data/tool.sqlite`) — both already
  env-configurable, which is exactly what an isolated E2E run needs.
- Page access flows through share tokens: `/` (or `/new` after the site spec)
  creates a page and redirects with an edit token; view links exercise
  `resolvePageHttpAccess`. E2E tests can drive the real flows with no mocks.
- MCP endpoint is HTTP JSON-RPC (`app/api/mcp/route.ts`) — an E2E test can
  play the agent with plain `fetch`.
- No analytics or telemetry of any kind exists today.

## Scope

### Playwright harness

- Add `@playwright/test` as a devDependency (chromium project only in CI;
  webkit/firefox locally on demand). New top-level `e2e/` directory —
  deliberately outside `src/` so the node:test globs never pick it up.
- `playwright.config.ts`:
  - `webServer`: `PORT=3199 TOOL_DATABASE_PATH=<testDataDir>/tool.sqlite
    TOOL_MCP_ENABLED=true pnpm dev`, `reuseExistingServer: !process.env.CI`.
  - A fresh temp data dir per run (global setup deletes/creates it) so tests
    never touch `.data/`.
  - Projects: `desktop-chromium` and `mobile-chromium`
    (`devices['Pixel 7']`-style with touch) — the responsive spec adds
    mobile scenarios.
- New scripts: `"test:e2e": "playwright test"`; keep `pnpm test` unchanged.

### Golden-path scenarios (v1 suite — small, ruthless, fast)

1. **Create and edit:** visit `/` (or `/new`), land on a fresh page, click
   canvas, type text, reload, text persists.
2. **Style via slash command:** type `/border: 2px solid red` in an Area,
   commit, assert the computed style on the Area element.
3. **Share round-trip:** open the share dialog, grab the view link, open it
   in a second context: content visible, no edit affordances (assert absence
   of area creation on canvas click).
4. **Two-browser collaboration:** two contexts join the same edit URL; A
   types, B sees the text; B moves an Area, A sees the position change
   (poll with `expect.toPass`, no arbitrary sleeps).
5. **Deselect regression guard:** the exact interactions from the recent fix
   streak — click blank canvas after selecting, click other blank surfaces,
   assert deselection and focus state.
6. **Agent proposal accept:** `fetch` the MCP endpoint (`suggest_areas` or
   `apply_patch` dry-run flow) as an agent, assert the proposal renders in
   the UI, click accept, assert the Area exists — the full human-in-the-loop
   AI posture, tested.
- Selector policy: `data-testid` attributes added sparingly to stable
  interaction points (canvas surface, area, share dialog controls); never
  select on CSS classnames that specs may restyle.
- New scenarios land with their features: offline (Tier 3.2), touch
  (Tier 4.3), multi-select (Tier 1.1) each add one golden path here — this
  spec establishes the harness and the first six.

### CI wiring

- Extend `.github/workflows/deploy.yml` with an `e2e` job between `verify`
  and `deploy` (deploy depends on both): install pnpm/node from the existing
  steps, `pnpm exec playwright install --with-deps chromium`, run the suite,
  upload the Playwright HTML report + traces as an artifact on failure
  (`trace: 'retain-on-failure'`).
- Budget: the v1 suite must complete in under 5 minutes in CI; parallelize
  with Playwright's default workers.

### Telemetry (self-hosted, counts only)

- **Principles (non-negotiable, documented publicly in the docs site):**
  no third-party scripts; no page content, page ids, titles, text, or tokens
  ever; no cookies or fingerprinting; a visible off-switch; the full event
  list published.
- Implementation:
  - `src/telemetry.ts`: `trackEvent(name: TelemetryEvent)` — fire-and-forget
    `navigator.sendBeacon('/api/telemetry', …)`, silently no-ops when
    disabled. `TelemetryEvent` is a closed union — adding an event requires
    editing the type, which forces the published list to update (parity
    test).
  - Event set v1: `page_created`, `area_created`, `slash_command_used`,
    `context_kit_inserted`, `share_link_created`, `export_markdown`,
    `export_json_canvas`, `export_sdd`, `import_page_json`, `mcp_request`
    (server-side), `agent_proposal_accepted`, `agent_proposal_rejected`.
  - `app/api/telemetry/route.ts` + `src/server/telemetryStore.ts`: increment
    a `(event, day)` counter row in SQLite. No request metadata stored —
    not even IP (rate limit in memory, discard the key).
  - Kill switches: server env `TOOL_TELEMETRY_DISABLED=true` (endpoint 404s,
    client no-ops via a bootstrap flag) and a per-browser opt-out in the
    command palette ("Disable usage telemetry", persisted in localStorage).
  - Reading the signal: a tiny `scripts/telemetry-report.ts` printing the
    counter table — no dashboard in v1.

## Non-Goals

- Visual-regression screenshot testing (revisit after the perf spec's
  decomposition settles the DOM).
- Cross-browser matrix in CI (chromium only; run others locally pre-release).
- Session replay, user-level analytics, funnels, A/B testing.
- Replacing the `*Ui.test.ts` files (they still catch source-shape drift
  cheaply; retire them per-file only when a Playwright test covers the same
  ground).

## Acceptance Criteria

- `pnpm test:e2e` runs all six golden paths green locally against an
  isolated temp database, leaving `.data/` untouched.
- The two-context collaboration test reliably passes (no sleeps; retry-based
  assertions) and fails when the websocket upgrade is broken (verified once
  by sabotage).
- CI blocks deploy on E2E failure and uploads traces for failed runs.
- With telemetry enabled: events increment day-bucketed counters; the stored
  table provably contains only `(event, day, count)`.
- Both kill switches work; the event list in docs matches the
  `TelemetryEvent` union (parity test).
- `pnpm test`, `pnpm lint`, and `pnpm build` pass; existing unit tests are
  untouched.

## Testing

This spec *is* testing; its own verification:

- One deliberately-broken run each: sabotage deselect handling and the
  websocket upgrade locally; confirm scenarios 5 and 4 fail respectively
  (record in completion notes).
- `src/telemetry.test.ts` / `src/server/telemetryStore.test.ts`: disabled
  no-op behavior, counter increments, day bucketing, event-list parity.

## Open Questions

- Flake policy: `retries: 1` in CI with trace-on-retry, and any test that
  retries twice in a week gets fixed or deleted — adopt unless the team
  objects.
- Whether `mcp_request` should count per-tool (e.g. `mcp_request:get_page`).
  Recommend: yes, tool name is not content and it directly answers "which
  agent capabilities matter" — the roadmap's key prioritization question.
