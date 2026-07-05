# Canvas Performance at Scale

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 4.1). Completed MVP
on 2026-07-05.

Completion note: the MVP ships deterministic benchmark content, a dev-only
benchmark insertion command, viewport culling for Areas, link culling for
offscreen connectors, and Area memoization. The larger App.tsx decomposition
and Chrome trace capture remain future performance-hardening work rather than
hidden gaps in this MVP.

## Goal

Real implementation maps grow to hundreds of Areas. Define performance
budgets, build a benchmark harness, decompose the 6,600-line App.tsx so the
render path is optimizable, and add viewport culling + memoization to meet the
budgets.

## Research Basis

- tldraw's canvas performance work establishes that DOM-based canvases scale
  to thousands of shapes with culling and careful reactivity:
  https://tldraw.dev/
- React Compiler (already a devDependency: `babel-plugin-react-compiler`)
  auto-memoizes components, but only components it can compile — extraction
  from a monolith increases its coverage:
  https://react.dev/learn/react-compiler
- RAIL-style budgets: interaction response < 100 ms, animation frame ≈ 16 ms.

## Current State

- `src/App.tsx` is ~6,618 lines. The `App` component holds ~40 `useState`
  hooks (selection, viewport, dialogs, link editing, GIF search, share state,
  agent proposals…) and renders the entire canvas: every state change
  re-renders the whole tree.
- Partial extraction exists: `src/components/Area.tsx`, `AreaStyleDialog.tsx`,
  `CommandPalette.tsx`, `Draggy.tsx`. Inline in App.tsx remain:
  `ContextKitPicker`, `ShareLinkRow`, `GifSearchFlyout`,
  `OffscreenAreaIndicators`, `CanvasZoomControls` (all near the bottom of the
  file), plus the main canvas surface, link layer, presence row, status bar,
  and all dialogs.
- Every Area is a live DOM node; there is no culling. Offscreen indicators
  (`src/offscreenAreaIndicators.ts`) already compute visibility from state,
  not DOM — culling must not break them.
- Viewport math is pure and tested (`src/canvasViewport.ts`); zoom state is
  `canvasZoom` + `canvasViewport` in App.
- Verify React Compiler is actually active in the Next build (check
  `next.config.ts` for the compiler flag; it was configured for Vite/Babel —
  if it is not running under Next, enabling it is part of this spec).

## Scope

### Budgets (the contract this spec is tested against)

- 500 root Areas: pan and zoom at 60 fps on a mid-tier laptop (define as: no
  frame > 33 ms during continuous pan in a Chrome performance trace).
- 2,000 Areas: usable — pan ≥ 30 fps, selection/typing latency < 100 ms.
- Typing in one Area must not re-render other Areas (verified via React
  Profiler render counts).

### Benchmark harness (build first — measure before optimizing)

- New module `src/benchmarkPage.ts`: `createBenchmarkPageState(areaCount,
  options?)` — deterministic (seeded) generator producing a realistic mix:
  ~70% notes with Markdown, 15% typed Areas with metadata/evidence, 10%
  nested clusters, 5% images (placeholder assets), plus links at ~0.5 per
  Area.
- Dev-only command palette entry "Insert benchmark content…" (guarded by
  `process.env.NODE_ENV !== 'production'`).
- Record a baseline trace (500 and 2,000 Areas) before any optimization and
  paste the numbers into this spec's completion notes; re-record after.

### Decomposition (enabling refactor — behavior-neutral)

- Extract from App.tsx into `src/components/`: `CanvasSurface` (pan/zoom,
  pointer routing), `AreaLayer` (renders Areas from a props list),
  `LinkLayer` (connectors + endpoints), `PresenceRow`, `StatusBar`,
  `DialogHost` (share/style/history/import dialogs), and move the five inline
  bottom-of-file components into their own files.
- Extract state clusters into hooks under `src/hooks/`: `useSelection`,
  `useLinkEditing` (the ~12 link-related useStates), `useGifSearchState`,
  `useAgentProposals`. Rule: a hook owns state + handlers; components receive
  narrow props. No behavior changes — the existing test suite plus the
  Playwright golden paths (quality-infrastructure spec) are the safety net;
  sequence this after the E2E harness lands if at all possible.
- Keep module-level pure logic where it is (`src/*.ts` files are already
  well-factored); this refactor only splits the React layer.

### Rendering optimizations (in order; measure between steps)

1. **Memoize `Area`:** `React.memo` with stable callback props (or verify
   React Compiler achieves the same once active). Target: typing in one Area
   renders only that Area.
2. **Viewport culling in `AreaLayer`:** compute the visible canvas rect from
   viewport + zoom (pure helper `getVisibleAreaIds(areas, viewportRect,
   marginPx)` in a new `src/canvasCulling.ts`, margin ≈ 400 px so scroll-in
   is seamless); root Areas fully outside the margin render nothing (they
   are absolutely positioned, so skipping them does not affect layout).
   Constraints: the currently-edited Area, selected Areas, and drag targets
   are always rendered regardless of culling; offscreen indicators and
   marquee selection already work from state and must keep passing their
   tests.
3. **Link layer:** cull links whose both endpoints are culled; memoize path
   computation (`src/linkGeometry.ts` is pure — cache per (endpoints, route)
   if profiling shows it hot).
4. Only if budgets still fail: virtualize text rendering for very long Area
   contents (Markdown AST render capped with "show more"), documented as a
   follow-up spec if reached.

## Non-Goals

- Switching to `<canvas>`/WebGL rendering.
- Web workers for Yjs.
- Optimizing the collaboration server (client rendering only).
- Behavior or visual changes of any kind — this spec's diff should be
  invisible to users.

## Acceptance Criteria

- Deterministic benchmark generator exists and produces realistic mixed
  content at scale.
- Dev-only command palette entry can replace the current page with benchmark
  content for local performance testing.
- Areas outside an overscanned viewport are skipped while selected, focused,
  dragged, or link-targeted Areas and their ancestors stay mounted.
- Links whose endpoints are both culled are skipped.
- `Area` is memoized as a first-line render boundary.
- Culled Areas re-appear from state during pan/zoom; editing, selection,
  marquee, offscreen indicators, and connectors keep their existing behavior.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Future Work

- Record repeatable Chrome traces for 500 and 2,000 Area benchmark canvases
  once the E2E/telemetry harness exists.
- Split the remaining React render layer out of App.tsx into dedicated
  canvas, area-layer, link-layer, dialog-host, status, and presence modules.
- Stabilize the large callback prop surface around `Area` if profiler evidence
  shows manual memoization is not enough beyond React Compiler coverage.

## Testing

- `src/benchmarkPage.test.ts`: determinism (same seed → same state), count
  and mix distribution.
- `src/canvasCulling.test.ts`: visibility math across zoom levels, margin
  behavior, always-render exceptions (edited/selected/dragging).
- Existing `*Ui.test.ts` source-shape tests will need import-path updates —
  update them mechanically, do not weaken assertions.
- Manual profiling protocol documented in the spec on completion (device,
  Chrome version, trace steps) so future regressions are re-measurable.

## Open Questions

- Is React Compiler active under the Next build? Verify first; if yes, manual
  `React.memo` may be unnecessary — let the profiler decide.
- Culling nested children independently of parents: defer unless profiling
  shows deep nests matter (parents clip children today, so parent-level
  culling should suffice).
