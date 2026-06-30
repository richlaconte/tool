# Child Area Drop Target Feedback Spec

Created: 2026-06-30
Status: Active foundational spec

## Problem

Cascadery already supports nested Areas at the model and release-behavior level: when an Area is dropped fully inside another Area, the moved Area can become a child, and child coordinates remain relative to the parent. The missing UX layer is anticipatory feedback. Users should know before releasing the pointer whether a drag will reparent the Area.

The new behavior should make child Areas feel intentional and canvas-native:

- When a user drags an Area over a valid parent Area, the parent shows a clear but quiet drop-target indication.
- Releasing while that indication is active nests the dragged Area into the parent.
- Once nested, moving the parent keeps the child inside it through relative positioning.
- Dragging a child out of the parent gives equally clear feedback before unnesting.

This spec refines the completed Nested Areas MVP. It should not reopen the whole nesting model or turn Cascadery into a complex layer editor.

## Research Basis

NN/g's drag-and-drop guidance says drag interactions need clear signifiers and feedback at every stage, and that drop zones can use a "magnetic" active area to reduce errors as long as activation is visually indicated. Cascadery should therefore show the candidate parent while dragging, rather than waiting until release.

Fitts's Law supports larger forgiving targets. NN/g summarizes that bigger targets are faster to acquire and reduce error rates. For child Area nesting, the effective parent drop zone should be forgiving even if the visible indication stays subtle.

WCAG 2.2 Dragging Movements requires an equivalent single-pointer alternative for drag-based functionality unless dragging is essential. Cascadery should keep command-palette or toolbar alternatives for nesting and unnesting so users are not forced to perform a precise drag.

Figma frames are the closest mature product analogue: frames act as parent objects that can contain child objects, and nested frames create explicit parent/child relationships. Cascadery should borrow the clarity of parent/child spatial containment without copying Figma's full layer-system complexity.

NN/g's common-region principle says elements inside a shared boundary are perceived as related. Parent Areas should use their boundary to communicate grouping, and the drop-target indication should reinforce that the dragged Area is about to join that group.

MDN's accessibility guidance for `prefers-reduced-motion` recommends disabling nonessential motion for users who request reduced motion. The user mentioned blinking as a possible cue, but a repeated blink can be distracting and problematic. The default should be a calm pulse or highlight with a nonanimated reduced-motion fallback.

References:

- https://www.nngroup.com/articles/drag-drop/
- https://www.nngroup.com/articles/fitts-law/
- https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design
- https://www.nngroup.com/articles/common-region/
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility

## Product Principle

Child Areas should feel like placing one thought inside another, not like manipulating an invisible data tree.

Principles:

- Preview hierarchy before committing it.
- Prefer calm, spatial feedback over modal confirmation.
- Make the target forgiving without covering the canvas.
- Keep nesting reversible and understandable.
- Preserve the current lightweight Area model.
- Provide non-drag alternatives for accessibility and precision.

## Current Implementation Audit

The existing code already has a good foundation:

- `src/nestedAreas.ts` stores `parentId` on Areas and converts coordinates when reparenting.
- `nestAreaIfContained` applies nesting on drag end.
- `getContainingAreaId` only chooses a parent when the moving Area is fully contained in a valid candidate.
- `MAX_NESTING_DEPTH` prevents unbounded hierarchy.
- `src/nestedAreas.test.ts` covers reparenting, unnesting, coordinate conversion, cycle prevention, and depth behavior.
- `src/App.tsx` calls `nestAreaIfContained` from `endAreaMove`.
- `src/components/Area.tsx` does not currently receive or render a drop-target candidate state.

The gap is transient interaction state. Cascadery decides the hierarchy after release, but the user cannot see that decision forming during the drag.

## Recommended Approach

Use live parent-candidate highlighting with hysteresis.

While an Area is being dragged, Cascadery should continuously evaluate whether the dragged Area is fully inside a valid parent candidate. When a valid candidate is found, the candidate parent gets a temporary visual state such as `area--nesting-target`. If the candidate changes or becomes invalid, the visual state should clear after a short tolerance window to avoid flicker.

Do not use a rapid literal blink as the default. Use:

- A subtle outline/ring around the candidate parent.
- A light surface tint inside the parent boundary.
- A short, low-frequency pulse when the parent first becomes active.
- A static outline/tint when `prefers-reduced-motion: reduce` is active.

The visual cue should communicate "release here to nest" without obscuring text, images, links, resize handles, or toolbar controls.

## Interaction Design

### Dragging Into A Parent

Primary flow:

1. User starts dragging Area A using the existing move handle.
2. Cascadery tracks Area A's live canvas rectangle.
3. When Area A becomes fully contained inside valid Area B, Area B enters candidate-parent state.
4. Area B shows the nesting-target highlight.
5. If Area A remains inside Area B and the user releases, Area A becomes a child of Area B.
6. Area A's absolute canvas position is preserved during reparenting by converting its coordinates to Area B's coordinate space.
7. Moving Area B later moves Area A with it.

Feedback timing:

- Candidate highlight may appear immediately once containment is true.
- To avoid noisy flicker, the active candidate should not switch more often than roughly every 80-120 ms.
- If the dragged Area briefly leaves the candidate by a few pixels, keep the highlight for roughly 80 ms before clearing.
- The final drop decision must still use the true release-time geometry.

### Dragging Out Of A Parent

Primary flow:

1. User drags child Area A beyond the parent Area B boundary.
2. When Area A is no longer fully contained by Area B, Area B shows a subtle "will unnest" state.
3. Releasing outside the parent unnests Area A into the top-level canvas.
4. Area A's absolute canvas position remains stable.

The unnest cue should be quieter than the nest cue. A fading outline or edge-release treatment is enough. Avoid warning dialogs.

### Candidate Selection Rules

When multiple Areas could be valid parents:

- Ignore the dragged Area itself.
- Ignore descendants of the dragged Area to prevent cycles.
- Ignore candidates that would exceed `MAX_NESTING_DEPTH`.
- Prefer the deepest valid candidate.
- If depth ties, prefer the smallest containing candidate.
- If still tied, prefer the visually topmost candidate.

MVP should keep the existing full-containment rule for committing a nest because it is predictable and already tested. A future version may introduce partial-overlap magnetism, but only if the visual indication is strong enough to avoid surprising reparenting.

### Visual Treatment

Recommended CSS states:

- `area--is-dragging`: applied to the dragged Area.
- `area--nesting-target`: applied to the parent candidate that will receive the child on release.
- `area--unnesting-source`: applied to the current parent when a child is being dragged out.

Candidate parent treatment:

- Use an outline or box-shadow outside the Area boundary so content remains readable.
- Add an inner tint using a pseudo-element with `pointer-events: none`.
- Use a restrained pulse for the first 1-2 cycles only, then settle into a static active state.
- Use a distinct outline shape or opacity change, not color alone.
- Respect existing selected, hover, linked, and toolbar states without making the Area look selected.

Reduced-motion treatment:

```css
@media (prefers-reduced-motion: reduce) {
  .area--nesting-target {
    animation: none;
  }
}
```

The reduced-motion state should still be visually clear through outline, tint, or both.

### Preventing Accidental Nesting

Nesting should feel intentional, not magical.

Rules:

- Only commit nesting on drag end, never while dragging.
- Do not nest if the dragged Area was only tapped or moved below the existing drag threshold.
- Do not nest into a parent that is locked, view-only, deleted, or otherwise noneditable.
- Do not let candidate overlays intercept pointer events.
- Keep toolbar actions above overlapping Areas while dragging.
- If a user starts a drag from a toolbar button, resize handle, connector handle, or text editing surface, nesting hit testing should not start.

### Non-Drag Alternatives

To satisfy accessibility and support precision:

- Command palette: `Nest selected Area into...`
- Command palette: `Unnest selected Area`
- Toolbar or Area menu option: `Add child Area`
- Keyboard route: selected Area can open a parent picker and choose a valid parent without dragging.

These alternatives can be simple in MVP. They do not need a full layers panel.

## Data Model

No new persistent schema is required for MVP.

Existing state remains sufficient:

```ts
type AreaState = {
  id: string
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
  text: string
  styles: Record<string, string>
}
```

New transient UI state is recommended:

```ts
type NestingPreviewState = {
  draggedAreaId: string | null
  candidateParentId: string | null
  unnestingFromParentId: string | null
}
```

Do not persist `candidateParentId`; it is purely interaction feedback.

## Geometry Helpers

Add pure helpers before wiring UI:

```ts
type NestingCandidateResult = {
  parentId: string | null
  reason:
    | 'valid'
    | 'none'
    | 'self'
    | 'descendant'
    | 'depth-limit'
    | 'not-contained'
}
```

Recommended helpers:

- `getNestingCandidate(areas, movingAreaId): NestingCandidateResult`
- `getCandidateParentId(areas, movingAreaId): string | null`
- `getUnnestingSourceId(areas, movingAreaId): string | null`

The helper should use the same coordinate model as `nestAreaIfContained` so the preview matches the final release behavior. If the preview and release disagree, users will lose trust quickly.

## Collaboration Behavior

Nesting preview state should be local-only. Other collaborators should see the final nested state after release, not another user's transient drag highlight.

Rationale:

- A drop-target preview is an input affordance for the active pointer user.
- Broadcasting it could create visual noise when several users are moving Areas.
- The persisted `parentId` change is the meaningful collaborative event.

If remote cursors or remote drag previews are added later, remote nesting previews can be revisited as a separate presence feature.

## View-Only Behavior

View-only pages must not show nesting affordances:

- No move handles.
- No candidate parent highlight.
- No command-palette nesting actions.
- No child creation or reparenting.

View-only users still see the current parent/child layout.

## Implementation Plan

1. Add pure nesting candidate helpers and tests.
2. Track `draggedAreaId`, `candidateParentId`, and `unnestingFromParentId` in `App`.
3. Recompute candidate state during Area drag using the same temporary moved Areas array used for visual movement.
4. Pass candidate booleans into `Area`.
5. Add CSS classes and reduced-motion handling.
6. Add command-palette alternatives for nest and unnest.
7. Add manual QA for overlap, nesting depth, unnesting, zoom, snap grid, collaboration, and view-only mode.

## Acceptance Criteria

- Dragging an Area fully inside a valid parent Area highlights that parent before release.
- Releasing while the highlight is active nests the dragged Area into the highlighted parent.
- Moving the parent after nesting moves the child with preserved relative positioning.
- Dragging a child outside the parent previews unnesting before release.
- Invalid parents never highlight.
- Candidate highlighting does not flicker during small pointer movements.
- The visual state does not cover Area content or toolbar actions.
- The cue is still clear with `prefers-reduced-motion: reduce`.
- Nesting preview state remains local and is not persisted or broadcast.
- View-only canvases do not expose nesting affordances.
- Tests cover candidate selection, invalid candidates, depth limit, descendants, and release behavior.

## Open Questions

- Should the future magnetism threshold allow partial containment, or should Cascadery permanently require full containment for nesting?
- Should Areas have a toolbar command that explicitly marks them as "containers" before they can receive children?
- Should deep nesting beyond two levels remain blocked, or should future layer/outline navigation unlock it?
- Should unnesting require full exit from the parent, or should a smaller threshold make it easier to pull children out?
