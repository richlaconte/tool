# Multi-Select and Group Manipulation

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 1.1). Active.

## Goal

Let users select multiple Areas at once — by marquee drag or shift-click — and
act on the whole selection: move, delete, duplicate, style, align, and
distribute. This is the single most universal spatial-canvas expectation that
Cascadery currently fails.

## Research Basis

- Every mainstream canvas (Excalidraw, tldraw, FigJam, Miro) supports marquee
  select, shift-click toggle, and group drag as baseline behavior:
  https://tldraw.dev/ and https://excalidraw.com/
- NN/g flexibility-and-efficiency heuristic: accelerators (bulk actions) must
  have visible counterparts (toolbar/palette entries):
  https://www.nngroup.com/articles/flexibility-efficiency-heuristic/

## Current State

- Selection is a single id: `selectedAreaId: string | null` in `src/App.tsx`
  (around line 1042), with `setSelectedAreaId` threaded through Area
  components, the toolbar, dialogs, and keyboard handling.
- Blank-canvas pointer behavior is decided by
  `getCanvasPointerAction` / `isBlankCanvasPointerSurface` in
  `src/canvasPointerActions.ts`. A plain click on blank canvas creates a new
  text Area; recent commits also use blank-canvas clicks to deselect.
- Remote collaborators see a single selected Area outline via presence state in
  `src/collaboration.ts` (`remotePresences` in App.tsx).
- Delete recovery uses a single-area `DeletedAreaSnapshot` toast
  (App.tsx around line 1062).
- Area geometry: root Areas hold absolute canvas coordinates; nested Areas are
  positioned relative to their parent (see `src/nestedAreas.ts` helpers).
- Snap grid logic lives in `src/snapGrid.ts`; keyboard routing in
  `src/appKeyboardLogic.ts`; command palette options in
  `src/commandPaletteOptions.ts`.

## Scope

### Selection model

- Replace `selectedAreaId` with `selectedAreaIds: string[]` state in App.tsx.
  Derive `primarySelectedAreaId` (the most recently added id) for every
  surface that needs exactly one Area: the area toolbar, style dialog, link
  editing, and slash commands. When `selectedAreaIds.length !== 1`, those
  single-Area surfaces hide.
- Create a new pure module `src/areaSelection.ts` with colocated
  `src/areaSelection.test.ts`:
  - `toggleAreaSelection(selectedIds, areaId): string[]`
  - `getMarqueeSelection(rect, areas): string[]` — returns root Areas whose
    absolute bounds intersect the marquee rect. Nested Areas are never
    directly marquee-selected in v1; selecting a parent implies its children
    travel with it (existing nesting drag behavior already does this).
  - `normalizeSelection(selectedIds, areas): string[]` — drops ids for Areas
    that no longer exist and drops descendants when an ancestor is selected
    (prevents double-applying group moves).

### Marquee

- Pointer-down on a blank canvas surface starts a candidate marquee. If the
  pointer moves more than 4 px before pointer-up, it is a marquee drag and
  renders a selection rectangle; on release, intersecting root Areas become
  the selection. If the pointer never crosses the threshold, keep today's
  behavior exactly (click = create Area / deselect).
- Extend `getCanvasPointerAction` in `src/canvasPointerActions.ts` to express
  this state machine as pure logic (`'create-area' | 'deselect' | 'marquee'`
  plus threshold handling), tested in `canvasPointerActions.test.ts`.
- Shift-click on an Area toggles it in/out of the selection without starting
  text editing. Plain click replaces the selection with that Area (today's
  behavior).
- Marquee rect must account for zoom and viewport scroll: convert screen
  points with `screenToCanvasPoint` from `src/canvasViewport.ts`.

### Group actions

- **Move:** dragging any selected Area applies the same delta to every
  selected root Area. Snap-grid rounding applies to the dragged Area's
  position; the others move by the same (snapped) delta so relative layout is
  preserved.
- **Delete:** removes all selected Areas. Extend the deleted-area toast to hold
  an array of snapshots (`DeletedAreasSnapshot`) and restore all of them.
- **Duplicate:** duplicates all selected Areas with a uniform offset, reusing
  `src/areaActions.ts` duplicate logic; the duplicates become the new
  selection.
- **Style:** applying a style via the style dialog or a CSS slash command with
  a multi-selection applies the declaration(s) to every selected Area.
- **Align/distribute:** new pure module `src/areaAlignment.ts` with
  `alignAreas(areas, edge)` for `left | right | top | bottom | center-x |
  center-y` and `distributeAreas(areas, axis)` for `horizontal | vertical`.
  Alignment uses absolute root-Area bounds and returns new positions; App.tsx
  applies them in one state update. Expose all eight operations in the command
  palette (`commandPaletteOptions.ts`) — they are enabled only when 2+ Areas
  are selected (3+ for distribute).

### Keyboard

- `Escape` clears the selection (extend `getAppKeyboardAction` in
  `src/appKeyboardLogic.ts`).
- `Cmd/Ctrl+A` selects all root Areas when focus is not inside a text editor.
- `Delete`/`Backspace` deletes the whole selection (already deletes one).

### Collaboration

- Presence currently carries one selected Area id. Extend the presence payload
  in `src/collaboration.ts` to `selectedAreaIds: string[]` and render remote
  selection outlines for each. Keep backward compatibility: when reading a
  remote presence, accept either the legacy single-id field or the new array.

### Persistence and sync

- Selection is ephemeral UI state — nothing changes in `pagePersistence.ts`,
  the Yjs doc (`collaborativePage.ts`), or page JSON.
- Group moves must write through the existing collaborative update path
  (`updateCollaborativeArea`) inside a single Yjs transaction so remote peers
  and the future undo manager treat the group move as one change. Add a helper
  `updateCollaborativeAreas(doc, areas)` to `src/collaborativePage.ts` that
  wraps multiple area updates in one `doc.transact` call.

## Non-Goals

- Group resize (single-Area resize only, unchanged).
- Persistent "groups" as a document concept — selection is transient.
- Marquee-selecting nested children individually.
- Touch multi-select (see the responsive view-mode spec).

## Acceptance Criteria

- Dragging on blank canvas past 4 px draws a marquee; releasing selects all
  intersecting root Areas; a sub-threshold click still creates an Area.
- Shift-click adds/removes an Area from the selection.
- Dragging any selected Area moves all selected Areas together; a single undo
  (once undo lands) or a single remote sync message batch reflects the move.
- Delete removes all selected Areas and the toast restores all of them.
- Applying a CSS slash command or style-dialog change with three Areas
  selected styles all three.
- Align left/right/top/bottom/center and distribute horizontal/vertical are
  available from the command palette and behave correctly at any zoom level.
- `Escape` clears selection; `Cmd/Ctrl+A` selects all root Areas.
- Remote collaborators see multi-selection outlines; a legacy client sending a
  single selected id still renders correctly.
- View-only mode permits selection highlighting but no group mutation.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/areaSelection.test.ts`: toggle, marquee intersection (including zoomed
  coordinates and ancestor/descendant normalization), stale-id cleanup.
- `src/areaAlignment.test.ts`: each align edge and both distribute axes,
  including uneven sizes and already-aligned inputs.
- Update `src/canvasPointerActions.test.ts` for the marquee threshold states.
- Extend `src/collaboration.test.ts` for the presence payload compatibility.

## Open Questions

- Should marquee require a modifier when starting over a nested Area's parent
  padding? Recommend: no — blank surface only, which is already well-defined
  by `isBlankCanvasPointerSurface`.
- Should group duplicate offset match the single-Area duplicate offset?
  Recommend: yes, reuse the constant from `areaActions.ts`.
