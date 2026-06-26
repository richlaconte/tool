# Area Duplicate Action Spec

## Idea

Support an Area toolbar action to duplicate Areas, similar to existing move behavior and planned delete behavior.

## HCI/UX Research Basis

- Apple Human Interface Guidelines use `Duplicate` as a clear command name for making a copy, because it clarifies the relationship between the original and new object.
- Material Design toolbar guidance says toolbars should provide actions related to the current page or context.
- Nielsen Norman Group defines direct manipulation as visible objects acted on through incremental, reversible actions with immediate feedback.
- WAI keyboard-interface guidance supports keyboard alternatives for pointer actions.

Sources:
- https://developer.apple.com/design/Human-Interface-Guidelines/the-menu-bar
- https://m3.material.io/components/toolbars/guidelines
- https://www.nngroup.com/articles/direct-manipulation/
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/

## User Experience

Duplication should be quick and predictable:

- Area toolbar includes a `Duplicate` action near delete and drag controls.
- Duplicating creates a new Area with the same text, styles, dimensions, and type.
- The duplicated Area appears slightly offset from the source so users can see it immediately.
- The duplicate becomes selected and focused.
- The source Area remains unchanged.
- Duplicate should also be available through the command palette as `Duplicate selected area` once Area-scoped commands exist.

## Placement

Recommended toolbar arrangement:

- Left: drag handle.
- Right: duplicate button, delete button.

This keeps movement and object actions separate while preserving a small toolbar.

## Data Rules

Duplicating an Area should:

- Generate a new stable id.
- Copy user-visible content.
- Copy styles.
- Copy dimensions after resize support exists.
- Copy image asset references for image Areas, but not duplicate the underlying asset bytes unless explicitly needed.
- Set `createdAt` and `updatedAt` to now.

## Offset Rules

Default duplicate offset:

```ts
const DUPLICATE_OFFSET = {
  x: 16,
  y: 16,
}
```

If snap grid is enabled, offset should snap to the active grid size.

## Undo

Duplicating should enter the undo stack as one reversible operation:

- Undo removes the duplicate.
- Redo restores it with the same id if possible.

## Acceptance Criteria

- Duplicate button appears in the Area toolbar on hover/focus.
- Clicking Duplicate creates exactly one copied Area.
- New Area has copied text/styles/dimensions and a new id.
- New Area is offset, selected, and focused.
- Duplicate does not trigger drag.
- Duplicate is keyboard reachable.
- Duplicate action persists through autosave/page JSON.
- Tests cover new-id generation, copied properties, offset rules, and undo operation shape.

## Open Questions

- Should Option/Alt-drag duplicate an Area like many desktop design tools?
- Should duplicate be available while editing text, or only when the Area shell is selected?
- Should duplicated nested Areas include their full child tree?
