# Empty State Zoom Options Spec

## Status

Created on 2026-06-30. Not implemented.

## Idea

Hide and disable canvas zoom options while Cascadery is showing the empty-state start screen.

The empty state is a focused onboarding surface. Zoom controls are useful once a canvas has content, but they are distracting before a user has started. The empty state should keep attention on the direct creation paths: click to create an Area, choose a context kit, or open options/settings.

## Research Basis

- Nielsen Norman Group's empty-state guidance says empty states should communicate system status, increase learnability, and provide direct pathways for key tasks: https://www.nngroup.com/articles/empty-state-interface-design/

## User Experience

When the empty-state message and context kit options are visible:

- The fixed canvas zoom controls should not render.
- Command palette zoom commands should not be visible.
- Keyboard shortcuts for zoom should be ignored.
- Trackpad modifier zoom should be ignored or prevented from changing zoom.

Once the user creates or inserts the first Area:

- Zoom controls appear again.
- Zoom command palette options appear again.
- Keyboard and trackpad zoom behavior returns.

If the user deletes all Areas and the empty state appears again, zoom options should hide/disable again.

## Empty State Definition

Use a single derived helper so the behavior stays consistent:

```ts
const isEmptyStartState =
  shouldShowEditorChrome && !hasClickedCanvas && areas.length === 0
```

If implementation finds that `hasClickedCanvas` makes the empty state difficult to reason about after deleting all Areas, prefer extracting a clearer helper such as:

```ts
const shouldShowEmptyState = shouldShowEditorChrome && areas.length === 0
```

Then update the existing empty-state UI to use the same helper.

## Acceptance Criteria

- Canvas zoom controls are hidden while the empty-state UI is visible.
- Command palette zoom options are hidden while the empty-state UI is visible.
- `Cmd/Ctrl +`, `Cmd/Ctrl -`, `Cmd/Ctrl 0`, `Shift+1`, and `Shift+2` do not change zoom while the empty-state UI is visible.
- Modifier-wheel or trackpad zoom does not change zoom while the empty-state UI is visible.
- Zoom controls and commands return after an Area or context kit is created.
- View-only mode remains unchanged: edit chrome stays hidden.

## Suggested Test Coverage

- Source-level UI test that `CanvasZoomControls` renders only when the empty state is not visible.
- Source-level command palette test that zoom options are filtered by empty-state status.
- App keyboard logic test for ignoring zoom shortcuts when empty state is active.
- Canvas wheel/zoom UI test showing modifier-wheel zoom is gated by empty-state status.

## Non-Goals

- Removing zoom from active canvases.
- Changing zoom levels, zoom math, or smooth trackpad behavior.
- Changing the empty-state copy.
- Changing context kit layout.
