# Offscreen Area Indicators Spec

Created: 2026-06-30
Status: Active foundational spec

## Problem

Cascadery canvases can grow beyond the visible viewport, especially once users start treating the canvas as a spatial workspace. Today, when Areas are off screen, the editor gives no lightweight spatial cue. Users must remember where content exists or pan around until they rediscover it.

The requested behavior is to add edge arrows, similar to game minimap indicators, that point toward offscreen Areas. If multiple Areas are in the same general direction, they should share one arrow with a count.

## Product Principle

This should feel like a calm spatial cue, not another toolbar. Cascadery should keep the canvas direct and sparse, while still helping users understand that the current viewport is only part of a larger workspace.

## Research Basis

- Nielsen Norman Group's visibility-of-system-status heuristic supports making hidden system state visible enough that users feel oriented and in control.
- NN/g's recognition-rather-than-recall heuristic supports visible spatial cues over requiring users to remember where offscreen content lives.
- WCAG 2.1 non-text contrast requires meaningful icons and UI component boundaries to be distinguishable at a 3:1 contrast ratio against adjacent colors.
- Game minimap and offscreen-indicator patterns work best when they are peripheral, aggregated, and directly navigational. For Cascadery, a full minimap would add too much persistent chrome; edge indicators are the simpler fit.

References:

- https://www.nngroup.com/articles/visibility-system-status/
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

## Scope

### In

- Derived, local-only offscreen indicators for Areas outside the current canvas viewport.
- Directional grouping so nearby offscreen Areas share one arrow and one count badge.
- Click, tap, keyboard Enter, and keyboard Space navigation to the indicated offscreen group.
- Support for edit mode and view-only mode.
- Awareness of current canvas zoom and scroll position.
- Support for nested Areas by using absolute Area bounds.

### Out

- A full minimap.
- User presence indicators.
- Persisting indicator state.
- Syncing indicator state across collaborators.
- Search or filtering.
- Custom per-user indicator preferences in the first pass.

## Interaction Model

### Visibility Rules

Indicators appear only when:

- The user is viewing an active canvas.
- At least one Area is outside the current visible canvas viewport.
- The command palette and modal dialogs are closed, unless the implementation can guarantee those overlays visually dominate the indicators.

Indicators do not appear on the empty state screen.

In view-only mode, indicators are allowed because they are content navigation, not editing chrome. They must not reveal the command palette, editor menus, or authoring controls.

### What Counts as Offscreen

An Area is offscreen when its absolute rectangle does not intersect the visible viewport with at least an 8 px margin. This small margin avoids flicker when an Area is barely touching the viewport edge.

Partially visible Areas should not get indicators unless less than 8 px of the Area intersects the viewport on both axes. The goal is to point to content the user cannot reasonably perceive, not to decorate clipped content.

### Direction Grouping

Use eight directional sectors around the viewport center:

- North
- Northeast
- East
- Southeast
- South
- Southwest
- West
- Northwest

For each offscreen Area:

1. Compute the Area center in canvas coordinates.
2. Compute the visible viewport center in canvas coordinates.
3. Compute the vector from viewport center to Area center.
4. Assign the Area to the nearest 45-degree sector.

Each sector renders at most one indicator. The indicator count is the number of Areas in that sector. Counts should show only when greater than 1.

If two sector indicators would visually overlap because the viewport is very small, merge them into the dominant neighboring sector and keep one count. On small screens, clarity beats angular precision.

### Indicator Placement

Each indicator is fixed inside the canvas viewport, not inside the scaled canvas content. It should remain visually stable while users pan or zoom.

Placement:

- Intersect the sector vector with the viewport edge.
- Clamp the result by a safe inset of 20 px from the viewport edge.
- Clamp away from top-left product chrome when editor chrome is visible.
- Keep at least 12 px between neighboring indicators.

The arrow points toward the average center of the grouped Areas, not merely the bucket name. This makes clustered diagonal content feel more precise while still allowing aggregation.

### Navigation

Clicking, tapping, pressing Enter, or pressing Space on an indicator should pan the viewport to the group's bounding-box center while preserving the current zoom level.

If a group contains multiple Areas:

- The first activation pans to the group's bounding-box center.
- Do not auto-select an Area.
- Do not change the user's zoom level.
- Future work can add cycling through individual Areas, but MVP navigation should stay simple.

Respect `prefers-reduced-motion`:

- Default: smooth pan.
- Reduced motion: instant pan.

### Visual Design

Indicators should look like lightweight canvas affordances:

- Circular or compact pill button, 36-44 px hit target.
- Directional arrow icon with optional count badge.
- Neutral translucent surface over the canvas.
- Strong enough contrast to read over light canvas content.
- No decorative glow or heavy shadow.
- No selectable text.

The count badge should be a small number, not just color. A count of `10+` is acceptable when many Areas exist in one sector.

Recommended labels:

- Single Area: `Area offscreen east`
- Multiple Areas: `3 Areas offscreen northeast`

### Accessibility

- Render each visible indicator as a real `button`.
- `aria-label` includes count and direction.
- Keyboard focus is visible, but should use the existing Cascadery focus treatment rather than a browser-default blue outline if the app has a custom focus style.
- The arrow and badge must meet WCAG 2.1 non-text contrast guidance.
- Tooltips are optional; accessible names are required.

## Technical Design

### New Helper Module

Create a pure helper module, likely `src/offscreenAreaIndicators.ts`, that has no React dependency.

Suggested types:

```ts
export type CanvasRect = {
  x: number
  y: number
  width: number
  height: number
}

export type OffscreenIndicatorDirection =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'

export type OffscreenIndicator = {
  id: string
  direction: OffscreenIndicatorDirection
  count: number
  areaIds: string[]
  targetCenter: { x: number; y: number }
  targetBounds: CanvasRect
  viewportPosition: { x: number; y: number }
  rotationDegrees: number
}
```

Suggested exported helper:

```ts
export const getOffscreenAreaIndicators = (input: {
  areas: Area[]
  viewport: CanvasRect
  viewportPixelSize: { width: number; height: number }
  zoom: number
  safeInsets?: { top: number; right: number; bottom: number; left: number }
}) => OffscreenIndicator[]
```

The helper should:

- Compute absolute bounds for nested Areas using the existing nested Area helpers.
- Skip visible Areas.
- Bucket offscreen Areas into sectors.
- Return deterministic output sorted clockwise from north.
- Return viewport pixel positions already clamped for rendering.

### App Integration

In `src/App.tsx`:

- Derive the visible canvas rect from the canvas scroll element and current zoom.
- Recalculate indicators on Area changes, zoom changes, scroll changes, and viewport resize.
- Use `requestAnimationFrame` throttling for scroll/zoom updates.
- Render indicators in a dedicated overlay layer inside the canvas root.
- Keep the overlay above canvas content and below command palettes/dialogs.

Suggested component:

```tsx
<OffscreenAreaIndicators
  indicators={offscreenAreaIndicators}
  onActivate={panToIndicatorTarget}
/>
```

### Styling

Add styles near the canvas chrome styles in `src/App.css`.

Suggested structure:

- `.offscreen-area-indicators`
- `.offscreen-area-indicator`
- `.offscreen-area-indicator__arrow`
- `.offscreen-area-indicator__count`

The overlay container should use `pointer-events: none`; each button should restore `pointer-events: auto`.

## Collaboration Behavior

Indicators are local viewport affordances. They should not be saved in page JSON, sent through Yjs, or stored on the server.

Each collaborator sees indicators based on their own viewport. Moving an Area remotely should update local indicators because the derived Area positions changed.

## Test Plan

### Unit Tests

Add `src/offscreenAreaIndicators.test.ts` covering:

- No indicators for fully visible Areas.
- One east indicator for an Area to the right.
- One west indicator for an Area to the left.
- Diagonal sector assignment.
- Multiple Areas in the same sector aggregate into one indicator with count.
- Nested Area absolute bounds are respected.
- Current zoom changes viewport math correctly.
- Indicator positions clamp to safe insets.
- Deterministic clockwise sorting.

### Source/UI Tests

Add or extend UI/source tests for:

- `App.tsx` renders the indicator overlay only on active canvases.
- Empty state does not render offscreen indicators.
- View-only mode can render navigation indicators without editor chrome.
- Indicator buttons have accessible labels.
- Activation uses the existing canvas pan/scroll pathway and does not select or edit Areas.

## Acceptance Criteria

- Offscreen Areas produce edge arrows pointing toward their direction.
- Multiple Areas in the same general direction share one arrow with a count badge.
- Indicators respond correctly to pan, zoom, resize, Area movement, Area creation, and Area deletion.
- Indicators do not appear on the empty state.
- Indicators work in view-only mode without exposing editor controls.
- Activating an indicator pans to the grouped Areas without changing zoom or selection.
- Indicator state is not persisted or synchronized.
- Keyboard and screen reader users can understand and activate each indicator.
- Focused tests cover the geometry helper and app integration.

## Future Work

- Optional hover preview listing the first few Area names.
- Cycling through individual Areas inside a group.
- Temporary pulse after panning to the target group.
- A full minimap only if future large-canvas usage proves edge indicators insufficient.
