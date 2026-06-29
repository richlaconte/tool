# Canvas Zoom Spec

## Idea

Add zoom in/out support for the editor canvas so users can work at broad page scale or inspect details without changing Area data. Zoom should feel like a familiar design-canvas interaction, similar to Figma, FigJam, or Miro, while preserving this app's simple click-to-create and text-first workflow.

## Status

Completed on 2026-06-29. The core zoom MVP is implemented and covered by focused tests.

Implemented:

- Fixed zoom controls.
- Current percentage and reset.
- Zoom in/out/fit/selection commands.
- `Cmd/Ctrl + +`, `Cmd/Ctrl + -`, `Cmd/Ctrl + 0`, `Shift+1`, and `Shift+2`.
- `Cmd/Ctrl + wheel` zoom around pointer.
- Scaled canvas world with logical coordinate conversion.
- Move, resize, creation, and drop calculations use zoom-aware helpers.

Future work:

- Direct trackpad pinch support where browser events expose reliable gesture data. The current `Cmd/Ctrl + wheel` path covers browser zoom-wheel events, including some trackpad pinch implementations.
- Optional percentage dropdown/preset menu.
- More robust low-zoom editor chrome strategy if counter-scaling becomes insufficient.

## Current State

- `#canvas` is the only scroll container.
- Area positions, image drops, and viewport-center insertion are calculated from browser client coordinates plus `canvas.scrollLeft` and `canvas.scrollTop`.
- Areas store logical `x`, `y`, `width`, and `height` in page coordinates.
- Snap grid draws directly on `#canvas`.
- Collaboration spec already reserves awareness viewport state with `{ x, y, width, height, zoom }`, but the app does not yet track zoom.

## HCI/UX Research Basis

- Figma supports keyboard canvas zoom with `Command/Ctrl` plus `+` or `-`, and FigJam supports mouse modifier-wheel zoom, trackpad pinch, explicit zoom percentage entry, zoom buttons, zoom-to-fit, and zoom-to-selection.
- Miro separates navigation expectations by input device: mouse, trackpad, and touchscreen each get familiar pan/zoom behavior, and navigation controls live in the bottom-right corner of the board.
- W3C WCAG pointer-gesture guidance says pinch or other multi-pointer gestures need a single-pointer alternative, such as plus/minus controls.
- WAI-ARIA keyboard guidance says keyboard shortcuts should be predictable, exposed, and avoid unnecessary conflicts with browser, OS, and assistive-technology commands.
- Nielsen Norman Group's visibility-of-system-status heuristic supports showing current zoom as feedback, and Fitts's Law plus WCAG target-size guidance support large, well-spaced zoom controls.

Sources:
- https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard
- https://help.figma.com/hc/en-us/articles/1500004414582-Pan-and-zoom-in-FigJam
- https://help.miro.com/hc/en-us/articles/360017731053-Using-Miro-with-a-mouse-trackpad-or-touchscreen
- https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- https://www.nngroup.com/articles/visibility-system-status/
- https://www.nngroup.com/articles/fitts-law/
- https://www.w3.org/WAI/WCAG21/Understanding/target-size.html

## User Experience

Zoom should be visible, reversible, and hard to trigger accidentally:

- Add a fixed bottom-right zoom control that never scales with the canvas.
- Controls include zoom out, current percentage, zoom in, and a fit/center option.
- Current percentage is always visible, such as `100%`.
- Percentage control can later become a dropdown with common levels: `25%`, `50%`, `75%`, `100%`, `150%`, `200%`, `400%`.
- Buttons must have tooltips or accessible labels and at least a 44x44 CSS pixel activation target.
- Zoom interactions should preserve the user's visual anchor:
  - Pointer wheel/pinch zoom keeps the canvas point under the pointer stable.
  - Button and keyboard zoom keep the viewport center stable.
  - Zoom-to-selection centers the selected Area with padding.
  - Zoom-to-fit fits all Areas with padding; if no Areas exist, reset to `100%`.
- The empty-canvas hint, save status, share/export controls, command palette, and dialogs stay fixed in viewport space.
- View-only users can zoom and pan.

## Interaction Rules

Primary controls:

- Click `-` to step down one zoom level.
- Click `+` to step up one zoom level.
- Click percentage to expose preset zoom levels after the basic control exists.
- Click fit to show all Areas, or the selected Area when an Area is selected if this keeps the control simple.

Keyboard:

- `Cmd/Ctrl + +`: zoom in.
- `Cmd/Ctrl + -`: zoom out.
- `Cmd/Ctrl + 0`: reset to `100%`.
- `Shift + 1`: zoom to fit all Areas.
- `Shift + 2`: zoom to selected Area, if one exists.
- Do not capture shortcuts while the command palette, a dialog, or a form input has focus.
- Avoid blocking browser zoom outside the canvas/editor scope.

Pointer and gesture:

- Wheel alone keeps its current behavior: scroll/pan the canvas.
- `Cmd/Ctrl + wheel` zooms around the pointer when the pointer is over the canvas.
- Direct trackpad pinch support is a progressive enhancement. Plus/minus buttons, keyboard shortcuts, and `Cmd/Ctrl + wheel` are the MVP alternatives.

## Data Model

Zoom is local viewport state, not page content:

```ts
type CanvasViewportState = {
  zoom: number
}
```

Rules:

- Default zoom is `1`.
- Clamp zoom to `0.25` through `4` for the first version.
- Area `x`, `y`, `width`, `height`, text, styles, assets, and snap-grid size stay in logical canvas pixels.
- Do not persist zoom in page JSON.
- Optional later improvement: store per-page zoom in browser-local storage so a user can resume their own view.
- Collaboration awareness may publish local viewport `{ x, y, width, height, zoom }`, but zoom is not shared as a document mutation.

## Coordinate System

Introduce explicit conversion helpers so every pointer interaction uses the same math:

```ts
type CanvasPoint = {
  x: number
  y: number
}

type CanvasViewportMetrics = {
  rectLeft: number
  rectTop: number
  scrollLeft: number
  scrollTop: number
  zoom: number
}

const screenToCanvasPoint = (
  clientX: number,
  clientY: number,
  metrics: CanvasViewportMetrics
): CanvasPoint => ({
  x: (clientX - metrics.rectLeft + metrics.scrollLeft) / metrics.zoom,
  y: (clientY - metrics.rectTop + metrics.scrollTop) / metrics.zoom,
})
```

Changing zoom should adjust `scrollLeft` and `scrollTop` to keep the chosen anchor stable:

```ts
type ZoomAnchor = {
  clientX: number
  clientY: number
}
```

For an anchor point, compute the logical canvas point before the zoom change, then set scroll after the zoom change so the same logical point remains under the same client coordinate.

## Rendering Architecture

Use a scaled inner world rather than scaling `#canvas` itself:

```tsx
<div id="canvas">
  <div className="canvas-scroll-size">
    <div className="canvas-world">
      {areas}
      {remotePresence}
    </div>
  </div>
  <CanvasZoomControls />
</div>
```

CSS direction:

```css
#canvas {
  overflow: auto;
  position: relative;
}

.canvas-scroll-size {
  width: calc(var(--canvas-world-width) * var(--canvas-zoom));
  height: calc(var(--canvas-world-height) * var(--canvas-zoom));
}

.canvas-world {
  transform: scale(var(--canvas-zoom));
  transform-origin: 0 0;
  width: var(--canvas-world-width);
  height: var(--canvas-world-height);
}
```

Implementation notes:

- Avoid CSS `zoom`; use transforms plus an explicit scroll-size wrapper for predictable layout.
- Canvas grid should move into the scaled world layer, or its background size must be zoom-adjusted so logical grid spacing remains correct.
- Editor chrome should stay usable at any zoom:
  - Preferred: render Area toolbars, resize handles, and remote labels in an overlay layer that converts canvas coordinates to screen coordinates.
  - Acceptable MVP: counter-scale toolbar and handle chrome with `scale(calc(1 / var(--canvas-zoom)))`, while keeping Area content scaled.
- Text and images scale with the canvas world.
- The browser text cursor inside an Area may scale with the transformed textarea; this is acceptable if typing remains stable and selection does not drift.

## Feature Integration

Creation and placement:

- Clicking empty canvas creates an Area at `screenToCanvasPoint`.
- Dragging an image onto the canvas inserts at `screenToCanvasPoint`.
- Inserting from command palette or slash command can still use viewport center, converted through zoom.

Move and resize:

- Pointer movement deltas must be divided by current zoom before applying to Area geometry.
- Snap grid still snaps logical canvas coordinates, not screen pixels.
- Resize handles remain easy to grab at low zoom.

Collaboration:

- Remote cursor coordinates remain page/canvas coordinates.
- Remote cursors and selections render in the scaled world or are converted into overlay coordinates.
- Awareness viewport should include local zoom once awareness viewport is implemented.
- One user's zoom never changes another user's zoom.

Command palette:

- Add command records for `Zoom in`, `Zoom out`, `Reset zoom`, `Zoom to fit`, and `Zoom to selection`.
- These commands should be available when no dialog is open, including view-only mode.

## Accessibility

- Zoom controls use native `button` elements.
- Controls expose labels like `Zoom in`, `Zoom out`, `Reset zoom to 100%`, and `Zoom to fit`.
- Current zoom percentage is visible text and can be mirrored through polite `aria-live` for button/keyboard actions, but not for every wheel tick.
- Pinch is never the only way to zoom.
- Keyboard shortcuts are documented in Help.
- Button hit targets are at least 44x44 CSS pixels and remain at that size regardless of canvas zoom.
- Focus stays predictable: opening the command palette or a dialog pauses zoom shortcuts.

## Performance

- Wheel and pinch zoom should update at animation-frame cadence, not on every raw event if events fire faster than paint.
- Keep zoom state local and avoid page persistence writes on zoom.
- Do not reserialize page JSON when only zoom changes.
- Avoid remounting Areas when zoom changes.
- Use CSS variables for zoom so rendering changes are cheap.

## Acceptance Criteria

- User can zoom in and out from fixed on-screen controls.
- User can reset to `100%`.
- User can zoom with `Cmd/Ctrl + +`, `Cmd/Ctrl + -`, and `Cmd/Ctrl + 0`.
- User can zoom with `Cmd/Ctrl + wheel` over the canvas.
- Zoom controls and shortcuts work in view-only mode.
- Zoom does not mutate Area geometry, page styles, assets, or persisted page JSON.
- Creating Areas, dropping images, moving Areas, and resizing Areas remain accurate at non-100% zoom.
- Snap grid still snaps in logical canvas pixels.
- Only the canvas scrolls; no Area or child component gains internal scrolling.
- Toolbar actions and resize handles remain usable at low zoom.
- Current zoom percentage is visible.
- Empty-canvas hint and global UI remain fixed and unscaled.
- Tests cover zoom clamping, step levels, coordinate conversion, anchor-preserving zoom, zoom-to-fit bounds, and at least one zoomed Area creation or drop scenario.

## Suggested Test Coverage

- `canvasViewport.test.ts`
  - clamps zoom to min/max.
  - steps up/down through defined zoom levels.
  - converts screen coordinates to logical canvas coordinates.
  - computes scroll offsets that preserve pointer/center anchor.
  - computes zoom-to-fit for empty, single-Area, and multi-Area pages.
- `canvasZoomUi.test.ts`
  - app exposes zoom controls with accessible labels.
  - zoom percentage is visible.
  - Help or command palette includes zoom commands.
  - global UI is outside the scaled world layer.
- Existing move/resize/drop tests
  - add cases for zoom values other than `1`.

## Non-Goals For First Version

- Minimap.
- Animated zoom transitions.
- Shared or persisted zoom state.
- Infinite canvas resizing beyond the current scrollable world calculation.
- Per-user viewport thumbnails.
- Customizable mouse navigation modes.

## Open Questions

- Should the first visible fit button mean `Fit all` always, or `Fit selection` when an Area is selected?
- Should zoom persist in local storage per page, or reset on reload?
- Should the max zoom be `400%`, or should image/design workflows get `800%` sooner?
- Should Space+drag panning be implemented with zoom, or saved for a separate pan/navigation spec?
