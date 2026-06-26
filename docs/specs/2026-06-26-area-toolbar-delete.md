# Area Toolbar Delete Spec

## Idea

Add a delete option to each Area toolbar, likely on the top right, while keeping the existing drag handle.

## HCI/UX Research Basis

- Nielsen Norman Group's user-control-and-freedom heuristic says users need a clear way to undo changes, especially destructive changes.
- Nielsen Norman Group's error-prevention heuristic supports making destructive controls intentional and recoverable.
- Nielsen Norman Group notes drag-and-drop/direct manipulation works well for moving and resizing, but complementary controls improve usability.
- WAI-ARIA keyboard guidance supports keyboard-accessible alternatives to pointer-only controls.

Sources:
- https://www.nngroup.com/articles/user-control-and-freedom/
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.nngroup.com/articles/drag-drop/
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/

## User Experience

The toolbar should remain quiet until needed:

- On hover or focus within an Area, show a top toolbar.
- Left side: drag handle.
- Right side: delete button.
- Delete button uses a familiar trash icon or simple `Delete` label until icons are introduced.
- Deleting an Area shows a small undo toast rather than a blocking confirmation.
- Keyboard Delete/Backspace can delete a selected empty Area later, but should not conflict with text editing.

## Deletion Model

```ts
type DeletedAreaSnapshot = {
  area: AreaState
  index: number
  deletedAt: number
}
```

Keep the most recent deleted Area available for undo.

## Interaction Rules

- Clicking delete removes the Area and clears selection if it was selected.
- Undo restores the Area at its original index and position.
- If the Area contains text or an image, deletion still uses undo rather than confirmation.
- If undo history becomes broader later, deletion should enter the normal undo stack.

## Acceptance Criteria

- Delete control appears on hover and keyboard focus.
- Delete control is reachable by keyboard.
- Clicking delete removes exactly that Area.
- Undo restores the deleted Area.
- Delete does not trigger drag.
- Delete action persists in page JSON after autosave.

## Open Questions

- Should deletion be command-palette accessible as `Delete selected area`?
- Should multiple selection be supported before designing bulk delete?
- How long should the undo toast remain visible?
