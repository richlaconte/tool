# Live Collaboration Convergence: Multiplayer Sync Reliability Repair

## Status

Completed on 2026-07-06. The MVP repair restores live convergence for the
known post-connect Area creation defect, removes the duplicate-Yjs
production boot warning, and coalesces local state writes so normal
dragging stays below the default collaboration message-rate limit.

Future work: broaden the browser matrix for live style, link, comment, and
metadata editing scenarios beyond the current patch-level coverage.

## Goal

Restore Cascadery's multiplayer contract: every editable user in the same
page room sees the same Area, link, comment, style, and page-setting changes
live, without needing a refresh or a third fresh reader to prove the server
state changed. Collaboration is a foundational promise, not a polish layer;
if it is unreliable, share links, comments, agent work, task boards, and
page history all become suspect.

## Investigation Evidence

- `e2e/collaboration.spec.ts` now runs an active regression named "remote
  edits converge back to the client that created the Area". The original
  skipped test described the known defect: after client A creates an Area
  post-connect, client B can move it and a fresh reader sees the moved
  position, but A never receives the live update.
- `ideas.md` documents the same failure as "One-way live sync loss after
  post-connect Area creation" and records an echo storm of roughly 800
  small websocket messages in the first ~1.5 seconds after Area creation.
- Fresh manual reproduction on 2026-07-06 using the production e2e server:
  A created an Area after `Connected`, B joined through an edit share link,
  B dragged the Area, and a fresh reader matched B's moved position. A's
  original browser stayed at `x: 600, y: 300` while B and the fresh reader
  saw the moved state.
- The production e2e server emits `Yjs was already imported. This breaks
  constructor checks and will lead to issues!` at boot. That warning may be
  benign in some contexts, but in a Yjs/Hocuspocus app it is a serious
  suspect because constructor identity checks affect shared types and
  update handling.
- The client sync path in `src/useCollaborativePage.ts` currently bridges
  React page state to Yjs by diffing whole `PageAppState` snapshots in an
  effect. The same file then reads Yjs updates back into React state. The
  loop is guarded by origin checks, `applyingRemoteState`, and a
  pending-local-change TTL, but the observed echo storm suggests the bridge
  can still re-emit or churn updates after local creation.
- `src/server/collaborationSecurity.ts` defaults to 240 collaboration
  messages/minute. `ideas.md` records ~3 websocket messages per keystroke
  and ~4 per drag pointermove, meaning ordinary dragging can hit the limit
  unless client updates are coalesced.

## Working Hypothesis

The failure is most likely not a simple share-link or room-id problem:
clients join the same page, B sees A's initial Area, and a fresh reader sees
B's durable move. The likely fault is in the local React-state-to-Yjs bridge
and/or duplicate Yjs module instances:

- Post-connect Area creation causes local state to patch into the Yjs doc.
- The resulting doc updates are read back into React and can trigger
  another local-state patch loop.
- After the echo storm, the original client remains connected but stops
  applying remote updates from the server.
- Separately, uncoalesced local updates can overwhelm the server-side
  message limiter during normal editing and dragging.

The implementation must prove or disprove this with instrumentation before
settling on the final patch.

## Scope

### Make the failure visible and permanent

- Keep the historical original-client convergence scenario active in
  `e2e/collaboration.spec.ts` so CI fails if the bug returns.
- Add the complementary live scenarios:
  - A creates after connect, B edits, A updates live.
  - B creates after join, A updates live and a fresh reader sees it.
  - A edits after B joins, B updates live.
  - Text, geometry, styles, links, comments, and Area metadata all converge.
- Add lightweight websocket diagnostics for e2e only: per-client sent and
  received update counts, close events, and collaboration security rejects.
  The diagnostics should print on failure only.

### Repair the sync architecture

- Audit `src/useCollaborativePage.ts` and `src/collaborativePage.ts` so
  remote Yjs updates are applied exactly once to React state and do not
  re-enter the local patch path as fresh local edits.
- Prefer authoritative Yjs transactions for local edits where feasible,
  especially for high-frequency geometry and text operations. React state
  should render the collaborative doc; it should not continuously mirror a
  full-page snapshot back into Yjs after every render.
- If a full architecture split is too large for one repair, introduce a
  small, explicit local-write queue with stable transaction ids so the
  client can ignore its own echoed updates without ignoring other clients.
- Resolve the duplicate-Yjs warning in the production bundle. The fix may
  be dependency dedupe, package-manager override, Next server bundling
  externalization, or a Hocuspocus/Yjs import boundary, but acceptance
  requires the warning to disappear from the e2e server boot.
- Keep IndexedDB offline cache support, but ensure cache hydration cannot
  overwrite a newer server room or keep a stale client from applying live
  updates after provider sync.

### Coalesce collaboration traffic

- Batch local Yjs writes to at most one collaboration update per animation
  frame for high-frequency movement/resizing.
- Throttle awareness/presence updates during pointer movement so cursor
  presence remains useful without competing with document updates.
- Keep server rate limiting, but tune defaults around measured post-fix
  traffic rather than current noisy traffic. The rate limit should catch
  abuse, not normal editing.

### Observability and safety

- Add debug counters that can be enabled in development or e2e without
  leaking document content: update counts, dropped/rejected messages,
  reconnects, and sync-state transitions.
- Preserve view-only enforcement: view sessions may receive live updates but
  must not publish document mutations.
- Preserve undo semantics: local undo remains per-client and does not undo
  remote collaborators' work.

## Non-Goals

- Replacing Hocuspocus/Yjs with a custom collaboration protocol.
- Adding account-level permissions or auth flows.
- Redesigning collaboration presence UI.
- Solving offline conflict UX beyond preventing cache hydration from
  breaking live convergence.
- Building a cross-page collaboration dashboard.

## Acceptance Criteria

- The previously skipped live-convergence e2e scenario is active and passes
  reliably on the production e2e server.
- Two already-open edit clients see each other's new Areas, text edits,
  drags, resizes, style changes, link changes, comment changes, and metadata
  changes within a short live window without refresh.
- A fresh third reader still sees the same final state as both live clients.
- The production e2e server no longer logs the duplicate-Yjs constructor
  warning at boot.
- Normal text entry and a one-second Area drag stay below the default
  collaboration message-rate limit after client coalescing.
- View-only clients receive live updates but cannot mutate the page.
- Offline cache hydration does not overwrite or fork a non-empty server doc.
- `pnpm test`, `pnpm lint`, `pnpm build`, and the focused collaboration e2e
  suite pass.

## Testing

- `e2e/collaboration.spec.ts`: unskip the original-client convergence test;
  add reverse-direction, new-Area, text, style, link, comment, metadata, and
  view-only receive-only cases.
- `src/useCollaborativePage.test.ts`: add pure tests for local echo
  suppression, pending local transaction ids, cache/server precedence, and
  update coalescing behavior.
- `src/collaborativePage.test.ts`: verify Yjs transactions apply minimal
  patches without deleting unrelated remote changes.
- `src/server/collaborationSecurity.test.ts`: keep rate-limit tests, and
  add a measured post-fix traffic budget fixture so default limits reflect
  normal editing.
- `src/nextServerShape.test.ts` or a focused server test: assert the
  production server starts without duplicate Yjs imports when feasible.

## Implementation Notes

- Start with instrumentation before changing behavior. The first useful
  output is a failed e2e run that shows which client sent/received which
  update counts and whether the websocket closed or stayed open.
- The safest likely repair is to reduce the "two masters" shape. Today,
  React state and the Yjs document both act like authorities. The target
  should be one authority for collaborative pages: local UI actions write
  transactions to Yjs, Yjs updates feed React rendering, and React render
  effects do not blindly write the whole page back into Yjs.
- Keep the current snapshot patch helpers as migration tools and for tests,
  but high-frequency user actions should not depend on full-page snapshot
  reconciliation.

## Open Questions

- Is the duplicate-Yjs warning a root cause or just an amplifier? The spec
  requires eliminating it either way because it undermines confidence in
  shared-type checks.
- Should e2e run against both dev and production servers for collaboration?
  Recommend: production remains required; dev can be a smoke check only.
- Should collaboration rate limits count awareness and document updates
  separately? Recommend: yes if coalescing still leaves normal presence
  close to the write limit.
