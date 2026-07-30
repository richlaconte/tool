# Area Command Box: Isolating Slash Commands from Section Content

## Status

Priority: P1 — queue #9 (scored 2026-07-30). See the Priority Queue in
README.md before starting work.

Created on 2026-07-30 from a product/UX research pass over slash-command and
element-anchored command surfaces. Active.

## Problem

Slash commands are Cascadery's signature interaction — "CSS as an editing
language" — but today they only exist **inline inside the Area's text**:

- The user must double-click (or Enter) into text-editing mode, type
  `/border: 2px solid red` into the textarea, and press Enter. The command
  text shares the same surface as the section's prose, so mid-typing the
  Area's content contains a half-parsed declaration.
- Command detection is caret-line based (`findCssSlashCommand` in
  `src/cssSlashCommand.ts`, plus parallel finders for image, gif, and
  evidence commands). The command is removed from `area.text` on commit
  (`commitAreaCssCommand` in `src/App.tsx`), which means the text model
  temporarily carries UI state that is not content.
- Nothing happens when the user presses `/` with an Area **selected** (not
  editing). There is no key handler for `/` anywhere outside text editing
  (verified: no `key === '/'` handling in `src/`). The fastest path to
  styling a selected section is therefore four gestures (double-click, type,
  Enter, Escape) instead of two (type, Enter).
- Because commands live in the text, collaborators watching the page see
  raw command strings flicker in and out of section content, and every
  command type (CSS, image, gif, evidence) needs its own inline find/remove
  pair.

The requested behavior: with a section selected, `/` should open a small
isolated box attached above or below the section — a dedicated command
surface that never touches the section's text.

## Goal

Introduce an **Area Command Box**: a floating, element-anchored command
input that opens when `/` is pressed with one or more Areas selected,
commits the command to the selected Area(s) on Enter, and leaves
`area.text` completely untouched. The box is the section-level counterpart
of the global command palette: same discovery affordances, but anchored to
the thing it will act on.

Non-goals for this spec:

- Removing inline slash commands from text-editing mode (they stay as a
  power path; see "Unification path" in Future Work).
- A general block-type inserter (Notion-style `/table`, `/heading`).
  Cascadery's command grammar is CSS declarations plus a small set of
  asset/evidence commands; scope the box to that grammar.
- Mobile/touch command entry (responsive view mode is read-focused, queue
  #7).

## Research Basis

Slash commands as a pattern:

- Notion's slash-command guide establishes the baseline grammar users
  already know: type `/`, get a filtered menu, arrow/Enter to select;
  commands both insert and *modify* existing content (`/turn`,
  `/red` — the closest analog to our CSS commands):
  https://www.notion.com/help/guides/using-slash-commands
- CKEditor's slash-command write-up frames the core value: actions without
  leaving the keyboard or hunting through toolbars, with lower memorization
  cost than Markdown-style shortcuts:
  https://ckeditor.com/blog/slash-commands/
- The AI-UX pattern catalog documents the modern expectation set: `/` shows
  a menu with descriptions, keyboard navigable, for power users in
  developer tools: https://www.aiuxplayground.com/pattern/slash-command
- Discoverability is the recurring failure mode. Multiple production
  projects report that memory-only slash commands don't scale and converge
  on the same fix: an autocomplete popover with descriptions, real-time
  filtering, arrows + Enter, Escape/outside-click dismissal — anchored
  *above the input* in chat surfaces:
  https://github.com/coleam00/Archon/issues/1204
  https://github.com/anthropics/claude-code/issues/40538
  https://github.com/zeroclaw-labs/zeroclaw/issues/2068

Element-anchored floating UI (the "little box above/below"):

- CKEditor 5's design team concluded that contextual controls work best on
  a floating surface "anchored to caret position or to the selected
  element, like an image or table cell" — our Areas are exactly that case:
  https://github.com/ckeditor/ckeditor5-design/issues/99
- Tiptap's `FloatingElement` / `FloatingMenu` are the reference
  implementation for selection- and element-anchored menus: placement
  relative to a reference element, with `offset`, `flip`, and `shift`
  middleware so the surface never covers its anchor or leaves the viewport:
  https://tiptap.dev/docs/ui-components/utils-components/floating-element
  https://tiptap.dev/docs/editor/extensions/functionality/floatingmenu
- Floating UI's popover guidance defines the interaction contract we
  should adopt wholesale: anchored positioning with collision avoidance,
  Escape and outside-press dismissal, correct ARIA roles, and managed
  focus: https://floating-ui.com/docs/popover
- Selection-anchored toolbar practitioners stress the feel: don't jump,
  don't cover the content, disappear instantly when the context collapses,
  keep the action set small: https://www.whatworked.io/posts/using-llms-in-browsers

Command surface scoping:

- Search field vs. command palette guidance: command surfaces earn their
  complexity when the action space is large and keyboard-first speed
  matters; they must still expose descriptions so discovery doesn't depend
  on memory: https://uxpatterns.dev/pattern-guide/search-field-vs-command-palette
- Slack's own best practices translate well to commit feedback: always
  acknowledge the command (even a tiny confirmation beats silence), and
  provide a help path that teaches usage:
  https://docs.slack.dev/interactivity/implementing-slash-commands

NN/g heuristics already cited by the product direction apply directly:
visibility of system status (the box shows parse validity live) and
accelerators that don't hide from novices (the box doubles as the discovery
surface):
https://www.nngroup.com/articles/visibility-system-status/

## Competitive Pattern Audit

| Product | Trigger surface | Command container | Placement | Notes for Cascadery |
|---|---|---|---|---|
| Notion | Caret in a block | Dropdown menu inline in doc flow | Below caret, flips up near viewport bottom | Menu *is* the isolation — command never persists in content. We need the same, but our trigger is selection-state, not caret. |
| Figma | `⌘/` or `⌘K` anywhere | Centered quick-actions dialog | Center overlay | Fast, but loses the target association. Wrong for per-section commands. |
| Linear | `⌘K` anywhere | Centered command bar | Center overlay | Same as Figma; global, not element-scoped. |
| Slack / Discord | Caret in composer | Autocomplete popover | **Above** the input | Above-anchoring is the convention when the thing below matters. Directly supports default placement above the Area. |
| Tiptap/BlockNote editors | Caret / element | Floating menu anchored to selection or node | Configurable; `flip` + `shift` standard | Engineering template for anchor math and collision handling. |
| GitHub textareas | Caret in textarea | Inline suggestion popover | At caret | Shows the minimum viable version of isolated suggestions. |
| Cascadery today | Caret in Area textarea | None — raw text in content | n/a | Command pollutes content model; no selection-state path. |

**Synthesis.** Two patterns dominate: (1) caret-anchored menus inside
flowing text (Notion), and (2) element-anchored floating surfaces for
selected objects (Tiptap FloatingElement, CKEditor contextual toolbars,
Slack-style above-anchored popovers). Cascadery's Areas are spatial objects,
not document blocks — pattern (2) is the correct fit, with pattern (1)'s
filter/menu grammar inside the box.

## Recommended Solution: The Area Command Box

### Entry points

1. **Primary (new): selection-state `/`.** With one or more Areas selected
   and no text editing active, pressing `/` opens the Command Box anchored
   to the *primary* selected Area (the one whose toolbar would apply).
   The input starts empty with a `/` glyph fixed at its left edge, so the
   typed grammar matches the inline grammar users already know.
2. **Toolbar affordance (discovery).** The existing Area toolbar gains a
   small `/` button that opens the same box. Research is unambiguous that
   keyboard accelerators need a visible counterpart or novices never find
   them.
3. **Editing-mode promotion (phase 2, optional in this spec).** While
   editing text, typing a line that parses as a complete command shows a
   "move to Command Box" affordance; the full unification is Future Work.

### Placement model

- Anchor: the primary selected Area's bounding box, in viewport
  coordinates, updated continuously as the canvas pans/zooms or the Area
  moves/resizes (Floating UI `autoUpdate` semantics — no drift, no jump).
- Default placement: **above** the Area, horizontally aligned to its left
  edge, `offset(8)`. Rationale: the Area's content is what the command
  will change; the box must never cover it, and above-anchoring is the
  established convention when the content below is the focus (Slack,
  Discord, chat-input popovers).
- Collision handling: `flip()` to below when the viewport top is within
  box height + margin; `shift()` to keep the box fully on-screen
  horizontally. Near the canvas top, the box lands below the Area, still
  outside its bounds.
- The box never overlaps the anchor Area in any placement. If the Area is
  larger than the viewport (zoomed in), anchor to the Area's visible top
  edge instead of its true edge.
- One box at a time. Changing the selection while open either moves the
  box to the new primary Area (if the input is empty) or closes it (if the
  user has typed — don't silently redirect a half-written command).

### Anatomy

```
┌──────────────────────────────────────────────┐
│ / border: 2px solid red            ⌫ Area A1 │  ← input row + target chip
├──────────────────────────────────────────────┤
│ ✓ border · 2px solid red                     │  ← live parse result
│   Applies to 3 selected areas                │  ← scope line
│ ⏎ Apply   esc Cancel                         │  ← key hints
└──────────────────────────────────────────────┘
```

- **Input row:** single-line, monospace (this is a code grammar), `/`
  prefix fixed. Same token grammar as today — reuse
  `findCssSlashCommand`'s `CSS_PROPERTY_PATTERN` and `CSS.supports`
  validation verbatim.
- **Live parse line:** as the user types, show property validity and
  declaration validity (the existing `propertyIsValid` /
  `declarationIsValid` signals) with a ✓ / ✗ and the normalized
  declaration. This is the biggest UX upgrade over inline: today validity
  is only implied by whether the style applies after Enter.
- **Target chip:** names the primary Area (or "N selected areas"). Click
  target = the answer to "what will this change?", the question
  element-anchored UIs must always answer.
- **Suggestions:** when the input is empty or partial, list matching
  commands from a registry (CSS properties by frequency, `image`, `gif`,
  evidence commands) with one-line descriptions — the discoverability fix
  the research demands. Arrow keys navigate; Enter on a suggestion inserts
  it into the input rather than committing immediately.
- **Size:** compact — max ~360px wide, capped suggestion list (~7 items,
  scroll). It is a popover, not a palette.

### Commit and dismiss semantics

- **Enter** with a valid declaration: apply to all selected Areas (reuse
  `getAreaActionTargetIds` — multi-select styling already exists in
  `commitAreaCssCommand`), close the box, fire the existing
  `slash_command_used` telemetry. The Area's own CSS re-render *is* the
  confirmation (Slack's "always acknowledge" principle, satisfied by
  direct manipulation); for commands with no visible effect (unknown
  property), show a transient error line in the box instead of closing.
- **Enter with invalid input:** shake/inline error, do not close, do not
  mutate state. Never silently eat a command.
- **Escape:** close, return focus to the canvas with the Area still
  selected, zero side effects. Idempotent.
- **Outside press / selection cleared / view-only switch:** close without
  committing (Floating UI `useDismiss` contract).
- **Undo:** committing through the box produces exactly the same state
  change as inline commit (styles map merge, no text change), so existing
  undo/redo covers it with no new history semantics.

### What happens to `area.text`

Nothing. The box owns its own transient input state outside the document
model (component state, not Yjs). This removes the whole class of
"collaborator sees my half-typed command" and "command text flickers in
content" problems, and it means command finders no longer need
remove-from-text on the selection path.

## Alternatives Considered

1. **Hoist the command out of the textarea while editing** (inline text
   stays the input method, but a chip renders above the Area as soon as
   the line parses). Rejected as the primary design: the user asked for
   isolation *at the selection level*, and caret-line parsing is fragile
   mid-prose. Kept as the phase-2 unification path.
2. **Reuse the global command palette (⌘K) with an Area scope.** Rejected:
   center-overlay palettes sever the visual link to the target; the audit
   table shows every per-element implementation anchors to the element.
   The palette stays global; the box is scoped.
3. **Inline autocomplete menu inside the textarea (pure Notion).**
   Rejected for selection-state: there is no caret when an Area is merely
   selected, and Notion's model assumes a document flow Cascadery doesn't
   have.
4. **Always-above vs. auto-placement.** Auto-placement (pick the side with
   more room) tested poorly in the research (surfaces that jump sides feel
   unstable); fixed default + flip only on collision is the Tiptap/Floating
   UI standard. Adopted.

## Edge Cases

- **Multi-select:** box anchors to the primary Area, scope line reads
  "Applies to N selected areas", commit hits `getAreaActionTargetIds`.
- **Nested Areas:** the innermost selected Area is the anchor and target;
  commands apply to it alone unless multi-selected. The box must not open
  for the implicit parent-selection states used by drag logic.
- **View-only / read mode:** `/` does nothing; the toolbar button is
  hidden. Mirrors every existing edit guard (`isViewOnly`).
- **Collaboration:** box state is local-only — collaborators never see
  another user's open box, only the resulting style change. No Yjs schema
  change required for the box itself.
- **Pan/zoom while open:** box tracks the anchor via the same
  requestAnimationFrame/auto-update loop used by other anchored chrome;
  zooming past the "Area larger than viewport" threshold re-anchors to the
  visible edge rather than covering content.
- **Image Areas:** box opens but the CSS grammar applies to the image
  Area's frame (today's inline path skips image Areas for text removal
  only — styles still apply; keep that behavior).
- **Reduced motion:** no shake animation on error; instant color/state
  feedback instead.

## Accessibility

- Popover follows the Floating UI contract: `role="dialog"` (non-modal) or
  combobox+listbox pattern for input+suggestions, `aria-expanded`,
  `aria-activedescendant` on the suggestion list, `aria-invalid` on the
  input when the declaration fails to parse.
- Focus moves into the input on open and back to the canvas/Area on close.
- Full keyboard operation: `/` open, arrows navigate suggestions, Enter
  insert/commit, Escape cancel. No pointer-only affordances.
- Color is never the only validity signal (✓/✗ glyphs + text).
- Honors the keyboard-first spec's focus-visible conventions; the box is
  chrome, so it consumes the semantic token layer from the adaptive color
  scheme spec (queue #4) once landed — do not hard-code hex.

## Telemetry

- Reuse `slash_command_used` on commit; add a `source` dimension
  (`selection_box` vs `inline_text` vs `toolbar_button`) so we can measure
  migration from the inline path.
- Add `command_box_opened` and `command_box_abandoned` (opened, no commit)
  to detect discoverability or grammar problems.

## Acceptance Criteria

- With an Area selected and no text editing active, pressing `/` opens the
  Command Box above the Area (below only on viewport collision), input
  focused.
- Typing `/border: 2px solid red` + Enter in the box applies the border to
  the selected Area; `area.text` is unchanged before, during, and after.
- With multiple Areas selected, commit applies the style to all of them.
- Escape and outside-press close the box with no state change; undo after
  commit reverts the style via the existing history.
- Empty input shows the suggestion list with descriptions; arrow + Enter
  inserts a suggestion.
- An invalid declaration on Enter shows inline feedback and commits
  nothing.
- The box tracks its anchor through pan, zoom, and Area move/resize
  without covering the anchor Area.
- Page JSON, collaboration sync, and view-only behavior are unchanged
  (box state never enters the document model).

## Test Plan

- Unit: reuse `cssSlashCommand.test.ts` fixtures against the box's
  parse/validate path (same functions); new tests for placement decision
  (above default, flip below, shift horizontal) as a pure function of
  anchor rect + viewport.
- Unit (state): open/close transitions on selection change rules
  (empty input follows selection; dirty input closes).
- E2E (Playwright, alongside `e2e/slash-command.spec.ts`): create Area,
  Escape out of editing, select Area, press `/`, type command, Enter,
  assert CSS on the Area element and unchanged text content; multi-select
  variant; Escape-cancel variant; invalid-command variant.
- Telemetry assertions follow the existing `telemetry-report` harness
  patterns.

## Future Work

- **Inline unification:** promote caret-line commands into the box during
  text editing, making the box the single command surface; the telemetry
  `source` dimension tells us when inline usage is low enough to retire.
- **Command registry consolidation:** today CSS, image, gif, and evidence
  each have find/remove pairs (`cssSlashCommand.ts`, `imageSupport.ts`,
  `gifSearch.ts`, `areaEvidence.ts`); the box's suggestion registry is the
  natural place to unify them behind one command descriptor interface.
- **`/` on empty canvas:** open the box anchored to the cursor position to
  create a pre-styled Area (create + style in one gesture).

## Priority Scoring

| Axis | Score | Rationale |
|---|---|---|
| Wedge | 1 | Deepens the CSS-as-editing-language differentiator; not agent-path work. |
| Clock | 0 | No external deadline. |
| Unblocks | 1 | The command registry consolidation and future create-and-style flows build on the box. |
| Daily | 2 | Slash commands are the product's signature move; this cuts their fastest path from four gestures to two and fixes the content-pollution complaint. |

Total 4 → **P1**.
