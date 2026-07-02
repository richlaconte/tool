# Canvas Performance at Scale

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 4.1). Active.
Includes the App.tsx decomposition as an enabling refactor — the perf work
requires it, so they ship as one spec.

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

- Baseline and post-optimization traces recorded for 500/2,000 Areas; the
  500-Area budget (no frame > 33 ms during pan) and 2,000-Area usability
  budget are met.
- Typing in one Area re-renders only that Area (React Profiler evidence).
- App.tsx no longer contains the Area render path, the five inline
  components, or the link-editing state cluster; no single component file
  exceeds ~800 lines.
- Culled Areas re-appear seamlessly during pan/zoom at every zoom level;
  editing, selection, marquee, offscreen indicators, and connectors behave
  identically (full existing test suite passes unchanged, minus deliberate
  import-path updates).
- Benchmark generator is dev-only and deterministic.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

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
