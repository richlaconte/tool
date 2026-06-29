# View-Only Presentation Mode Spec

## Idea

View-only share links should feel like a clean read-only presentation of a Cascadery canvas. A viewer should not see editor menus, command palette entry points, persistence controls, MCP indicators, import/export actions, or Area editing affordances. The only visible app-level action should be a simple way to create their own Cascadery canvas.

## Status

Created on 2026-06-29 as an active viewer-experience spec.

## Current State

- The app already has `isViewOnly` based on share access mode.
- View-only users cannot select or mutate Areas through the main Area interaction path.
- The server rejects collaboration updates from view-only sessions.
- The view-only UI still exposes editor chrome:
  - the `cascadery` brand button opens the command palette.
  - the page persistence bar still shows status and export controls.
  - view-only mode can still render command palette options such as Help, Settings, Share, and Zoom.
  - collaboration, MCP, and save-status indicators can still appear.
  - zoom controls remain visible.

## Product Rationale

View-only links are for reading, reviewing, and sharing a canvas. They should not imply editing or page-management capabilities that are unavailable to the viewer. A sparse viewer also makes shared canvases feel more intentional and reduces the chance that someone mistakes a public link for their own workspace.

The one useful product action is ownership transfer: if the viewer likes the canvas or wants to build, they can create their own Cascadery canvas.

## Research Basis

- Nielsen Norman Group's aesthetic and minimalist design heuristic supports removing controls that are irrelevant to the user's current goal.
- Nielsen Norman Group's recognition-rather-than-recall heuristic supports keeping a single plain-language action visible instead of exposing a hidden command system in read-only mode.
- WAI-ARIA modal dialog guidance treats modal surfaces as focused interruptions. If view-only mode has no command palette or dialogs, it should also remove shortcuts and click targets that can open those modal surfaces.
- Existing shared-link products separate viewing from editing capabilities and avoid advertising actions that the current permission level cannot perform.

Sources:
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.nngroup.com/articles/visibility-system-status/
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://support.box.com/hc/en-us/articles/360043697094-Creating-Shared-Links

## User Experience

The view-only route should show the canvas content first:

- Hide editor chrome, including:
  - the command palette.
  - the `cascadery` brand command-palette button behavior.
  - page persistence controls.
  - import and export controls.
  - share controls.
  - Help, Settings, Page Styles, and command-dialog entry points.
  - MCP status and MCP activity indicators.
  - save status.
  - collaboration presence badges.
  - Area toolbars, resize handles, drag handles, delete controls, duplicate controls, and text editing affordances.
- Show one visible app action: `Create your own Cascadery canvas`.
- The create action should be styled as a quiet, fixed button in a corner. It should not open the command palette and should not look like a menu.
- Clicking the create action should create or navigate to a fresh editable canvas owned by the current browser/session. It must not mutate the viewed page.
- The shared canvas itself remains readable and navigable.
- Direct canvas navigation remains allowed:
  - browser scrolling.
  - canvas scrolling.
  - trackpad or modifier-wheel zoom if available.
  - browser zoom as an accessibility fallback.
- Visible zoom controls should be hidden in view-only for this pass, because the user request is that viewers see only the create-your-own option as app chrome.

## Interaction Rules

Command palette:

- Typing while no Area is selected must not open the command palette in view-only mode.
- `Escape` must not open the command palette in view-only mode.
- `Cmd/Ctrl + K`, `Cmd/Ctrl + Shift + P`, or any future command-palette shortcut must not open the command palette in view-only mode.
- Clicking the brand mark must not open the command palette in view-only mode.
- If view-only mode is entered while the command palette or a dialog is open, close it.

Dialogs:

- Help, Settings, Page Styles, Share, Import, Export, and agent dialogs should not be openable in view-only mode.
- Existing dialog components do not need to be deleted. They should simply be unreachable from view-only UI and keyboard paths.

Canvas:

- The viewer can scroll around the canvas.
- The viewer can use non-mutating navigation gestures.
- The viewer cannot create, select, move, resize, edit, duplicate, delete, upload, link, or style Areas.
- The viewer should not see selected-Area UI, even for remote selections.

Create-your-own:

- The CTA label should be `Create your own Cascadery canvas`.
- It should use a normal button element with an accessible label matching the visible text.
- It can navigate to `/` if that reliably creates a new local/editable page.
- If the app needs a stronger route, add a dedicated new-canvas helper so the viewed page is never overwritten.

## Implementation Direction

Prefer a single derived flag for viewer chrome:

```ts
const shouldShowEditorChrome = !isViewOnly
```

Use it to gate:

- command palette rendering.
- command palette keyboard handlers.
- brand button behavior.
- page persistence bar.
- collaboration presence chrome.
- MCP chrome.
- save status chrome.
- zoom controls.
- empty-canvas editor hints.
- theme color swatches.

Keep read-only enforcement in both UI and server layers. UI hiding is for clarity; server rejection remains the security boundary.

## Accessibility

- The create-your-own action uses a native `button` or link with a clear accessible name.
- View-only mode should not trap focus in hidden command palette or dialog elements.
- The page should not expose hidden menu controls to screen readers.
- Canvas content remains reachable through normal browser navigation and scrolling.
- If future visible viewer zoom controls are reintroduced, they must be treated as a separate viewer-toolbar decision and must still preserve the "not an editor" feel.

## Acceptance Criteria

- Opening a view-only link shows the canvas and exactly one visible app-level action: `Create your own Cascadery canvas`.
- The command palette cannot be opened from view-only mode by typing, `Escape`, command shortcuts, or brand click.
- Help, Settings, Share, Page Styles, Import, Export, and agent dialogs cannot be opened from view-only mode.
- Page persistence, MCP, collaboration presence, save status, import/export, share, zoom controls, and editor chrome are hidden in view-only mode.
- Area toolbars, resize handles, drag handles, duplicate/delete actions, and text editing affordances are hidden in view-only mode.
- View-only users can still scroll the canvas to inspect content.
- The create-your-own action opens a new editable canvas without changing the viewed page.
- Existing server-side rejection of view-only mutations remains intact.

## Suggested Test Coverage

- `shareLinksUi.test.ts`
  - asserts view-only mode hides page persistence controls, export buttons, MCP chrome, collaboration presence, and zoom controls.
  - asserts view-only mode renders `Create your own Cascadery canvas`.
- `commandPaletteUi.test.ts`
  - asserts command palette rendering is gated behind `!isViewOnly`.
  - asserts command-palette shortcut handlers return early in view-only mode.
- `App.tsx` source or interaction tests
  - asserts brand click does not call `setCommandPaletteQuery` in view-only mode.
  - asserts `Escape` does not open the command palette in view-only mode.
- Server collaboration tests
  - keep the existing view-only mutation rejection coverage.

## Non-Goals

- Public marketing page.
- Authentication or account ownership.
- Viewer comments, reactions, or annotations.
- A separate read-only minimap.
- A full viewer toolbar.
- Analytics for share-link conversion.

## Open Questions

- Should `Create your own Cascadery canvas` duplicate the viewed canvas in the future, or always create a blank canvas?
- Should a view-only page show a tiny non-interactive `View only` label for permission clarity, or does that violate the desired one-action surface?
- Should direct viewer zoom controls return later as an accessibility option, or is browser zoom enough for the first chrome-free viewer?
