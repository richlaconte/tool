# Page Search and Navigation

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 1.4). Active.

## Goal

Find any Area on a page by text, kind, status, or evidence reference, and jump
the viewport to it. Add zoom-to-fit and zoom-to-selection commands. Once a page
grows past a screenful, panning is retrieval by luck; offscreen indicators help
orientation, not search.

## Research Basis

- Agents already have search (`search_areas` MCP tool); NN/g notes agents are
  becoming users of interfaces — human and agent capabilities should stay in
  parity: https://www.nngroup.com/articles/ai-agents-as-users/
- Obsidian Canvas and Miro both treat board search + jump-to-result as core
  navigation: https://obsidian.md/canvas

## Current State

- Agent-side search exists: `searchAgentAreas` in `src/agentInterface.ts`
  (line ~264) matches Areas for the MCP `search_areas` tool. Its matching
  logic should become the shared implementation.
- The command palette (`src/components/CommandPalette.tsx`,
  `src/commandPaletteLogic.ts`, `src/commandPaletteOptions.ts`) filters a
  static list of commands — it has no Area-result mode.
- Viewport math lives in `src/canvasViewport.ts`: `getZoomToFit` (line ~122),
  `screenToCanvasPoint`, `clampCanvasZoom`, `getAnchorPreservingScroll`.
  App.tsx holds `canvasZoom` and `canvasViewport` state.
- Keyboard routing: `getAppKeyboardAction` in `src/appKeyboardLogic.ts`.
- Area metadata (kind, status, tags) is on `area.metadata`
  (`src/areaMetadata.ts`); evidence refs are `metadata.evidence[]`.

## Scope

### Shared search logic

- Extract matching into a new pure module `src/areaSearch.ts`:
  - `searchAreas(areas, query, options?): AreaSearchResult[]` where a result
    is `{ areaId, matchField: 'text' | 'kind' | 'status' | 'tag' | 'evidence',
    excerpt, score }`.
  - Matching: case-insensitive substring on raw text (Markdown source),
    kind/status exact-token matches (e.g. `kind:task`, `status:blocked`
    filter syntax), tag and evidence target/label substring.
  - Ranking: title-line matches above body matches, then by document reading
    order (y, then x).
- Refactor `searchAgentAreas` in `agentInterface.ts` to delegate to
  `searchAreas` so human and MCP search cannot drift. Keep the existing
  `search_areas` MCP response shape stable.

### Search UI

- The command palette gains a search mode: typing `?` as the first character
  (or launching via a dedicated entry "Search Areas…") switches the list from
  commands to live Area results, showing kind badge, excerpt with the match
  highlighted, and status. Arrow keys navigate; Enter jumps to the selected
  result and selects that Area; Escape returns to command mode, then closes.
- Keyboard shortcut: `Cmd/Ctrl+F` opens the palette directly in search mode
  when focus is not inside an Area editor. Note the NN/g caution about
  overriding browser find — acceptable here because the canvas is not
  readable via native find, and the palette's search-mode entry keeps a
  visible counterpart. When focus IS in a text editor, let the browser
  handle `Cmd/Ctrl+F`.
- Search works in view-only mode (jump + select highlight only, no editing).

### Jump and zoom commands

- New helper in `src/canvasViewport.ts`:
  `getZoomToArea(area, viewportSize, options?)` — returns `{ zoom, scrollLeft,
  scrollTop }` centering the Area with padding, clamped to
  `MIN_CANVAS_ZOOM`/`MAX_CANVAS_ZOOM`, capped at 1.0 zoom-in (never zoom past
  100% just to fill the screen with one small Area). Reuse the `getZoomToFit`
  math.
- Animate the transition with a short (≈200 ms) `requestAnimationFrame`
  interpolation of zoom + scroll; respect `prefers-reduced-motion` by jumping
  instantly.
- New command palette entries: "Zoom to fit page" (all root Areas via
  `getZoomToFit`) and "Zoom to selection" (selected Area(s) bounds — works
  with multi-select once Tier 1.1 lands; single selection until then).

## Non-Goals

- Cross-page search (no page index exists client-side; revisit with the page
  shelf spec).
- Fuzzy matching or search history.
- A minimap (evaluate separately after performance work).

## Acceptance Criteria

- Typing in search mode filters results live across text, kind, status, tags,
  and evidence; `kind:task` style filters work.
- Enter pans/zooms to the result, selects the Area, and closes the palette;
  the animation is skipped under `prefers-reduced-motion`.
- `Cmd/Ctrl+F` opens search when the canvas has focus and does not intercept
  find inside text editing.
- Zoom-to-fit and zoom-to-selection exist in the palette and work at every
  zoom level and viewport size.
- MCP `search_areas` results match in-app results for identical queries
  (shared implementation, verified by a parity test).
- Works in view-only mode.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/areaSearch.test.ts`: match fields, filter syntax, ranking order,
  empty/no-result queries, Markdown source matching.
- `src/canvasViewport.test.ts`: extend for `getZoomToArea` (centering,
  clamping, zoom-in cap).
- Parity test in `src/agentInterface.test.ts`: `searchAgentAreas` delegates to
  `searchAreas`.

## Open Questions

- Should search results include archived comment text (Tier 1.3)? Recommend:
  not in v1; add a `has:comments` filter later.
- `?` prefix vs a separate palette hotkey — implementer may choose either but
  must keep a visible "Search Areas…" command entry.
