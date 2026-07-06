# Read-Anywhere Responsive View Mode

## Status

Priority: P2 — queue #7 (2026-07-06 audit). See the Priority Queue in README.md before starting work.

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 4.3). Active.
Depends on the keyboard/a11y spec's outline component (`getPageOutline`) if it
has landed; otherwise build the outline helper here and share it back.

## Goal

View links get opened on phones — standup links, PR-review context, a quick
read on the go. Make view-only pages genuinely readable on small screens:
touch pan and pinch zoom, a linear outline reading mode, and compact status
chrome. Mobile *editing* is explicitly out of scope.

## Research Basis

- View-only mode already removes edit affordances rather than disabling them
  (docs/specs/completed/2026-06-29-view-only-presentation-mode.md) — this
  spec extends that mode, not the editor.
- Pointer Events are the correct unified input model for touch pan/pinch and
  are already the codebase's idiom (pointer handlers throughout App.tsx).
- WCAG 2.2 / mobile usability: no horizontal body scroll, touch targets
  ≥ 24 px, pinch zoom must not be disabled.

## Current State

- View-only access: share view links resolve to sessions whose
  `ShareAccessMode` is `'view'` (`src/shareLinks.ts`,
  `src/server/pageAccess.ts`); App.tsx branches on `isViewOnly` to hide edit
  affordances; the websocket is read-only server-side
  (`src/server/collaborationSecurity.ts`).
- Zoom/pan math is pure in `src/canvasViewport.ts`
  (`getContinuousCanvasZoom`, `getAnchorPreservingScroll`,
  `screenToCanvasPoint`, `clampCanvasZoom`); smooth trackpad zoom shipped
  (completed 2026-06-29 spec) via wheel events.
- There is no touch handling: no pinch, and pan relies on scroll/wheel
  behavior; presence row, status bar, and zoom controls are desktop-sized.
- `index.html` / `app/layout.tsx` viewport meta must be checked: pinch zoom
  must not be blocked (`user-scalable=no` is forbidden); prefer app-managed
  canvas zoom with default page-level pinch left intact where possible.
- Markdown export provides the linear structure; the keyboard/a11y spec
  extracts it as `getPageOutline(state)`.

## Scope

### Touch input (view-only surfaces only in v1)

- New pure module `src/touchGestures.ts` implementing a two-pointer gesture
  state machine over Pointer Events (the same event family the app already
  uses):
  - `createGestureState()`, `applyPointerDown/Move/Up(state, event-like) →
    GestureUpdate` where updates are `{ type: 'pan', dx, dy }` or
    `{ type: 'pinch', scale, centerX, centerY }`.
  - One pointer down on canvas (not on an Area link/URL) → pan. Two pointers
    → pinch: scale maps through `getContinuousCanvasZoom`-equivalent zoom
    with the gesture midpoint as anchor via `getAnchorPreservingScroll`.
  - Pure and unit-testable with synthetic pointer sequences; App wires it to
    real events in the view-only branch.
- Momentum/inertia: none in v1 (keep it deterministic).
- Tap on an Area with a URL/evidence link follows the link; tap elsewhere
  does nothing (no selection UI on touch view-only in v1 — selection serves
  editing).

### Small-screen layout (breakpoint ≤ 640 px, view-only)

- Status chrome collapses to a single compact bar: page title (truncated),
  connection dot, presence count (not individual chips), and two buttons —
  "Outline" and zoom-to-fit. All touch targets ≥ 40 px.
- Zoom controls (`CanvasZoomControls`) collapse into the compact bar; the
  offscreen indicators remain (they are small and orientational) but their
  tap targets meet the 40 px minimum.
- `overflow-x: hidden` on body must never be the fix for horizontal scroll —
  the layout itself must not exceed the viewport; audit dialogs (share,
  outline) at 320 px width.
- Initial view on small screens: zoom-to-fit the page content
  (`getZoomToFit`) instead of 100% zoom, so the first paint shows the whole
  map.

### Outline reading mode

- The "Outline" button opens the outline component (shared with the
  keyboard/a11y spec): a full-screen scrollable linear rendering — Areas in
  reading order with nesting as indentation, Markdown rendered (Tier 1.2
  renderer), kind/status badges, evidence links tappable. Tapping an item
  switches back to canvas mode zoomed to that Area.
- Outline mode is available at all widths in view-only (it is useful on
  desktop too) but is the *promoted* mode ≤ 640 px.

### Editor on small screens

- The editor (edit sessions) on ≤ 640 px shows a dismissible notice: "Editing
  works best on a larger screen — you're in view mode" and renders the
  view-only experience. Do not attempt partial mobile editing; a dismiss
  reveals the desktop editor unchanged for determined users (their choice,
  documented as unsupported).

## Non-Goals

- Mobile editing, touch multi-select, touch Area dragging.
- PWA installation, offline mobile behavior (offline spec covers caching
  generically).
- Native apps, share-sheet integrations.
- Responsive redesign of the desktop editor chrome.

## Acceptance Criteria

- On a 390 px viewport with a view link: one-finger pan and two-finger pinch
  work; the whole map is visible on load; no horizontal body scroll at 320,
  390, and 640 px (verified in the E2E suite with touch emulation).
- Outline mode lists all Areas in reading order with rendered Markdown;
  tapping an item returns to canvas centered on it.
- Compact bar shows title/status/presence-count; all touch targets ≥ 40 px;
  edit affordances never render for view sessions at any width.
- Pinch-zoom of the page itself is not disabled by the viewport meta.
- Editor sessions on small screens get the notice + view experience, with
  explicit dismiss-to-desktop-editor.
- Desktop view-only behavior is unchanged except for the added Outline
  entry point.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/touchGestures.test.ts`: synthetic sequences — single-pointer pan
  deltas, two-pointer pinch scale/center math, pointer-cancel cleanup,
  gesture handoff (pan → pinch when the second finger lands).
- Outline: shared `getPageOutline` tests (ordering, nesting) if not already
  landed via the a11y spec.
- Playwright (quality-infrastructure spec): mobile-viewport project with
  touch emulation for the pan/pinch/outline golden path — add the scenario
  there.

## Open Questions

- Should presence chips be individually visible on tap of the presence count?
  Recommend: yes, as a simple popover — cheap and useful in standups.
- Double-tap to zoom: common expectation; recommend double-tap = zoom-to-tapped-
  Area, added only if the gesture module stays simple.
