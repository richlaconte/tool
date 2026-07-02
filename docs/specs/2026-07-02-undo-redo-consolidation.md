# Undo/Redo Consolidation

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 1.5). Active.

## Goal

One coherent undo model: `Cmd/Ctrl+Z` undoes your own recent canvas changes
(and only yours) in multiplayer, group operations undo atomically, accepted
agent patches are undoable, and the boundary between session undo and durable
version history is explicit.

## Research Basis

- Yjs `Y.UndoManager` provides selective undo by transaction origin, which is
  the standard mechanism for per-user undo in shared docs:
  https://docs.yjs.dev/api/undo-manager
- NN/g: user control and freedom — undo must be reliable and predictable, or
  users stop trusting destructive actions.

## Current State

- There is no general `Cmd/Ctrl+Z` on the canvas today.
- Partial recovery mechanisms exist and must be reconciled, not duplicated:
  - Deleted-area toast: `DeletedAreaSnapshot` state in App.tsx restores the
    last deleted Area.
  - Page history (`src/pageHistory.ts`): durable event log
    (localStorage key `tool.pageHistory.v1`) with `RestorePageStatePatch`
    (import undo) and `AgentUndoPatch` (agent patch rollback), schemaVersion 1.
  - Version-history UI from the completed 2026-06-29 spec.
- All canvas mutations flow through `src/collaborativePage.ts` write helpers
  (`updateCollaborativeArea`, `deleteCollaborativeArea`,
  `applyCollaborativePageStatePatch`, etc.), driven by
  `useCollaborativePageSync` (`src/useCollaborativePage.ts`). Transactions are
  currently untagged (no origin argument).
- Yjs doc maps: `page`, `areas`, `assets`, `links` (plus `comments` when Tier
  1.3 lands).
- Keyboard routing: `getAppKeyboardAction` in `src/appKeyboardLogic.ts`.

## Scope

### Transaction origins

- Define origin constants in `src/collaborativePage.ts`:
  `export const LOCAL_ORIGIN = 'local-user'` and
  `export const AGENT_ORIGIN = 'agent'` (string constants are fine; Yjs
  compares origins by identity/equality — use exported constants everywhere,
  never inline literals).
- Every write helper in `collaborativePage.ts` wraps its mutations in
  `doc.transact(fn, origin)` with an origin parameter defaulting to
  `LOCAL_ORIGIN`. Remote updates applied by the Hocuspocus provider carry
  their own provider origin automatically and will not match `LOCAL_ORIGIN`.

### UndoManager

- New module `src/pageUndo.ts`:
  - `createPageUndoManager(doc): Y.UndoManager` tracking the `areas`,
    `assets`, and `links` maps (and `comments` if present) with
    `trackedOrigins: new Set([LOCAL_ORIGIN])`. Exclude the `page` map in v1 —
    undoing title/settings/theme changes alongside spatial edits is
    surprising; revisit if users ask.
  - `captureTimeout: 300` so a drag (many small updates) coalesces into one
    undo step. Group moves (multi-select spec) already batch into one
    transaction and therefore one step.
  - Thin wrappers `undo(manager)`, `redo(manager)`, `canUndo`, `canRedo` for
    testability and UI state.
- Wire the manager in `useCollaborativePageSync`: create it when the doc is
  created, destroy on teardown, and never share it across pages (fresh
  manager per pageId — this is what guarantees "no undo history leaks across
  pages").

### Keyboard and commands

- Extend `getAppKeyboardAction`: `Cmd/Ctrl+Z` → `undo`,
  `Shift+Cmd/Ctrl+Z` and `Ctrl+Y` → `redo` — but only when focus is not
  inside a text editor. While editing Area text, native textarea undo applies
  and these shortcuts must not be intercepted (same guard pattern the file
  already uses for other editing-sensitive keys).
- Command palette entries "Undo" and "Redo", disabled states driven by
  `canUndo`/`canRedo`.
- View-only mode: undo/redo entirely disabled (no local origin writes exist).

### Reconciling existing mechanisms

- **Deleted-area toast:** keep it (it is good recovery UX), but reimplement
  restore as `undoManager.undo()` ONLY IF the delete was the most recent undo
  step; otherwise restore from the snapshot as today. Simpler acceptable
  alternative: leave the toast fully snapshot-based and document that toast
  restore itself is a new undoable action. Implementer picks one and writes a
  test for it; do not ship both paths.
- **Agent patches:** apply accepted agent patches with `LOCAL_ORIGIN` at the
  moment the human clicks accept (the human owns the acceptance), so
  `Cmd/Ctrl+Z` reverts an accepted patch. Keep `AgentUndoPatch` in
  `pageHistory.ts` as the durable, cross-session rollback record; session
  undo and history rollback are complementary, not redundant.
- **Import:** applying an imported page state is a single transaction with
  `LOCAL_ORIGIN` — one undo step — and continues to write its
  `RestorePageStatePatch` history entry.
- **Boundary statement (document in README AI/product copy if touched):**
  undo = this session, this user, fine-grained. Version history = durable,
  page-level, all actors.

## Non-Goals

- Cross-session undo (closing the tab clears the undo stack).
- Undoing other collaborators' changes.
- Selection/viewport state in undo steps (Yjs tracks doc changes only; do not
  try to restore selection on undo in v1).
- Server-side snapshots (see the named-snapshots spec).

## Acceptance Criteria

- User A and user B edit concurrently; A's `Cmd/Ctrl+Z` reverts only A's last
  change, never B's (two-doc test simulating origins).
- A multi-Area group move undoes in one step; a drag coalesces into one step.
- Accepting an agent patch then pressing `Cmd/Ctrl+Z` reverts the patch;
  the pageHistory rollback path still works independently.
- Redo restores what undo reverted; new edits clear the redo stack (Yjs
  default behavior — assert it).
- Shortcuts do not fire while editing Area text; native text undo works.
- Switching pages yields an empty undo stack for the new page.
- Undo/redo appear in the command palette with correct disabled states.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/pageUndo.test.ts`: origin filtering (local vs remote vs agent),
  capture-timeout coalescing (use fake timers or explicit `stopCapturing`),
  scope of tracked maps, per-page isolation.
- Extend `src/appKeyboardLogic.test.ts` for the new shortcuts and the
  editing-focus guard.
- Extend `src/collaborativePage.test.ts`: every write helper tags
  `LOCAL_ORIGIN` by default and honors an explicit origin argument.

## Open Questions

- Should style-dialog changes (rapid slider-like edits, if any) get their own
  capture grouping? Recommend: rely on `captureTimeout` first; tune only with
  evidence.
- Whether to include the future `comments` map in the undo scope — recommend
  yes for your own comments, which falls out naturally from origin tagging.
