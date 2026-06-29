# Nested Areas Spec

## Idea

Areas should support nesting. A parent Area can contain multiple child Areas that move around inside the parent and stay anchored to it when the parent moves.

## HCI/UX Research Basis

- Figma frames support nested frames and parent/child/sibling relationships, which is a close product analogue for canvas objects containing other canvas objects.
- Nielsen Norman Group's common-region principle says items within a visible boundary are perceived as a group.
- Nielsen Norman Group's proximity principle says nearby elements are perceived as related, which supports child Areas staying spatially inside their parent.
- Nielsen Norman Group's visual hierarchy guidance emphasizes grouping and clear hierarchy to reduce confusion.

Sources:
- https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design
- https://www.nngroup.com/articles/common-region/
- https://www.nngroup.com/articles/gestalt-proximity/
- https://www.nngroup.com/articles/visual-hierarchy-ux-definition/

## User Experience

Nested Areas should feel like lightweight containers, not a full design-tool layer system at first:

- A parent Area can contain child Areas.
- Child Areas are positioned relative to the parent's content box.
- Moving the parent moves all children.
- Moving a child keeps it within the parent unless the user explicitly unnests it.
- Parent boundaries visually communicate grouping.
- Selecting inside a parent should make it clear whether the parent or child is active.

## Creating Nesting

Supported creation paths:

- Drag an Area into another Area and release to nest.
- Create a new Area while the pointer is inside an existing Area.
- Future command palette command: `Nest selected area`.
- Future toolbar/context menu action: `Add child area`.

## Reparenting Rules

- If an Area is dropped fully inside another Area, it becomes a child.
- If an Area is dragged out past the parent boundary and released, it becomes top-level.
- Do not allow cycles.
- Limit initial nesting depth to 2 or 3 levels to reduce complexity.
- Parent and child ids remain stable across reparenting.

## Data Model

Recommended tree-friendly model:

```ts
type AreaState = {
  id: string
  parentId: string | null
  x: number
  y: number
  width: number
  text: string
  styles: Record<string, string>
}
```

Position meaning:

- `parentId: null`: `x/y` are page coordinates.
- `parentId: area_id`: `x/y` are relative to the parent Area's inner coordinate system.

## Rendering Model

- Render from a normalized `areasById` map plus ordered child id arrays.
- Avoid recursive state mutation; use pure helpers for reparenting and coordinate conversion.
- Parent Area should use `position: relative`; child Areas render absolute within it.
- Z-order should be explicit.

## Interaction Details

- Clicking parent border selects parent.
- Clicking child content selects child.
- Escape from child editing deselects child but does not accidentally select parent.
- Parent movement should preserve child relative coordinates.
- Child movement should use parent-relative snapping when snap grid is enabled.

## Accessibility

- Keyboard navigation should be able to move between parent and children.
- Future layer/outline panel may be needed if nesting gets deeper.
- Visible labels or breadcrumbs may be necessary for complex nested states.

## Acceptance Criteria

- User can nest an Area inside another Area.
- Moving a parent moves all child Areas visually.
- Moving a child updates child relative coordinates only.
- Dragging a child out can unnest it.
- Page JSON persists parent/child relationships.
- No cyclic parent relationships can be created.
- Selection makes parent vs child clear enough for users to act confidently.
- Tests cover reparenting, coordinate conversion, parent movement, child movement, and cycle prevention.

## Open Questions

- What is the maximum allowed nesting depth?
- Should parent Areas clip child overflow or allow children to extend outside?
- Should resizing a parent affect child positions, child scale, or only visible bounds?
- Should nesting wait until resize and delete are implemented?
