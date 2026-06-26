# Area Resize Spec

## Idea

Add Area resize controls, likely using a draggable corner, so users can change Area width and eventually image dimensions.

## HCI/UX Research Basis

- Nielsen Norman Group describes drag-and-drop as direct manipulation useful for resizing objects.
- Material Design notes drag handles can be used to resize panes/layout areas.
- WAI-ARIA keyboard guidance supports keyboard equivalents for interactions that would otherwise require pointer precision.
- Nielsen Norman Group's visibility-of-system-status heuristic supports live size feedback while resizing.

Sources:
- https://www.nngroup.com/articles/drag-drop/
- https://m3.material.io/foundations/layout/layout-overview/parts-of-layout
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- https://www.nngroup.com/articles/ten-usability-heuristics/

## User Experience

Resize should be discoverable but not noisy:

- Show a small resize handle at the bottom-right of a focused or hovered Area.
- Cursor changes to diagonal resize.
- Dragging resizes width; text Areas continue auto-height unless explicit height is added later.
- Images resize both width and height while preserving aspect ratio by default.
- Snap-grid affects resize endpoints when enabled.

## Data Model

Text Areas need width first:

```ts
type AreaState = {
  id: string
  x: number
  y: number
  width: number
  text: string
  styles: Record<string, string>
}
```

Image Areas need width and height:

```ts
type ImageAreaState = {
  id: string
  type: 'image'
  x: number
  y: number
  width: number
  height: number
}
```

## Constraints

- Minimum width: 80px.
- Maximum width: page or viewport-dependent, but never negative.
- Text Areas should not resize below usable text-entry width.
- Preserve image aspect ratio unless a future freeform mode is explicit.

## Keyboard Alternative

When an Area is selected but not text-focused:

- Shift+ArrowRight/Left increases/decreases width.
- Option/Alt+Shift+Arrow could use smaller increments.
- Announce size changes through visible status or accessible text only if a broader accessibility layer is added.

## Acceptance Criteria

- Hover/focus shows a resize handle.
- Dragging the handle changes Area width.
- Resize does not move the Area origin unexpectedly.
- Text remains editable after resizing.
- Width persists in page JSON.
- Snap-grid setting affects resize when enabled.
- Tests cover min/max constraints and snapping math.

## Open Questions

- Should text Areas ever have explicit height?
- Should resize handles appear only for selected Areas or also on hover?
- Should double-click reset width to default?
