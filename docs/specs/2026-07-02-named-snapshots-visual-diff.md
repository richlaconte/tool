# Named Snapshots and Visual Diff

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 3.4). Active.

## Goal

Let teams mark durable, named page states ("pre-review", "v1 approved") on the
server, see what changed between two snapshots as a legible list diff, and
restore safely — restore-as-copy by default, destructive overwrite only behind
explicit confirmation. This completes the Visual RFC workflow's "snapshot at
decision time" requirement.

## Research Basis

- Product-DX spec, Visual RFC workflow: version history or snapshots for
  major decisions (docs/specs/2026-06-26-cascadery-product-dx.md).
- Completed version-history spec provides the local event log this builds on
  (docs/specs/completed/2026-06-29-version-history-and-change-review.md).
- Figma's named versions + restore-as-copy is the reference interaction
  pattern users already know.

## Current State

- History today is client-side: `src/pageHistory.ts` keeps an event log in
  localStorage (`tool.pageHistory.v1`) with restore patches for imports and
  agent actions — per-browser, not shared, not durable across devices.
- The authoritative page state lives server-side in the Hocuspocus SQLite
  store (`@hocuspocus/extension-sqlite` via
  `src/server/collaborationServer.ts`); `getStoredCollaborativePageState` in
  `src/server/collaborativeStorage.ts` already reads a page's current state
  server-side (the MCP route uses it).
- Serialization: `serializePageState` / `parsePageJson`
  (`src/pagePersistence.ts`) produce/consume `PageJsonSnapshot`
  (schemaVersion 1) — the natural snapshot payload format.
- Full-state replacement exists: `replaceCollaborativePageDocState`
  (`src/collaborativePage.ts`) — the overwrite-restore mechanism.
- Page creation server-side: `createPageWithShareLinks`
  (`src/server/pageRepository.ts`) — the restore-as-copy mechanism.
- Access: edit sessions via `pageAccess.ts`; ownership arrives with Tier 3.1
  (snapshot permissions should require edit access now, tightening to
  owner-configurable later).

## Scope

### Data model and API

- New table `page_snapshots` (migration in `src/server/database.ts`): `id`,
  `page_id`, `name` (≤ 80 chars), `created_by` (collaboration profile name
  now; user id once identity lands — store both nullable), `created_at`,
  `state_json` (full `PageJsonSnapshot` text). Cap: 50 snapshots per page;
  creating the 51st fails with a clear error telling the user to delete one
  (no silent pruning of named states).
- New server module `src/server/pageSnapshots.ts`: `createSnapshot` (reads
  current state via `getStoredCollaborativePageState`, serializes, inserts),
  `listSnapshots(pageId)` (metadata only), `getSnapshot(id)`,
  `deleteSnapshot(id)`.
- New route `app/api/pages/[pageId]/snapshots/route.ts` (+ `[snapshotId]`
  subroute), following the share-links route pattern
  (`app/api/pages/[pageId]/share-links/route.ts`): all operations require a
  valid *edit* session (reuse `getPageAccessFromSession`); restore/delete
  additionally require ownership when the page is owned (Tier 3.1).

### Diff engine

- New pure module `src/pageDiff.ts`:
  - `diffPageStates(before: PageAppState, after: PageAppState): PageDiff`
    where `PageDiff = { addedAreas, removedAreas, changedAreas, addedLinks,
    removedLinks, changedLinks, pageChanges }`.
  - A changed Area entry: `{ id, changedFields: Array<'text' | 'position' |
    'size' | 'styles' | 'metadata' | 'parent'>, before, after }` with a short
    text excerpt for each side (first line, ≤ 80 chars). Text diff is
    field-level (changed/not-changed + excerpts), not character-level, in v1.
  - Deterministic ordering (reading order by the *after* state; removed items
    by the *before* state).
- Diff works between: two snapshots, or a snapshot and the live state.

### UI

- Extend the existing history dialog (from the completed version-history
  spec) with a Snapshots section:
  - "Snapshot current state…" → name prompt → creates via API; list shows
    name, creator, age; per-row actions: Compare, Restore, Delete
    (confirmation).
  - Compare opens a diff panel: two pickers (defaulting to selected snapshot
    vs live), then grouped lists — Added / Removed / Changed — each row
    showing the Area excerpt and changed fields, clicking a row jumps to the
    Area when it exists in the live state (reuse `getZoomToArea` from the
    search spec).
  - Restore defaults to **Restore as copy**: calls a server endpoint that
    creates a new page seeded from the snapshot state (create page, then
    write the snapshot into its hosted doc server-side) and returns its edit
    URL, opened in a new tab. **Overwrite current page** is a secondary
    action requiring typing the page title; it applies
    `replaceCollaborativePageDocState` through the live doc in one
    transaction (one undo step, so even the destructive path is `Cmd+Z`
    recoverable in-session) and writes a pageHistory event.
- Command palette: "Snapshot current state…", "Compare snapshots…".
- View-only: can list and compare snapshots; cannot create, restore, delete.

## Non-Goals

- Automatic/scheduled snapshots (manual, intentional states only in v1).
- Character-level text diffs or spatial "ghost" overlay diffs (listed as the
  known follow-up; the list diff must be built to feed it).
- Branching/merging pages.
- Snapshot storage quotas beyond the 50-per-page cap.

## Acceptance Criteria

- An editor can create a named snapshot; it appears for all collaborators
  with correct metadata; the 51st snapshot is refused with a clear message.
- Comparing two snapshots (or snapshot vs live) lists added/removed/changed
  Areas and links correctly for: moved, resized, restyled, retyped
  (metadata), renested, and text-edited Areas — each represented in tests.
- Restore-as-copy produces a new page whose content equals the snapshot and
  leaves the original untouched; overwrite requires typed confirmation,
  applies as one undo step, and logs a history event.
- View sessions can browse and compare but get 403s on mutation endpoints.
- Snapshots survive server restarts and are unaffected by client localStorage
  clearing.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/pageDiff.test.ts`: every change class, ordering determinism,
  identical-state → empty diff, excerpt truncation.
- `src/server/pageSnapshots.test.ts`: create/list/get/delete, cap
  enforcement, state_json round-trip through `parsePageJson`.
- Route tests (existing route-test pattern): edit-session requirement, 403
  for view sessions, restore-as-copy end-to-end against a seeded test DB.

## Open Questions

- Should accepting an agent patch auto-suggest a snapshot? Recommend: no
  auto-anything in v1; revisit with usage evidence.
- Retention when a page is deleted (Tier 3.1 soft delete): snapshots follow
  the page's purge — state it in the identity spec's sweep implementation.
