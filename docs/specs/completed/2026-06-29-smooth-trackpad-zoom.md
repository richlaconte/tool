# Smooth Trackpad Zoom Spec

## Idea

Rework canvas zoom so macOS trackpad pinch and high-frequency wheel zoom feel smooth, controlled, and anchored. The current behavior is too fast because each modifier-wheel event advances by one discrete zoom level.

## Status

Completed on 2026-06-29. The core smooth wheel/trackpad zoom path is implemented and covered by focused tests.

Implemented:

- Continuous zoom helpers map modifier-wheel deltas to proportional zoom changes.
- Wheel deltas are clamped before scaling so large inputs do not lurch.
- Final zoom is still clamped to the existing canvas zoom range.
- Modifier-wheel zoom uses an animation-frame accumulator instead of advancing one predefined zoom level per event.
- Pointer-anchored zoom preservation remains shared with existing zoom behavior.
- Buttons and keyboard shortcuts still use the existing discrete zoom levels.
- Wheel events inside command palette or dialog UI are ignored by the canvas zoom listener.

Future work:

- Tune the sensitivity constant on multiple real trackpads and mice.
- Consider an optional user setting for zoom speed if users report device-specific differences.

## Current State

- The completed Canvas Zoom MVP supports fixed zoom controls, keyboard shortcuts, zoom-to-fit, and `Cmd/Ctrl + wheel`.
- `Cmd/Ctrl + wheel` currently calls `zoomCanvasByDirection(event.deltaY < 0 ? 1 : -1, anchor)`.
- That means every wheel event jumps to the next predefined zoom step.
- macOS trackpad pinch can emit many wheel events in quick succession, so the canvas races through zoom levels instead of scaling continuously.
- The existing helper layer already has the right primitives for clamping zoom and preserving the pointer anchor.

## Product Rationale

Cascadery is an infinite-canvas editor. Zoom is part of spatial thinking, not a secondary preference. Trackpad zoom should behave like direct manipulation: small finger movement creates a small visual change, and the point under the pointer should stay stable. When zoom jumps too quickly, users lose context and the canvas feels fragile.

## Research Basis

- Apple Human Interface Guidelines describe gestures as direct manipulation and recommend responsive feedback while the gesture is happening.
- Apple pinch-gesture documentation treats pinch as continuous scale input, not as a discrete step command.
- MDN documents `wheel` events as covering mouse wheels and related devices such as trackpads, which means wheel delta handling needs to account for device variability.
- Browser compatibility data documents that pinch-to-zoom maps to `WheelEvent` plus `ctrlKey` in modern Chromium-based browsers and Firefox.
- The completed Cascadery Canvas Zoom spec already establishes W3C WCAG pointer-gesture guidance: pinch must not be the only zoom path, and buttons/keyboard remain required alternatives.

Sources:
- https://developer.apple.com/design/human-interface-guidelines/gestures/
- https://developer.apple.com/documentation/uikit/handling-pinch-gestures
- https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent
- https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
- https://caniuse.com/mdn-api_wheelevent_pinch_to_zoom_support
- https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html

## User Experience

Zoom should feel proportional to the gesture:

- Small trackpad pinch movement creates a small zoom change.
- Larger pinch movement creates a larger zoom change, clamped so it never lurches.
- Zoom remains anchored under the pointer.
- Zoom controls and keyboard shortcuts keep their current discrete step behavior.
- Normal wheel or two-finger scroll without a zoom modifier keeps scrolling the canvas.
- The visible zoom percentage updates smoothly, but accessibility announcements should not fire for every wheel tick.
- The same smooth zoom should work in edit and view-only modes when the pointer is over the canvas.

## Interaction Rules

Pointer and gesture:

- `Ctrl + wheel` over the canvas uses continuous zoom.
- `Meta/Cmd + wheel` over the canvas uses continuous zoom.
- Trackpad pinch events that arrive as `WheelEvent` with `ctrlKey` use the same continuous path.
- Wheel without `ctrlKey` or `metaKey` keeps its existing scroll behavior.
- Prevent the browser default only when the app is handling canvas zoom.
- Ignore canvas zoom gestures while the command palette or a dialog is open if the event target is inside that modal UI.

Buttons and keyboard:

- Zoom in and zoom out buttons keep discrete predefined levels.
- `Cmd/Ctrl + +`, `Cmd/Ctrl + -`, and `Cmd/Ctrl + 0` keep their current discrete behavior.
- `Shift + 1` and `Shift + 2` keep their fit behavior.

## Continuous Zoom Model

Add a helper that maps wheel delta to scale, then clamps the result:

```ts
export const getContinuousCanvasZoom = ({
  currentZoom,
  deltaY,
  sensitivity = 700,
}: {
  currentZoom: number
  deltaY: number
  sensitivity?: number
}) => {
  const clampedDelta = Math.max(-240, Math.min(240, deltaY))
  const scale = 2 ** (-clampedDelta / sensitivity)

  return clampCanvasZoom(currentZoom * scale)
}
```

Notes:

- The exact `sensitivity` should be tuned on a Mac trackpad before completion.
- The delta clamp prevents unusually large wheel events from producing a violent jump.
- The exponential scale model keeps zoom proportional across low and high zoom levels.
- This helper should not replace `getNextCanvasZoom`; it is only for high-frequency wheel/pinch input.

## Rendering and Performance Direction

Wheel and pinch events can arrive faster than the browser can paint. Batch them with `requestAnimationFrame`:

- Store accumulated `deltaY` and the latest pointer anchor in refs.
- Schedule one animation-frame callback when the first zoom event arrives.
- In the callback:
  - read the accumulated delta.
  - reset the accumulator.
  - compute `nextZoom` with `getContinuousCanvasZoom`.
  - use `getAnchorPreservingScroll` with the latest anchor.
  - update local `canvasZoom`.
  - update `scrollLeft` and `scrollTop`.
- Keep zoom local. Do not serialize page JSON, send collaboration document updates, or remount Areas.

## Implementation Direction

Suggested helper additions in `canvasViewport.ts`:

```ts
export const clampWheelZoomDelta = (deltaY: number) =>
  Math.max(-240, Math.min(240, deltaY))

export const getContinuousCanvasZoom = (
  currentZoom: number,
  deltaY: number,
  sensitivity = 700
) => {
  const scale = 2 ** (-clampWheelZoomDelta(deltaY) / sensitivity)

  return clampCanvasZoom(currentZoom * scale)
}
```

Suggested app direction:

- Keep `zoomCanvasByDirection` for buttons and keyboard.
- Add `zoomCanvasContinuously(deltaY, anchor)` or equivalent for wheel/pinch.
- Replace the wheel handler's `zoomCanvasByDirection(...)` call with the continuous path.
- Keep the existing anchor-preserving math so the content under the pointer remains stable.
- Cancel any pending animation frame on unmount.
- Avoid storing zoom history entries; zoom is viewport state.

## Accessibility

- Buttons and keyboard shortcuts remain available because trackpad pinch is not sufficient by itself.
- Avoid `aria-live` announcements for each continuous wheel update.
- Keep the visible percentage text updated.
- Do not hijack browser zoom outside the canvas.
- Keep focus behavior unchanged during keyboard zoom.

## Acceptance Criteria

- Trackpad pinch over the canvas no longer advances one predefined zoom level per wheel event.
- Small wheel/pinch deltas create small zoom changes.
- Large deltas are clamped so zoom does not lurch.
- Pointer-anchored zoom remains stable: the logical canvas point under the pointer stays under the pointer after zoom.
- Normal wheel scrolling without `Ctrl` or `Meta/Cmd` still scrolls the canvas.
- Zoom buttons and keyboard shortcuts still use the existing discrete zoom levels.
- Continuous zoom works in edit mode and view-only mode.
- Continuous zoom does not mutate page JSON or send collaboration document updates.
- Wheel/pinch zoom updates at animation-frame cadence.

## Suggested Test Coverage

- `canvasViewport.test.ts`
  - `getContinuousCanvasZoom` increases zoom for negative deltas.
  - `getContinuousCanvasZoom` decreases zoom for positive deltas.
  - small deltas do not jump directly to the next predefined zoom level.
  - large deltas are clamped.
  - min and max zoom limits still apply.
- `canvasZoomUi.test.ts`
  - the wheel handler no longer calls `zoomCanvasByDirection`.
  - the wheel handler uses a continuous helper for modifier-wheel zoom.
  - the wheel path uses `requestAnimationFrame`.
  - zoom controls still call the discrete step handler.
- Existing canvas viewport tests
  - keep anchor-preserving scroll coverage.

## Non-Goals

- Animated easing after the gesture ends.
- Inertial zoom.
- Custom trackpad-vs-mouse hardware detection.
- Changing button or keyboard zoom levels.
- Persisting zoom to page JSON.
- Shared zoom state across collaborators.

## Open Questions

- What sensitivity value feels best on the primary MacBook trackpad?
- Should the app later add a user setting for zoom speed?
- Should there be a temporary debug overlay for tuning delta values during development?
