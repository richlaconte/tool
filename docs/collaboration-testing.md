# Collaboration Testing Strategy

How we keep the websocket/multiplayer path verifiably correct: share links,
live multi-user sync, read-only enforcement, presence, and persistence —
locally before a push and in production after every deploy.

## What can break (and why it is subtle)

The collaboration path crosses five independently deployable boundaries:

1. **Share-link minting** — `POST /api/pages/:id/share-links` issues
   edit/view URLs with unguessable tokens (`src/server/shareLinkApi.ts`).
2. **Token exchange** — opening a share URL validates the token, 302s to a
   clean URL, and sets an HMAC-signed `tool.pageSession` cookie
   (`src/server/pageAccess.ts`, `src/server/shareSessions.ts`). Sessions are
   invalidated when the link is regenerated (`shareLinkUpdatedAt` mismatch).
3. **WebSocket authentication** — the `/collaboration` upgrade runs
   `onAuthenticate` against the cookie, the `page:<id>` document name, the
   Origin allowlist, and connection limits; view sessions become read-only
   connections (`src/server/collaborationServer.ts`).
4. **Realtime sync** — Hocuspocus + Yjs CRDT broadcast, plus client-side
   merge logic for pending local changes (`src/useCollaborativePage.ts`),
   and SQLite persistence via `@hocuspocus/extension-sqlite`.
5. **Security guardrails** — per-client message rate limits, per-page and
   per-client connection caps, payload limits
   (`src/server/collaborationSecurity.ts`).

Failures here rarely throw errors: clients stay "Connected" while updates
silently stop flowing (the July 2026 one-way-sync defect), or rate limits
disconnect normal editing. Mocks cannot catch these — only real clients
speaking the real protocol against a real server can.

## The four layers

| Layer | Where | Cost | Runs |
|---|---|---|---|
| Unit | `src/**/*.test.ts` (`node --test`) | ms | `pnpm test`, CI `verify` |
| WebSocket integration | `src/server/collaborationSync.test.ts` | seconds | `pnpm test`, CI `verify` |
| Browser E2E | `e2e/collaboration.spec.ts`, `e2e/share-links.spec.ts` | minutes | `pnpm test:e2e`, CI `e2e` |
| Production smoke | `scripts/collaboration-smoke.ts` | ~10 s | `pnpm test:smoke`, `pnpm test:smoke:local`, CI `smoke` after every deploy |

### Layer 1 — Unit tests

Pure-function coverage of the pieces: session signing/verification, access
resolution, header/origin checks, document-name parsing, the Yjs document
schema round-trip, client merge logic (`mergeRemoteStateWithPendingLocalAreaChanges`),
and the security state machine. These catch logic regressions but say
nothing about the wire.

### Layer 2 — WebSocket integration tests

`src/server/collaborationSync.test.ts` boots the **real**
`createCollaborationServer` on an ephemeral port with a real (temp-file)
SQLite extension and connects **real `HocuspocusProvider` clients** over
real websockets, using the shared probe client in
`src/server/collaborationProbe.ts`. Covered:

- Bidirectional sync between two edit sessions.
- View sessions receive updates but their writes are dropped server-side.
- Missing/wrong-page sessions are rejected at authentication.
- Documents are isolated per page.
- State is persisted to SQLite and survives full client disconnect.
- Awareness/presence propagates.
- The Origin allowlist is enforced on the handshake.

These run inside `pnpm test` (no browser, no build) and complete in a few
seconds. They are the primary regression net for protocol-level breakage.

### Layer 3 — Browser E2E

Playwright drives two real browser contexts against the **production
build** (never the dev server). Covered:

- Two browsers collaborate live; a fresh third browser sees the durable
  result (existing).
- Regression: the client that created an Area still receives remote edits
  (the historical one-way-sync defect).
- View links show content with no edit affordances (existing).
- Presence indicator shows remote collaborators and clears when they leave.
- Simultaneous edits to the same Area converge to identical text on both
  clients.
- A client that goes offline and reconnects catches up on missed edits.
- A view-link client receives live updates.

E2E validates the full UI stack (React state <-> Yjs <-> DOM) that the
integration layer cannot see. Rate limits are raised in the E2E environment
so golden paths test sync correctness; rate-limit behavior itself is unit
tested.

### Layer 4 — Production smoke test

`scripts/collaboration-smoke.ts` is an environment-agnostic Node script
that replays the entire user journey over HTTP + websocket against **any
base URL**:

1. `/api/health` (with a 90 s retry window to absorb deploy warm-up).
2. `GET /` creates a page and returns an edit share URL.
3. The edit token exchanges for a session cookie (twice — two
   collaborators).
4. The edit session mints a view link via the share API; the view token
   exchanges for a read-only session.
5. Two edit sessions sync in both directions (A's write reaches B on join;
   B's edit converges back to A).
6. Presence propagates between collaborators.
7. The view session receives state, and a "malicious viewer" write attempt
   is dropped by the server (verified by an independent auditor client).
8. Anonymous websocket connections are rejected.
9. With every client disconnected, a late joiner still receives the
   persisted document.

Usage:

```bash
# Against a dev server you already have running:
pnpm test:smoke
SMOKE_BASE_URL=http://localhost:3000 pnpm test:smoke

# Against a local production build (boots its own isolated server;
# requires `pnpm build` first):
pnpm test:smoke:local

# Against production:
SMOKE_BASE_URL=https://richlaconte-tool.fly.dev pnpm test:smoke
```

The CI `smoke` job in `.github/workflows/deploy.yml` runs this against the
production URL **after every deploy** and fails the workflow loudly if
anything regressed. Note: the smoke run creates one small page per run in
the production database (anonymous pages cannot be deleted through the
API); its content is tagged with a `smoke <timestamp>` marker.

## Practices this strategy follows

- **Test the protocol, not mocks.** Every layer above unit uses real
  Hocuspocus providers against a real server. The defects that actually
  hurt (silent sync loss, handshake rejection, read-only bypass) only
  manifest on the wire.
- **Test the artifact you ship.** E2E and the local smoke runner both use
  the production build, because bundling itself has broken collaboration
  before (dual-Yjs instance in the production bundle).
- **Verify after deploy, not just before.** The post-deploy smoke job
  catches environment-only failures: wrong `TOOL_ALLOWED_ORIGINS`, session
  secret rotation invalidating links, volume/persistence misconfiguration,
  proxy websocket termination.
- **Deterministic waits.** All sync assertions poll with explicit timeouts
  (`waitForProbeCondition`, Playwright `toPass`) instead of fixed sleeps.
- **Isolated state per run.** Integration tests use in-memory page
  databases and temp SQLite files; E2E and local smoke wipe their data
  directories before the server boots.
- **Clean teardown.** Probe clients force-terminate their sockets and the
  collaboration server exposes `closeConnections()`; lingering websocket
  ping intervals and internal HTTP servers otherwise keep test processes
  alive.

## Known historical failure modes and where they are covered

| Failure | Covered by |
|---|---|
| One-way sync loss after post-connect Area creation | E2E regression test + integration bidirectional sync |
| Echo storm / rate-limit disconnects during normal editing | Unit tests of `collaborationSecurity`; E2E golden paths run under a raised limit |
| View-link client able to write | Integration read-only test + smoke "malicious viewer" check |
| Share-token regeneration invalidating sessions | Unit tests of `pageAccess`/`shareSessions` |
| Origin misconfiguration breaking prod websockets | Smoke test (prod allowlist) + integration allowlist test |
| Persistence loss (content gone after restart) | Integration SQLite assertion + smoke late-joiner check |
| Dual Yjs instances in the production bundle | E2E + smoke run only against production builds |

## Extending the suite

- New sync behavior: add an integration test in
  `collaborationSync.test.ts` first (fast, protocol-level), then a
  Playwright spec if UI behavior is involved.
- New auth/access rule: unit test the resolver, then add a rejection case
  to the integration suite and (if user-visible) to the smoke script.
- Anything the smoke script checks runs in production — keep it fast,
  read-mostly, and free of secrets.
