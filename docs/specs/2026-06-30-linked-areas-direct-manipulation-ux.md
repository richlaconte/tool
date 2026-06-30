# Linked Areas Direct Manipulation UX Spec

Created: 2026-06-30
Status: Active foundational spec

## Problem

Cascadery's current linked Areas feature has the right underlying semantic model, but the primary UX is still form-based: users choose a target and connector options in dialogs, while the canvas renders passive lines afterward. That makes links feel like metadata about Areas rather than spatial objects users can create, aim, adjust, and understand directly.

The next version should make linking feel native to the canvas:

- Users can connect Areas by dragging from the border of one Area to the border of another.
- Connector endpoints can dock to any point on an Area border, not only the midpoint of a side.
- Endpoint points can be dragged around after creation.
- Multiple connectors can share one connection point.
- Clicking a connector opens lightweight options near the connector instead of forcing a full dialog.

This is a UX refinement spec over the completed Area metadata/link and Area connector system specs. It should preserve the existing semantic `AreaLink` model, exports, collaboration, MCP readability, and view-only restrictions while making human creation and adjustment far more direct.

## Research Basis

Direct manipulation research supports acting on visible objects with immediate, reversible feedback. NN/g defines direct manipulation as visible UI elements acted on through actions with immediate feedback, and describes dragging displayed objects as a classic example. That directly supports replacing form-first link creation with border drag, live previews, snapping feedback, and reversible cancellation.

Fitts's Law supports large, forgiving targets. NN/g's UX summary emphasizes that larger targets are faster to acquire and reduce error rates. For Cascadery, this argues against tiny visible connector dots as the only interaction target. Border docking should use an invisible hit band around the Area perimeter so the target is easy to grab without visually covering content.

WCAG 2.2 Target Size recommends pointer targets of at least 24 by 24 CSS pixels, or sufficient spacing/equivalent alternatives. For thin connector handles and line endpoints, Cascadery should use larger invisible targets while keeping the visible treatment quiet. WCAG 2.2 Dragging Movements also requires a non-drag alternative unless dragging is essential, so command-palette and flyout controls must remain available.

Mature diagramming tools validate the same model:

- draw.io supports hover-revealed floating connectors, fixed connection points, fixed-position attachment with modifier keys, and snapping/highlight feedback.
- Visio distinguishes point connections, which stay glued to a specific point, from dynamic connections, which move to the nearest connection point as shapes move.
- tldraw stores arrow bindings with normalized anchor points and flags for precise/snap-to-edge behavior, and updates arrows as bound shapes change.

Graph readability research from the prior connector spec still applies: reduce occlusion, crossings, and edge tunneling when possible, but do not turn Cascadery into an automatic graph-layout product. Cascadery should give users simple spatial tools and keep semantic relationships readable.

References:

- https://www.nngroup.com/articles/direct-manipulation/
- https://www.nngroup.com/articles/fitts-law/
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- https://www.drawio.com/docs/manual/connectors/
- https://support.microsoft.com/en-us/visio/edit-connector-lines-arrows-or-points
- https://tldraw.dev/sdk-features/bindings

## Product Principle

Linked Areas should feel like a calm canvas-native relationship tool, not a diagramming mode. A user should be able to sketch relationships as quickly as they arrange Areas, while Cascadery quietly preserves the semantic link data that agents, exports, and collaboration need.

Principles:

- Direct first, forms second.
- Large invisible hit targets, small visible affordances.
- Preserve semantic meaning behind every visual line.
- Keep basic link editing contextual and lightweight.
- Support precise control without requiring precision for the common path.
- Avoid always-on connector clutter.

## Recommended Approach

Use contextual border docking with explicit connection ports.

### Why This Approach

Always-visible handles would make connection points discoverable, but would clutter every Area and compete with text editing, resizing, and toolbar controls. A connector-only tool mode would reduce accidental activation, but would slow down the common workflow and make linking feel separate from direct canvas manipulation.

The best fit for Cascadery is a hybrid:

- Areas expose invisible perimeter hit zones on hover or selection.
- A small visible connection hint appears only near the hovered border point.
- Dragging from that border starts a connector preview.
- Dropping on another Area border creates a link docked to the exact border location.
- Docked points become explicit ports that can be reused, dragged, or split.
- Command palette and toolbar paths remain as non-drag alternatives.

This gives expert users the speed of direct manipulation and gives less precise users forgiving target areas.

## Interaction Design

### Border Hover Affordance

When the pointer enters an Area's perimeter hit zone:

- Show a subtle edge highlight near the hovered border segment.
- Show a small connection dot at the nearest border coordinate.
- Change cursor to a connector/drag affordance if practical.
- Do not show every possible connection point at once.
- Do not cover text content or child components beyond the perimeter band.

Recommended hit zone:

- Minimum effective target: 24 CSS pixels.
- Use a perimeter band of roughly 12 px inside and 12 px outside the Area border where layout permits.
- If Areas overlap, the topmost hovered/selected Area wins.
- Area toolbar, resize handles, text inputs, and image controls have higher priority than connector hit zones.

### Creating A Link

Primary flow:

1. User hovers the border of Area A.
2. The nearest border point highlights.
3. User drags from that border point.
4. A live preview line follows the pointer.
5. Candidate target Areas show a subtle border highlight when the pointer enters their perimeter hit zone.
6. The preview endpoint snaps to the target border coordinate under the pointer.
7. User releases on Area B's border.
8. Cascadery creates a default link, selects it, and opens a small connector flyout near the connector midpoint or release point.

Default link values:

- `kind: 'relates-to'`
- `visual.mode: 'simple'` or the existing default mode if product consistency requires `semantic`
- `visual.direction: 'forward'`
- `visual.route: 'auto'`
- label empty

Cancellation rules:

- Releasing on blank canvas cancels; it must not create a new Area.
- Pressing Escape during drag cancels.
- Dragging less than a small threshold should select/focus the Area rather than create a link.
- Self-links are out of scope for MVP unless explicitly enabled later.

### Editing A Link

Clicking a connector should select it and open a lightweight flyout, not the full command dialog by default.

Flyout contents, MVP:

- Relationship kind chips: Relates, Depends, Implements, Blocks, Answers, References.
- Direction segmented control: None, Forward, Backward, Both.
- Label input.
- Delete button.
- More button that opens the existing full connector dialog for schema/cardinality/advanced route options.

Behavior:

- Flyout appears near the connector midpoint, offset away from the line so it does not cover endpoints.
- Flyout closes on Escape, Enter after committing a text field, outside click, or connector deselection.
- Double-click can still open the full advanced dialog if useful, but single-click should be enough for common edits.
- Selected connector remains visually emphasized while the flyout is open.

### Dragging Endpoints

When a connector is selected:

- Show endpoint handles at both dock points.
- Each endpoint handle has a large invisible hit target and a small visible dot.
- Dragging an endpoint along the same Area border updates its dock point continuously.
- Dragging an endpoint to another Area border rebinds that endpoint to the new Area.
- Releasing away from any Area border restores the previous endpoint and shows no error.
- Holding Option/Alt while dragging bypasses port snapping and creates an independent precise point.

The endpoint drag preview should update the connector immediately, but the data commit should happen on release so undo/history can store one coherent operation.

### Shared Connection Points

Multiple connectors should be able to attach to the same point without becoming visually chaotic.

Recommended behavior:

- Cascadery treats a dock point as a `port` when one or more connector endpoints reference it.
- When the user drops a connector endpoint within a snap radius of an existing port on the same Area border, it snaps to that port.
- Dragging a shared port moves every connector endpoint attached to that port.
- A shared port shows a small count badge only when selected/hovered or while dragging near it.
- Clicking a shared port selects the bundle and shows a tiny menu: `Move shared point`, `Split selected connector`, `Select connectors`.
- Option/Alt-dragging one endpoint from a shared port splits it into a new independent port.

This avoids forcing users to manage explicit ports up front while still making shared connection points understandable when they appear.

### Connector Routing

MVP routing should stay modest:

- Straight lines remain the default for simple and semantic mode.
- Orthogonal routing remains available for schema mode and advanced route settings.
- Routes start and end at the docked border coordinates.
- Auto-docked links without a fixed point can still choose the nearest side dynamically.
- Fixed port links should preserve their normalized side/position as Areas move or resize.

Avoid automatic global graph layout, edge bundling, or crossing reduction in this spec. Those may become future dense-board features.

### Preventing Accidental Actions

The direct linking interaction must avoid the current annoyance class where a near miss creates an Area or selects text accidentally.

Rules:

- Pointerdown from an Area perimeter hit zone suppresses blank-canvas Area creation for that pointer sequence.
- Pointerdown from a connector line hit target suppresses blank-canvas Area creation.
- While a connector drag is active, no Area creation, text selection, image drag, or resize action should begin.
- Cursor and preview feedback must make the active state obvious before release.
- If the user releases outside a valid target, the operation cancels quietly.

## Data Model

The current `AreaLink` model already supports optional endpoint objects and visual/schema metadata. Extend it to support precise and shared border points.

Recommended additions:

```ts
type AreaLinkSide = 'top' | 'right' | 'bottom' | 'left'

type AreaConnectionPort = {
  id: string
  areaId: string
  side: AreaLinkSide
  position: number // 0..1 along that side
  createdAt: string
  updatedAt: string
}

type AreaLinkEndpoint = {
  areaId: string
  anchor?: AreaLinkAnchor // legacy: auto/top/right/bottom/left/center
  portId?: string
  side?: AreaLinkSide
  position?: number // fallback fixed endpoint when no shared port exists
  behavior?: 'auto' | 'fixed'
}
```

Persistence options:

1. Preferred: add a page-level `connectionPorts` array so shared ports are first-class objects and multiple links can reference the same point cleanly.
2. Acceptable MVP fallback: store `side` and `position` directly on link endpoints and derive shared-port clusters by proximity. This is simpler but makes dragging a shared point less stable across sessions.

Recommendation: use first-class `AreaConnectionPort` objects if this spec is implemented. The user explicitly wants shared draggable connection points, and that behavior is much cleaner with stable port ids.

Compatibility:

- Existing links without ports continue to render through legacy `anchor: 'auto'` behavior.
- `anchor: 'top' | 'right' | 'bottom' | 'left'` migrates conceptually to side midpoint, but does not need a physical port until the user drags or fixes it.
- Existing JSON, collaboration, MCP, history, and export code should preserve unknown future fields defensively if possible.

## Geometry Rules

Coordinate conversion:

- Pointer coordinates must convert through the current canvas zoom and scroll using existing logical canvas point helpers.
- Port `position` is normalized along a side so it survives Area resize.
- On Area resize, ports remain on the same side and retain normalized position.
- On Area move or parent nesting movement, ports move with the Area through absolute position calculation.

Hit testing:

- `getAreaBorderHit(areaBounds, point, hitPadding)` returns nearest side and normalized position if the point is inside the perimeter band.
- `getNearestAreaPort(areaId, side, position, snapDistancePx)` returns an existing port when close enough.
- `getPortCanvasPoint(area, port)` returns the absolute canvas point for rendering.
- Connector line hit targets remain wider than visible strokes.

Snap behavior:

- Snap to existing port within roughly 10-14 px along the same side.
- Snap to side/corner positions only if we later expose visible ticks; do not over-snap in MVP.
- Option/Alt disables snap-to-existing-port for precise independent placement.

## Accessibility And Keyboard Support

Direct drag is the primary fast path, but it cannot be the only path.

Required non-drag alternatives:

- Command palette keeps `Link selected Area`.
- Existing toolbar/link dialog remains available or is replaced by an equivalent flyout command.
- Selected connector flyout exposes editable relationship, direction, label, route/mode, and delete controls.
- Selected connector endpoint can be moved without dragging through controls such as side selector plus position slider/stepper in the advanced dialog or flyout `More` panel.

Keyboard behavior:

- Tab can focus selectable connectors or a links list command can expose them if tabbing all lines is too noisy.
- Enter on a focused connector opens the flyout.
- Delete/Backspace deletes the selected connector.
- Escape cancels connector drag or closes the flyout/deselects connector.
- Arrow keys may nudge a selected endpoint/port when endpoint editing mode is active.

Screen-reader representation:

- Each connector has an accessible label containing source Area, target Area, relationship, direction, and label.
- Shared port controls announce how many connectors use the point.
- Relationship data remains visible in exports and MCP resources, not only in the SVG.

## Visual Design

The visual language should remain quiet and Cascadery-native:

- Border hover affordance: subtle local edge highlight plus one small dot under the pointer.
- Active drag preview: slightly stronger line, ghost endpoint dot, target Area border highlight.
- Valid drop target: highlight the target border segment, not the whole Area unless the pointer is in broad dynamic mode.
- Invalid target: keep preview neutral; do not show red unless the user tries to complete a blocked action.
- Selected connector: existing stronger stroke is fine, plus endpoint handles.
- Shared port: small count badge only on hover/selection.
- Flyout: compact, no modal backdrop, no page-blocking dialog for basic edits.

Do not show large permanent handles on every Area. Do not show all ports unless the user is currently linking, dragging an endpoint, or has selected a connector/port.

## Implementation Plan

### Phase 1: Geometry And Data Foundation

- Add geometry helpers for border hit testing, side/position normalization, port point calculation, and nearest-port snapping.
- Add `AreaConnectionPort` data model if choosing first-class ports.
- Add page JSON, collaboration, history, MCP, and export persistence for ports.
- Keep legacy links rendering unchanged when no port/fixed endpoint exists.

### Phase 2: Direct Link Creation

- Add link-drag state: idle, pointing source border, dragging preview, target candidate, commit/cancel.
- Add perimeter hit zones to Areas without covering interior editing.
- Render preview connector during drag.
- Create link on release over another Area border.
- Suppress accidental Area creation during connector pointer sequences.

### Phase 3: Contextual Link Flyout

- Replace common single-click edit flow with a connector flyout.
- Keep existing advanced dialog behind `More` or double-click.
- Add source/UI tests for flyout wiring and dialog fallback.

### Phase 4: Endpoint And Port Editing

- Show endpoint handles for selected connectors.
- Support dragging endpoints along Area borders and rebinding to another Area.
- Add shared-port snapping and shared-port drag behavior.
- Add Option/Alt split behavior for shared ports.

### Phase 5: Accessibility And Polish

- Add non-drag endpoint movement controls.
- Add keyboard/focus behavior for connector selection and flyout editing.
- Add visual QA across zoom levels, nested Areas, overlapping Areas, and dense connector cases.

## Test Plan

### Unit Tests

Add focused tests for geometry/data helpers:

- Border hit testing identifies side and normalized position for points near each Area edge.
- Interior points outside the perimeter band do not start linking.
- Port point calculation survives Area resize and move.
- Existing anchors migrate/render as side midpoints or auto points.
- Nearest-port snapping returns existing port only within threshold and same side.
- Shared-port movement updates every attached connector endpoint.
- Option/Alt split creates an independent port/endpoint.

### Source/UI Tests

Add source tests for UI wiring:

- Area exposes perimeter connector hit zones only in editable mode.
- Canvas suppresses blank Area creation during connector drag.
- SVG renders connector preview during drag.
- Clicking a connector opens a flyout instead of only the modal dialog.
- Existing advanced connector dialog remains reachable.
- Selected connectors expose endpoint handles.
- View-only mode hides connector creation/editing affordances.

### Persistence Tests

- Page JSON serializes and parses connection ports.
- Collaboration/Yjs round trip preserves ports and endpoint references.
- History restore preserves ports and links.
- Markdown/JSON Canvas exports keep relationship semantics even if precise port geometry is lossy.
- MCP resources include ports or normalized endpoint data without leaking unrelated page data.

### Manual QA

- Create a link by dragging from each side of an Area.
- Create a link at arbitrary points along an edge.
- Move both Areas and confirm fixed ports stay attached.
- Resize Areas and confirm normalized positions remain plausible.
- Drag an endpoint to a new Area.
- Attach multiple connectors to one point, drag the shared point, then split one connector.
- Test with nested Areas, overlapping Areas, zoomed canvas, and dense boards.
- Confirm blank-canvas clicks still create Areas when not starting from border/connector zones.
- Confirm view-only links render but cannot be edited.

## Acceptance Criteria

- Users can create a link by dragging from an Area border to another Area border.
- Border hit zones are easy to acquire without visibly cluttering Areas.
- Releasing outside a valid target cancels linking and does not create a new Area.
- Links can dock to arbitrary points along Area borders.
- Selected connector endpoints can be dragged to new border positions.
- Multiple connectors can share one connection point.
- Dragging a shared connection point moves all attached connectors.
- Users can split one connector from a shared point.
- Clicking a connector opens a compact flyout for common options.
- Existing advanced connector settings remain reachable.
- Link data remains semantic and persists through JSON, collaboration, history, exports, and MCP resources.
- View-only mode cannot create, move, edit, or delete connectors.
- Non-drag alternatives exist for link creation and endpoint movement.

## Non-Goals

- Full automatic graph layout.
- Full ERD/database designer behavior.
- Curved Bézier editing or arbitrary waypoint editing in MVP.
- Free-floating connectors unattached to Areas.
- Self-loop connectors.
- Always-visible port grids on every Area.
- Multi-select bulk connector editing.

## Open Questions

- Should the default visual mode for direct-created links be `simple` or continue the current normalized `semantic` default?
- Should first-class ports live at `page.connectionPorts`, `area.ports`, or a separate `links.ports` map?
- Should clicking a shared port select the port bundle first or the nearest connector first?
- Should endpoint movement controls live in the flyout, existing advanced dialog, or a command-palette action?
- Should schema mode use the same border-docking interaction or require explicit schema ports later?

## Future Work

- Connector waypoints for hand-routed orthogonal paths.
- Automatic line jump/bridge rendering for crossings.
- Dense-board connector visibility filters.
- Port labels for table/entity field names.
- Style presets for connector visual language.
- Agent suggestions for missing or suspicious relationships.
