# Keyboard-First Canvas and Accessibility

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 4.2). Active.
Depends on multi-select (Tier 1.1) for nudge semantics and the search spec
(Tier 1.4) for jump/zoom helpers.

## Goal

Make the canvas itself operable and legible without a pointer: keyboard
traversal and nudging of Areas, a screen-reader-accessible page outline,
distinct focus-visible states, a shortcut cheat sheet, and a WCAG 2.2 AA pass
on all chrome. Dialog accessibility is already handled; this spec covers the
canvas.

## Research Basis

- WAI-ARIA Authoring Practices (dialogs already follow it; grid/listbox
  keyboard patterns and roving tabindex inform Area traversal):
  https://www.w3.org/WAI/ARIA/apg/
- WCAG 2.2 AA — notably 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured,
  1.4.3 Contrast, 2.1.1 Keyboard: https://www.w3.org/TR/WCAG22/
- NN/g flexibility-and-efficiency: accelerators need visible counterparts —
  the cheat sheet and palette parity are the counterparts:
  https://www.nngroup.com/articles/flexibility-efficiency-heuristic/
- Product principle (product-DX spec): expert shortcuts must have visible
  counterparts; don't override standard shortcuts.

## Current State

- Keyboard routing is centralized and pure: `getAppKeyboardAction` /
  `getDialogKeyboardAction` in `src/appKeyboardLogic.ts` (tested in
  `appKeyboardLogic.test.ts`) — extend these, do not scatter new listeners.
- Areas are divs in `src/components/Area.tsx`; selection is pointer-driven;
  there is no roving focus, no aria labeling of Areas, no keyboard
  move/resize.
- Dialogs manage focus and Escape per the completed command-palette and
  style-dialog specs.
- Snap grid (`src/snapGrid.ts`) defines the natural nudge quantum when
  enabled; `PageSettings.snapGrid.size` holds the grid size.
- The Markdown export (`exportPageAsMarkdown`) already produces a linear,
  ordered representation of the page — the semantic backbone for the
  outline view.
- Selection state: single id today; `selectedAreaIds` after Tier 1.1.

## Scope

### Focus and traversal model

- Roving tabindex over root Areas: the canvas container is a single tab stop
  (`role="application"` is tempting but wrong — prefer a labeled region;
  implementer should verify with VoiceOver that arrow-key handling works
  without swallowing screen-reader navigation, and document the choice).
  Within it, one Area holds `tabIndex=0` (the focused one), all others
  `tabIndex=-1`.
- `Tab` from the canvas moves to the next app chrome control (normal
  document order); Area-to-Area traversal uses **arrow keys with a modifier
  held? No —** plain `Tab` cycling through hundreds of Areas is hostile.
  Model: canvas focused → `Enter` focuses the first/last-focused Area; from
  a focused Area, `Tab`/`Shift+Tab` moves through Areas in reading order
  (y, then x); `Escape` returns focus to the canvas container.
- Focused ≠ selected: focus follows the roving pattern; `Enter` on a focused
  Area selects it, `Enter` again begins text editing, `Escape` steps back
  out (edit → selected → focused-canvas). `Space` toggles selection
  membership (multi-select).
- All of this routes through new pure functions in `appKeyboardLogic.ts`
  (e.g. `getCanvasFocusAction`), unit-tested against the state machine above.

### Keyboard manipulation

- Arrow keys nudge the selected Area(s): 1 px per press, `Shift+Arrow` = 10 px,
  or the snap-grid size when snap is enabled (`Shift` = 4× grid). Nudges
  coalesce into one undo step per direction burst (undo spec's
  `captureTimeout` handles this).
- `Alt+Arrow` resizes the (single) selected Area by the same quanta from its
  bottom-right edge; respect the existing min-size constants in
  `src/areaResize.ts`.
- Existing shortcuts unchanged; new ones must not fire during text editing
  (same guard pattern already in `getAppKeyboardAction`).

### Screen-reader support

- Each Area gets an accessible name: `aria-label` composed as
  "<kind>, <status if any>: <first line of text, ≤ 80 chars>" via a pure
  helper `getAreaAccessibleLabel(area)` in a new `src/areaA11y.ts`.
- Live region announcements (a single visually-hidden `aria-live="polite"`
  element managed in one place): selection changes, mode changes
  (editing/selected), agent proposal arrival, offline status changes.
- **Outline view:** a dialog ("Page outline", palette + `Ctrl/Cmd+Shift+O`)
  rendering the page as a semantic nested list in reading order — reusing the
  structure logic behind `exportPageAsMarkdown` refactored into a shared
  `getPageOutline(state)` helper so export and outline cannot drift. Items
  are buttons: activating one closes the dialog, focuses and selects that
  Area, and pans to it (`getZoomToArea`). This doubles as the small-screen
  reading mode for the responsive spec — build it as a reusable component.

### Visual states and contrast

- Define three visually distinct states in `App.css`: focused (keyboard
  focus ring, `:focus-visible`-driven), selected (existing outline), editing
  (existing). Focus ring must meet 3:1 non-text contrast against both the
  default canvas and Area backgrounds.
- Contrast audit of all chrome (status bar, toolbar, palette, dialogs,
  badges) to WCAG AA; fix via the existing CSS custom properties; record
  before/after values in a table in this spec on completion.
- `prefers-reduced-motion`: already honored by the search spec's jump
  animation; extend to any remaining transitions (drop-target pulses, toast
  slides).

### Cheat sheet

- "Keyboard shortcuts" dialog (palette entry + `?` when canvas-focused and
  not editing): a static, generated-from-data table — define shortcuts as
  data in `src/keyboardShortcuts.ts` (key combo, description, palette
  counterpart) and render both the cheat sheet and the palette hints from
  that single source so they cannot desynchronize.

## Non-Goals

- Screen-reader-driven spatial editing parity (traversal + outline +
  manipulation covers operability; full spatial semantics is research-grade).
- Voice control, switch access beyond what correct semantics provide.
- Touch accessibility (responsive spec).
- High-contrast theme (audit fixes only; theming is separate).

## Acceptance Criteria

- Create, focus, select, move, resize, style (via palette), link (via
  existing link commands), and delete an Area using only the keyboard —
  scripted walkthrough recorded in the completion notes.
- VoiceOver announces Area kind/status/excerpt on focus; selection and mode
  changes announce via the live region (manual protocol + assertions on the
  label helper).
- Outline dialog lists all Areas in reading order with nesting; activation
  jumps, selects, and focuses.
- Focus, selected, and editing states are visually distinct; focus ring meets
  3:1; chrome passes AA contrast (documented table).
- Cheat sheet and palette hints render from one data source; `?` opens it.
- No new shortcut fires while editing text; no standard browser/OS shortcut
  is overridden beyond the already-shipped set.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- Extend `src/appKeyboardLogic.test.ts` for the full focus state machine,
  nudge/resize actions, editing guards, and the `?` binding.
- `src/areaA11y.test.ts`: label composition (kinds, statuses, truncation,
  empty text).
- `src/keyboardShortcuts.test.ts`: every palette-visible action with a
  shortcut appears in the data source (parity assertion against
  `COMMAND_PALETTE_OPTIONS`).
- Outline: `getPageOutline` unit tests shared with export tests (order,
  nesting, excerpts).

## Open Questions

- `role` for the canvas container (region vs application) — decide by
  VoiceOver/NVDA behavior during implementation and document the result.
- Should `Tab` between Areas wrap around? Recommend: yes, with a live-region
  announcement ("wrapped to first area").
