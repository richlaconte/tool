# Ideas

The original idea backlog has been converted into specs.

- Active specs and recommended order: [docs/specs/README.md](docs/specs/README.md)
- Completed MVP specs: [docs/specs/completed](docs/specs/completed)
- Product direction audit: [docs/specs/2026-06-29-cascadery-product-direction-audit.md](docs/specs/2026-06-29-cascadery-product-direction-audit.md)

New raw ideas can go below this line before being turned into full specs.

---

## One-way live sync loss after post-connect Area creation (defect, found by E2E harness 2026-07-05)

Completed as a highest-priority reliability spec on 2026-07-06:
`docs/specs/completed/2026-07-06-live-collaboration-convergence.md`.

Deterministic repro (production server build): client A loads a fresh page,
waits for "Connected", creates an Area, types. Client B joins via the edit
link and drags that Area. B's move reaches the server (any fresh client
sees the new position), but A never does — A's websocket stays open and
"Connected" while the server goes silent toward it. Instrumentation shows
A exchanges an echo storm of ~800 messages in the first ~1.5 seconds after
creating the Area (~270-byte sync messages ping-ponging), then receives
nothing further. If A instead creates the Area *before* the connection
establishes, everything converges. Reproduces with and without share-link
regeneration. Suspects: the local-state→Yjs echo loop in
`src/useCollaborativePage.ts` (state patch → doc update → remote apply →
state patch…, bounded only by the 1.5s pending-change TTL) and the server
boot warning "Yjs was already imported. This breaks constructor checks"
(dual Yjs instances in the production bundle can break Hocuspocus document
bookkeeping). The E2E suite now runs the original-client convergence
scenario as an active regression test in `e2e/collaboration.spec.ts`.

## Collaboration message coalescing (defect, found by E2E harness 2026-07-05)

The websocket client emits ~3 messages per keystroke and ~4 per drag
pointermove (measured via `WebSocket.send` instrumentation), while the
collaboration security default allows 240 messages/minute
(`src/server/collaborationSecurity.ts`). One second of continuous dragging
(~265 messages) trips the limit and the server closes the connection with a
60-second retry — two collaborating users editing normally will be
disconnected. Fix belongs client-side: coalesce Yjs doc updates per
animation frame and throttle awareness updates during pointer drags
(`src/useCollaborativePage.ts`), then revisit whether 240/min is right.
The E2E config raises the limit for its isolated server so golden paths
keep testing sync correctness.

Completed by coalescing local React-state writes before publishing Yjs
patches; a one-second rapid drag smoke stayed connected under the default
server rate limit.
