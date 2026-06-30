# Cascadery Brand Leave Confirmation Spec

## Status

Created on 2026-06-30. Completed on 2026-06-30.

## Idea

When a user clicks the top-left `cascadery` brand button while they are in an active canvas, show a confirmation dialog before leaving. If they confirm, navigate to `/` and show the empty start state.

Today the brand button opens the command palette. That behavior still makes sense on the empty start screen. Once a user is inside an active canvas, the brand behaves more like a home/back affordance and should protect users from leaving by accident.

## Research Basis

- Nielsen Norman Group recommends confirmation dialogs for actions with serious consequences, especially when work may be lost or the action cannot easily be undone: https://www.nngroup.com/articles/confirmation-dialog/
- WAI-ARIA modal dialog guidance expects modal dialogs to contain focus and close on Escape: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

## User Experience

### Empty Start Screen

When no active canvas content exists and the empty-state UI is visible:

- Clicking the top-left `cascadery` button keeps the current behavior and opens the command palette.

### Active Canvas

An active canvas is any editable canvas with meaningful content:

- At least one Area, asset, or link exists.
- Or the app is on a page route such as `/p/[pageId]`.

When the user clicks the `cascadery` brand in this state:

- Open a modal confirmation dialog.
- Do not open the command palette.
- Do not navigate until the user confirms.

Recommended copy:

Title: `Are you sure you want to leave?`

Body: `You will return to the Cascadery start screen. Your canvas URL will still open this page.`

Buttons:

- Primary/safe: `No, stay`
- Secondary/destructive-ish: `Yes, leave`

Default focus should go to `No, stay`, because accidental activation should preserve the user's current context.

### Confirm Behavior

Clicking `Yes, leave`:

- Navigates to `/`.
- Clears the active editor page route.
- Shows the empty start screen.

Clicking `No, stay`, pressing Escape, or clicking outside the dialog:

- Closes the dialog.
- Keeps the current canvas open.

## Implementation Notes

- Reuse the existing dialog/backdrop styling where possible.
- Prefer a dedicated `openDialogId` value such as `leave-canvas` only if it does not tangle with command-palette dialogs.
- If the app is running on `/` with local persisted content, confirm before resetting/navigating only if the click would actually change visible state.
- Do not erase page data as part of this feature. The action is navigation to the empty start screen, not deletion.

## Acceptance Criteria

- Clicking `cascadery` on the empty start screen opens the command palette.
- Clicking `cascadery` on an active editable canvas opens a confirmation dialog.
- The confirmation dialog has `No, stay` and `Yes, leave` actions.
- `No, stay`, Escape, and backdrop click close the dialog without navigation.
- `Yes, leave` navigates to `/` and shows the empty start screen.
- The dialog traps focus or follows the app's existing modal focus pattern.
- View-only presentation mode remains clean and does not show editor navigation chrome.

## Suggested Test Coverage

- Source/UI test that brand click branches on active-canvas state.
- App keyboard/dialog logic test that Escape closes the leave confirmation.
- Source/UI test for the confirmation copy and `No, stay`/`Yes, leave` buttons.
- Route/navigation test, if practical, that `Yes, leave` targets `/`.

## Non-Goals

- Deleting the current canvas.
- Changing share link behavior.
- Adding account/workspace navigation.
- Replacing the command palette entry point entirely.
