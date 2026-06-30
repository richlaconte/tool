# Area Styles Dialog UX Audit and Simplification Spec

Created: 2026-06-30
Status: Active foundational spec

## Problem

The current Area styles dialog technically exposes Cascadery's CSS-native styling model, but it is not easy to understand at first glance. It asks users to think in terms of CSS property names before it gives them a simple visual path to common styling outcomes.

This matters because the Area styles dialog is supposed to be the approachable counterpart to `/property value` slash styling. Today, the expert path and the beginner path still feel too similar: both require knowing what CSS property to reach for.

## Product Principle

Area styling should preserve Cascadery's philosophy that CSS is a feature, not leakage. But the visible UI should translate common styling intent into CSS, not make users start with raw CSS recall.

The redesign should support three levels of user:

- Non-CSS users who want to make an Area clearer or more expressive.
- CSS-curious users who can learn CSS names by seeing them attached to friendly controls.
- CSS-fluent users who still want fast property/value search without losing power.

## Current Dialog Audit

### What Works

- It writes to the existing `area.styles` state, so slash commands, persistence, collaboration, exports, and agent operations remain aligned.
- It has active styles, searchable properties, suggestions, and validation.
- It has keyboard support for property and value suggestions.
- It keeps the dialog out of view-only mode.

### What Is Hard To Understand

1. The primary task is unclear.
   The dialog title says `Area styles`, but the first meaningful action is still a CSS property search. A user who wants to "make this look like a warning" or "make this less plain" receives little help.

2. The layout exposes too much at once.
   Active styles, property search, property results, selected property details, value input, suggestions, Apply, Remove, and validation all appear in one dense inspector. This raises cognitive load before the user has chosen an intent.

3. The dialog starts property-first instead of outcome-first.
   The default selected property is `background-color`, and the left panel lists CSS properties. That is useful for experts, but weak for users who think in visual goals like fill, border, text, rounded corners, spacing, or shadow.

4. Suggestions are text-heavy.
   Values like `1px solid currentColor` and `0 8px 24px rgba(0, 0, 0, 0.14)` are valid CSS, but the UI does not make them visually meaningful. Users need preview cues such as swatches, border strokes, radius samples, weight samples, and shadow samples.

5. Active styles are technically accurate but not grouped by purpose.
   Alphabetized CSS rows are predictable, but they do not answer "what styling is affecting this Area?" as quickly as grouped chips or rows by Color, Type, Shape, Spacing, Layout, and Effects.

6. Advanced search is too prominent.
   Showing up to 80 CSS properties makes the UI powerful, but it makes the beginner route feel like a browser DevTools subset instead of an approachable Cascadery tool.

7. Validation feedback is not connected enough to recovery.
   Invalid values are explained, but the dialog should also show a nearby valid alternative or a "use suggested value" route so errors become teachable moments.

## Research Basis

- Progressive disclosure reduces complexity by deferring advanced or rarely used features until users need them.
- Recognition is easier than recall; users should see meaningful choices instead of needing to remember CSS property names.
- Recent form-design guidance emphasizes structure, transparency, clarity, and support to reduce cognitive load.
- Form fields need persistent labels; placeholders can be examples, but they should not carry the user's main orientation.
- Editable combobox and autocomplete patterns need clear accessible names, values, listbox relationships, and predictable keyboard behavior.
- Material guidance for chips supports compact controls for suggestions, filtering, and selections.
- Material text-field guidance supports always-visible labels, helper text, and stateful error text.
- Apple's HIG panel guidance supports short noun titles for editing panels and recognizable inspector-style surfaces.

References:

- https://www.nngroup.com/articles/progressive-disclosure/
- https://www.nngroup.com/articles/recognition-and-recall/
- https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
- https://www.nngroup.com/articles/form-design-placeholders/
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- https://m3.material.io/components/chips
- https://m2.material.io/components/text-fields
- https://docs.developer.apple.com/design/human-interface-guidelines/panels

## Recommendation

Rebuild Area styles as a visual style editor with an advanced CSS layer.

The core shift:

Current model:

```text
Pick CSS property -> type CSS value -> apply
```

Recommended model:

```text
Choose visual intent -> pick a simple control or suggestion -> optionally inspect/edit CSS
```

## Proposed Experience

### Entry Point

Keep the existing Area toolbar style button and dialog route.

The dialog title should become `Style Area` or `Area Style`. Prefer `Style Area` because it reads as an action and better matches the user's goal.

The top of the dialog should show:

- A concise title.
- A close button.
- The selected Area's current style summary as compact chips or grouped rows.

Avoid paragraph-length instructions. Use labels, group titles, and examples instead.

### Default View: Quick Styles

The default view should be `Quick styles`, not property search.

Show a small set of visual groups:

- Fill
- Text
- Border
- Corners
- Shadow
- Spacing
- Size
- Layout

Each group should expose a few high-value controls or suggestions:

- Fill: theme color swatches, transparent, white, light gray, custom color.
- Text: color swatches, size chips, weight buttons, alignment icon buttons.
- Border: none, subtle, strong, dashed, color, width.
- Corners: square, subtle, rounded, pill.
- Shadow: none, low, medium.
- Spacing: compact, normal, roomy.
- Size: width and height controls for advanced users, but keep them lower priority because Area resizing already exists.
- Layout: only include controls that make sense for Area content; avoid presenting broad CSS layout concepts unless there is clear user value.

Each control should show the friendly name first and the CSS declaration second, either as secondary code text or a tooltip:

- `Rounded` with `border-radius: 12px`
- `Subtle border` with `border: 1px solid #d1d5db`
- `Large text` with `font-size: 20px`

One-click visual suggestions should apply immediately and update active styles. Typed custom values should validate before applying.

### Active Styles

Replace the current alphabetized active style rows with a more readable summary:

- Group active declarations by purpose: Color, Type, Shape, Spacing, Size, Layout, Effects, Other.
- Render compact active chips or rows.
- Each active item shows friendly label, CSS property, current value, and remove affordance.
- Clicking an active style opens the matching control group and selected CSS declaration.

When there are no styles, show a small empty state:

`No custom styles yet`

Do not say "CSS" in the empty state; keep it outcome-oriented.

### Advanced CSS Layer

Preserve the current full property/value workflow, but move it behind an `Advanced CSS` disclosure or tab.

Advanced CSS should include:

- Property search.
- Property list.
- Value input.
- Suggestions.
- Validation.
- Apply and Remove.

This keeps Cascadery honest to CSS while making the beginner path less intimidating.

Advanced CSS should still support:

- Searching by friendly label, alias, category, and CSS property name.
- Arbitrary CSS values.
- Theme color tokens.
- Trailing semicolon cleanup.
- `CSS.supports` validation.

### Value Suggestions

Suggestions should become visual when possible:

- Color suggestions show swatches.
- Border suggestions show a line sample.
- Radius suggestions show a mini corner sample.
- Shadow suggestions show a small shadow sample.
- Font weight suggestions render the label in that weight.
- Alignment suggestions use icons rather than only text.

Keep the raw CSS value visible as secondary text for learning and trust.

### Search

Search should work across both user intent and CSS details.

Examples:

- `round` finds Corners and `border-radius`.
- `warning` suggests fill/text/border combinations, if we add semantic recipes.
- `border` finds the Border quick group and CSS properties.
- `text size` finds the Text group and `font-size`.

The first results should be quick actions and groups. Raw CSS properties should appear below or inside Advanced CSS.

### Error Recovery

Invalid typed values should produce:

- Short plain-language error text.
- The CSS property/value that failed.
- At least one valid nearby suggestion when possible.

Example:

For `border red`, show:

`Border needs width, style, and color. Try 1px solid red.`

Then show a suggestion chip:

`1px solid red`

### Keyboard and Accessibility

The dialog must support:

- Escape closes.
- Tab moves through controls predictably.
- Enter activates focused chips/buttons.
- Enter in custom value input applies valid values.
- Invalid values keep focus near the input and announce the error.
- Advanced property search follows the WAI-ARIA combobox/listbox pattern more closely than the current generic listbox.
- Inputs have visible labels. Placeholders may show examples, but never replace labels.
- Suggestion chips are real buttons or options with accessible labels.

## Information Architecture

Recommended high-level layout:

```text
Header
  Style Area                         Close

Active Styles
  grouped chips/rows

Tabs or segmented control
  Quick styles | Advanced CSS

Quick styles
  Fill        [swatches/chips]
  Text        [color, size, weight, alignment]
  Border      [none/subtle/strong/dashed/custom]
  Corners     [square/subtle/rounded/pill]
  Shadow      [none/low/medium]
  Spacing     [compact/normal/roomy]

Advanced CSS
  Property combobox
  Value input
  Suggestions
  Apply / Remove
```

If vertical space becomes tight, prefer a single dialog-level scroll over multiple independently scrolling lists. Cascadery's editor should avoid nested scroll regions when a searchable, reduced-result UI can do the same work.

## Technical Design

### New Preset Module

Create a new module:

`src/areaStylePresets.ts`

Responsibilities:

- Define quick style groups.
- Define preset controls and their CSS declarations.
- Map CSS properties to friendly groups.
- Provide search over groups, presets, aliases, and CSS property names.
- Provide visual metadata for suggestions, such as `swatch`, `borderPreview`, `radiusPreview`, `shadowPreview`, or `textPreview`.

Suggested types:

```ts
export type AreaStyleGroupId =
  | 'fill'
  | 'text'
  | 'border'
  | 'corners'
  | 'shadow'
  | 'spacing'
  | 'size'
  | 'layout'
  | 'other'

export type AreaStylePreset = {
  id: string
  groupId: AreaStyleGroupId
  label: string
  description?: string
  declarations: Record<string, string>
  aliases?: string[]
  preview?: {
    kind: 'swatch' | 'border' | 'radius' | 'shadow' | 'text'
    value: string
  }
}
```

### Dialog Refactor

Refactor `src/components/AreaStyleDialog.tsx` into smaller internal sections or extracted components:

- `AreaStyleActiveSummary`
- `AreaStyleQuickPanel`
- `AreaStyleAdvancedPanel`
- `AreaStyleSuggestionButton`

Keep state local to the dialog. Do not introduce new persisted state.

### CSS Catalog

Keep `src/cssStyleCatalog.ts` as the advanced CSS engine.

Add helpers only if needed:

- Map property to style group.
- Generate friendly recovery suggestions for invalid values.
- Return richer suggestion preview metadata.

### App State and Persistence

No state schema change.

All controls continue to call:

- `onApplyStyle(property, value)`
- `onRemoveStyle(property)`

Multi-declaration presets call `onApplyStyle` once per declaration.

## Visual Direction

The dialog should feel like a compact creative inspector, not a form-heavy settings screen.

Guidelines:

- Use a quiet two-tab or segmented control for `Quick styles` and `Advanced CSS`.
- Keep cards minimal; use unframed sections or thin separators.
- Use icons for alignment and text style controls where obvious.
- Use swatches and preview chips instead of text-only options.
- Keep CSS code secondary but visible.
- Do not use large educational copy inside the dialog.
- Do not make the dialog a marketing surface.

## Test Plan

### Unit Tests

Add `src/areaStylePresets.test.ts`:

- Presets are grouped by stable group ids.
- Presets search by friendly label, alias, and CSS property.
- Presets return valid declaration maps.
- Active style grouping maps common CSS properties into expected groups.
- Unknown properties fall into `other`.

Extend `src/cssStyleCatalog.test.ts` if recovery suggestions are added:

- Invalid border values produce a valid nearby suggestion.
- Theme color tokens are still preserved where expected.

### Source/UI Tests

Update or add `src/areaStyleDialogUi.test.ts`:

- Dialog includes `Quick styles`.
- Dialog includes `Advanced CSS`.
- Quick style groups include Fill, Text, Border, Corners, Shadow, and Spacing.
- Advanced CSS still includes property search, value input, suggestions, validation, Apply, and Remove.
- Active styles are grouped or rendered through a dedicated summary component.
- No full 80-property list is shown as the default first view.
- Value suggestions have preview-oriented class names or metadata.

### Manual Visual QA

Run the app locally and inspect:

- Empty styles on a newly created Area.
- An Area with background, border, radius, color, and shadow.
- Invalid custom value recovery.
- Keyboard navigation through quick chips and advanced search.
- Mobile/narrow viewport layout.
- View-only mode still hides the dialog.

## Acceptance Criteria

- Opening Area styles first presents a simplified quick-styles view, not a raw CSS property list.
- Users can apply common style changes without knowing CSS property names.
- Active styles are grouped by purpose and remain removable.
- Advanced CSS search/value editing still exists and remains at least as capable as the current dialog.
- Visual suggestions use swatches/previews where meaningful.
- Invalid values include recovery suggestions when possible.
- The dialog writes only to existing `area.styles`.
- Slash CSS commands continue to work unchanged.
- View-only mode cannot open the dialog.
- Focus, keyboard, and screen reader behavior are intentionally covered.
- Tests cover presets, grouping, source/UI wiring, and CSS validation changes.

## Future Work

- Semantic style recipes such as Warning, Success, Question, Decision, and Muted.
- A tiny live preview strip inside the dialog.
- "Copy styles from another Area."
- "Clear all styles" with undo support.
- Optional keyboard shortcut from selected Area to open the dialog.
