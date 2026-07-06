# Canvas Wayfinding: Minimap and Viewport History

## Status

Priority: P2 — queue #5 (2026-07-06 audit). See the Priority Queue in README.md before starting work.

Created on 2026-07-06 from a UX research pass. Active. This is the
deliberately deferred follow-up that three completed specs queued: canvas
zoom ("Non-goals: minimap"), offscreen indicators ("a full minimap only if
future large-canvas usage proves edge indicators insufficient"), and page
search ("a minimap — evaluate separately after performance work"). The
performance-at-scale spec completed on 2026-07-02, so the precondition is
met.

## Goal

Cascadery now teleports users constantly: search results, the page outline,
journal "Jump to Area" links, offscreen indicators, and zoom-to-selection
all move the viewport with no way back. On large boards users lose the
answer to "where am I, and where was I?" This spec adds the two classic
wayfinding aids: a lightweight, collapsible minimap (overview+detail) and a
viewport history (back/forward between camera positions), both keyboard
accessible.

## Research Basis

- Cockburn, Karlson & Bederson, *A Review of Overview+Detail, Zooming, and
  Focus+Context Interfaces* (ACM Computing Surveys) — overviews improve
  orientation and subjective satisfaction; they carry assimilation cost, so
  the overview must be peripheral and optional:
  https://dl.acm.org/doi/10.1145/1456650.1456652
- Hornbæk, Bederson & Plaisant, *Navigation patterns and usability of
  zoomable user interfaces with and without an overview* (TOCHI) — some
  tasks are faster without an overview; keep the detail view primary and
  the minimap collapsible rather than persistent chrome:
  https://dl.acm.org/doi/10.1145/586081.586086
- NN/g recognition-rather-than-recall (already cited by the offscreen
  indicators spec): spatial position should be visible, not remembered:
  https://www.nngroup.com/articles/recognition-and-recall/
- Prior repo decision trail: offscreen edge indicators shipped as the
  low-chrome interim; the minimap was explicitly parked until performance
  work landed (docs/specs/completed/2026-06-30-offscreen-area-indicators.md,
  completed/2026-07-02-page-search-navigation.md).

## Current State

- Viewport math is pure and tested in `src/canvasViewport.ts`
  (`getCanvasWorldSize`, `getZoomToArea`, `getZoomToFit`,
  `screenToCanvasPoint`, `clampCanvasZoom`); the viewport itself is scroll
  position + `canvasZoom` state in `App.tsx`.
- Teleporting entry points all funnel through `jumpToArea` (App.tsx) and
  the zoom helpers — a single choke point for pushing history.
- `OffscreenAreaIndicators` and `CanvasZoomControls` are the existing
  peripheral navigation chrome; the minimap belongs beside them.
- Performance: canvas-performance-at-scale landed visibility culling
  helpers; the minimap must render from the same cheap geometry data
  (id, rect, kind color), never from Area DOM.
- Keyboard: shortcuts are centralized in `src/appKeyboardLogic.ts` and
  surfaced in the shortcuts dialog + palette from one data source.

## Scope

### Minimap

- A collapsible overview panel anchored near the zoom controls: scaled
  rectangles for all Areas (fill by Area kind's existing accent, muted),
  the current viewport as a draggable rectangle, remote collaborator
  viewports optional later.
- Interactions: click to center viewport at point; drag the viewport rect
  to pan continuously; wheel over minimap zooms the canvas around the
  pointed world position. All pointer math lives in a pure module
  `src/canvasMinimap.ts` (`getMinimapProjection(worldSize, panelSize)`,
  `minimapPointToWorld`, `getViewportRect`) with unit tests.
- Collapsed by default; toggle via a control on the panel, a palette entry
  ("Toggle minimap"), and a shortcut registered in the shared shortcut
  data. State is device-local (localStorage), not page state.
- View-only mode shows the minimap (reading large boards is the strongest
  use case); the responsive view-mode spec should reuse it on small
  screens only if it costs nothing extra (coordinate, don't duplicate).
- Rendering budget: a single `<canvas>` or one SVG with ≤ 1 node per Area,
  redrawn at most once per animation frame from the culling data; no
  per-Area React components.

### Viewport history

- A bounded stack (e.g. 50 entries) of `{ scrollX, scrollY, zoom }`
  recorded by every *teleport* (jumpToArea, zoom-to-fit/selection, minimap
  click, outline/search/journal jumps) — not by continuous pan/zoom.
- "Back" returns to the pre-jump viewport; "Forward" re-applies. Surfaced
  as palette entries, shortcuts (proposal: `Ctrl/Cmd+[` and `Ctrl/Cmd+]`,
  verify against browser conflicts in `appKeyboardLogic` review), and
  small back/forward affordances on the zoom controls cluster.
- Pure logic in `src/viewportHistory.ts` (push with de-dupe of identical
  viewports, back/forward semantics, bound); session-only state — never
  persisted, never collaborative.
- Motion: animated transitions respect `prefers-reduced-motion` exactly
  like the search spec's jump animation.

### Live-region and a11y

- Back/forward and minimap jumps announce through the existing polite live
  region ("Returned to previous view"); the minimap panel is reachable by
  keyboard with arrow-key panning of the viewport rect.

## Non-Goals

- Remote collaborator viewports in the minimap (candidate follow-up with
  the mission-control spec's board lens).
- Persistent per-page camera bookmarks or named views.
- Any change to page JSON, exports, or the Yjs document — this feature is
  entirely ephemeral view state.
- Replacing offscreen edge indicators (they remain the zero-chrome cue;
  the minimap is opt-in depth).

## Acceptance Criteria

- Minimap renders all Areas and the viewport rect, stays under one redraw
  per frame on the performance-spec benchmark page, and supports click,
  drag, and wheel navigation.
- Every teleporting action pushes viewport history; Back restores the
  exact prior scroll/zoom; Forward re-applies; bounded stack never grows
  past its cap.
- Minimap visibility and viewport history work identically in view-only
  mode (minus editing side effects) and never touch document state.
- Shortcuts and palette entries render from the shared shortcut data
  source; live-region announcements fire on back/forward.
- Reduced-motion users get instant transitions.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/canvasMinimap.test.ts`: projection math round-trips
  (world→minimap→world), viewport rect clamping, degenerate cases (empty
  page, single Area, extreme aspect ratios).
- `src/viewportHistory.test.ts`: push/back/forward semantics, de-dupe,
  bound, interleaved teleports.
- Extend `src/appKeyboardLogic.test.ts` for the new bindings and their
  editing-mode guards.
- UI test (`src/canvasWayfindingUi.test.ts`) asserting App.tsx wires
  jumpToArea and zoom helpers through the history push, minimap toggle
  exists in palette options.

## Open Questions

- Minimap default position (bottom-right above zoom controls vs
  bottom-left) — pick by collision with existing chrome (journal panel is
  right-side).
- Should minimap show comment/proposal badges? Recommend: no for v1 —
  keep it purely spatial.
- Wheel-zoom over the minimap: zoom the canvas (recommended) or zoom the
  minimap itself? Decide in implementation with a comment.
