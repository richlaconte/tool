# Offline Resilience and Local-First Cache

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 3.2). Active.

## Goal

Keep editing safe when the connection drops: a client-side Yjs cache
(IndexedDB) per page, an explicit offline status in the existing status
surface, and automatic convergence on reconnect. Yjs makes this nearly free;
the portability pillar demands it.

## Research Basis

- y-indexeddb is the standard Yjs offline persistence provider; it loads the
  local doc before the network provider connects and merges updates on
  reconnect: https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb
- CRDT convergence is the point of the Yjs choice — offline edits merge
  without conflict-resolution UI.
- NN/g visibility of system status: saving locally vs synced must be
  distinguishable but calm:
  https://www.nngroup.com/articles/visibility-system-status/

## Current State

- Sync: `useCollaborativePageSync` (`src/useCollaborativePage.ts`) creates the
  Yjs doc (`createCollaborativePageDoc`, `src/collaborativePage.ts`) and a
  `@hocuspocus/provider` websocket connection to `/collaboration`
  (`server.ts` upgrade handler → `src/server/collaborationServer.ts`, backed
  by `@hocuspocus/extension-sqlite`).
- Status UI: App.tsx tracks a `CollaborationStatus` (from
  `src/collaboration.ts`) plus a separate `SaveStatus` shown in the status
  surface. The hydration fix history (commit `6bea047`) shows initial-state
  races are a known sensitivity — read `src/useCollaborativePage.test.ts` and
  `src/collaborativePage.test.ts` before touching the bootstrap order.
- Local persistence today is a plain JSON snapshot in localStorage
  (`PAGE_STORAGE_KEY = 'tool.page.v1'`, `src/pagePersistence.ts`) used for
  initial state — it is not a CRDT cache and cannot merge.
- Access control: share-token sessions (`src/server/pageAccess.ts`); view
  sessions get read-only websockets (`src/server/collaborationSecurity.ts`).

## Scope

### IndexedDB cache

- Add `y-indexeddb` as a dependency. In `useCollaborativePageSync`, create an
  `IndexeddbPersistence(cacheKey, doc)` alongside the Hocuspocus provider,
  keyed `cascadery-page-<pageId>`.
- Bootstrap order matters (this is where hydration bugs live — be deliberate
  and test):
  1. Create the doc empty.
  2. Wait for IndexedDB `synced` → local state is loaded.
  3. Only then apply the localStorage-JSON seeding path, and only if BOTH the
     IndexedDB doc AND the server doc are empty
     (`isCollaborativePageDocEmpty` exists for this). The JSON seed must
     never overwrite a non-empty CRDT cache.
  4. Connect the network provider; Yjs merges local and server histories.
- Feature-detect IndexedDB (private-mode failures) and degrade silently to
  today's behavior; wrap provider creation in try/catch and report
  availability to the status model.
- Destroy the persistence instance on page switch/unmount; never share cache
  keys across pages.

### Status model

- Extend the status surface with an explicit offline state: websocket down
  but IndexedDB active → "Offline — changes saved on this device" (calm, not
  an error toast); reconnecting → "Syncing…"; then the normal saved state.
  Extend the existing `CollaborationStatus`/`SaveStatus` types rather than
  adding a third parallel status — audit `src/collaboration.ts` and the
  status rendering in App.tsx first and keep one source of truth.
- If IndexedDB is unavailable AND the connection drops, show the stronger
  warning state (today's implicit behavior, made explicit).

### Reconnect behavior

- HocuspocusProvider already retries with backoff — verify and rely on it; do
  not hand-roll reconnection. On reconnect, assert awareness/presence
  re-broadcasts (profile + selection); extend `src/collaboration.ts` if
  awareness state is not automatically re-sent.
- Multi-tab: y-indexeddb + Yjs handle concurrent tabs on one origin; verify
  two tabs on the same page converge (two-doc merge unit test as proxy plus a
  manual verification note).

### View-only offline

- View sessions get the same read cache; a returning view-only visitor sees
  the last-synced state with offline status. Edit affordances remain absent
  (unchanged); no writes can be produced, so nothing needs blocking.

### Security note (document, don't build)

- The cache stores page content in the browser profile; revoking a share link
  cannot reach cached copies. Add this to the security baseline doc's threat
  notes and the share dialog help text. Cache-clearing UI is out of scope.

## Non-Goals

- Peer-to-peer sync, service workers, full PWA installability.
- Offline share-link validation or offline page creation.
- Encrypting the local cache.
- Conflict-resolution UI (CRDT merge is the resolution).

## Acceptance Criteria

- Kill the server mid-edit; keep typing; restart the server: offline-window
  edits reach other clients; nothing is lost (two-doc unit test simulating
  update exchange, plus a manual verification note recorded on completion).
- Reload the tab while the server is down: the page renders from the local
  cache with offline status; reconnect syncs it.
- Status transitions connected → offline → syncing → saved are visible, use
  the existing status surface, and never block interaction.
- Private mode (no IndexedDB) behaves exactly like today with no console
  errors.
- Legacy localStorage JSON seeding still works for brand-new pages and never
  clobbers a non-empty cache (regression test on bootstrap order).
- Two tabs editing the same page converge.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/collaborativePage.test.ts`: extend with offline-merge convergence
  (docA and docB diverge from a common state, exchange updates, assert equal
  `getPageStateFromCollaborativeDoc` output).
- `src/useCollaborativePage.test.ts`: bootstrap-order cases — empty
  everything, cache-only, server-only, both (cache wins over JSON seed).
- Status-model unit tests for the new transitions.
- True websocket-drop E2E belongs to the quality-infrastructure spec's
  Playwright suite; add the scenario there when both land.

## Open Questions

- Cache eviction: never evict (browser quota applies) vs an LRU cap.
  Recommend: keep the last 20 pages' caches, sweep on app load.
- Should offline change what SaveStatus 'saved' means? Define precisely in
  implementation: 'saved' should mean "durable somewhere", qualified by
  where ("saved locally" vs "saved").
