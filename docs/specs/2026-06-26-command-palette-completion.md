# Command Palette Completion Spec

## Idea

Complete the macOS Spotlight / VS Code style command palette so it becomes the main keyboard-first entry point for global actions, page settings, help, and future commands.

## Current State

The app already opens a centered command palette when no Area is selected and the user types. It supports filtering, arrow navigation, Enter activation, backdrop close, and simple Help, Settings, and Page styles dialogs.

## Status

Audited on 2026-06-29. This remains active as a command-system and accessibility cleanup spec.

Implemented:

- Palette opens from typing with no Area selected.
- Palette opens from Escape when no Area is selected.
- The Cascadery brand button opens the palette.
- Filtering, arrow navigation, Enter activation, backdrop close, and overflow scroll-into-view exist.
- Help, Settings, Page styles, Share, image, snap-grid, zoom, and agent suggestion options exist.

Still outstanding:

- `Cmd+K` and `Cmd+Shift+P` shortcuts.
- Alias-aware command records.
- `role="listbox"` and `aria-selected` option semantics.
- Focus return when closing the palette.
- Extract command records and command execution out of `App.tsx`.
- Area-scoped commands after Area metadata exists.

## HCI/UX Research Basis

- Nielsen Norman Group describes accelerators as optional faster paths for expert users, not replacements for visible or discoverable UI. The palette should speed up work without hiding essential actions.
- WAI-ARIA dialog guidance says modal dialogs make the underlying window inert and should provide clear keyboard behavior, including Escape to close.
- WAI-ARIA keyboard-interface guidance emphasizes predictable focus movement and avoiding shortcut conflicts with browser and assistive technology commands.
- Apple search-field guidance treats search fields as editable inputs with helpful placeholder text and clear affordances.

Sources:
- https://www.nngroup.com/articles/ui-accelerators/
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- https://developer.apple.com/design/human-interface-guidelines/search-fields

## User Experience

The palette should feel like a compact command launcher:

- It opens in the center when the user starts typing with no Area selected.
- It can later also open from an explicit shortcut, such as `Cmd+K` or `Cmd+Shift+P`, plus a visible button if the app gains a toolbar.
- It filters commands by title, aliases, and short descriptions.
- Up/Down moves through visible options.
- Enter activates the selected command.
- Escape closes the palette without changing state.
- Clicking the dimmed backdrop closes it.
- Dialog commands open lightweight modal dialogs and return focus cleanly when closed.

## Command Model

Commands should move out of `App.tsx` into a data model:

```ts
type Command = {
  id: string
  title: string
  description: string
  aliases: string[]
  scope: 'global' | 'page' | 'area'
  run: () => void
}
```

## Required Commands

- `Help`: show quick interaction guide.
- `Settings`: open editor-level settings.
- `Page styles`: open page-wide style settings.
- `Share`: open share dialog after share links exist.
- `Toggle snap grid`: visible after snap-grid support exists.
- `Insert image`: visible after image support exists.

## Accessibility

- Palette container uses `role="dialog"` and `aria-label`.
- The command list should use `role="listbox"` and options should expose selected state with `aria-selected`.
- Focus enters the input when the palette opens.
- Focus should return to the previous active element when the palette closes.
- Visible keyboard focus should remain inside the palette or dialog while open.

## Acceptance Criteria

- Typing with no Area selected opens the palette with the typed key as query.
- `Cmd+K` or `Cmd+Shift+P` opens the palette without entering text.
- Up/Down selection works only across visible filtered commands.
- Enter activates the selected command.
- Escape and backdrop click close without activating.
- Text in palette and options is not selectable.
- Help, Settings, and Page styles are real command records, not hard-coded branches.
- Automated tests cover filter, exact match, arrow wrapping, and activation fallback.

## Open Questions

- Should the primary shortcut be `Cmd+K`, `Cmd+Shift+P`, or both?
- Should command aliases be visible as small secondary labels?
- Should the palette support Area-scoped commands when an Area is selected, or remain global only?
