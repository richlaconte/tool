# Area Style Dialog Overhaul Spec

Created: 2026-07-01
Status: Proposed

## Problem

The current `Style Area` dialog has the right ingredients, but the experience still feels like a CSS inspector with a friendly layer bolted on. It shows active styles, quick presets, search, property lists, selected property details, value suggestions, validation, and apply/remove controls in a way that is technically capable but visually busy.

This dialog should be the easy visible counterpart to slash CSS commands. It should give users mild training wheels: enough language, previews, and guardrails to help people make good choices without turning Cascadery into a design app or hiding CSS from users who know it.

## Product Principle

Area styling should stay CSS-native, but the first interaction should be outcome-native.

The user should start from:

```text
I want this Area to read as important / soft / boxed / quieter / more spacious.
```

not:

```text
I need to remember the exact CSS property and value.
```

The dialog should teach by showing the CSS behind each choice, but it should not make CSS recall the entry fee.

## Research Basis

- NN/g's Fitts's Law guidance says targets are easier when they are larger, closer to the likely pointer location, and not crowded. Dense tool rows and small adjacent actions should be avoided.
- WCAG 2.2 target-size guidance treats overlapping targets as a real activation risk and recommends at least 24 by 24 CSS pixels or sufficient spacing.
- NN/g's proximity principle says related controls should be close together, but the UI must still leave enough separation for users to understand grouping and avoid accidental activation.
- NN/g's recognition-over-recall heuristic recommends making actions and options visible so users do not have to remember commands or details from elsewhere.
- NN/g's progressive disclosure guidance supports moving advanced or rarely used controls behind a secondary layer so the first screen stays learnable.
- NN/g's 2025 form guidance frames good form-like UI around structure, transparency, clarity, and support.

References:

- https://www.nngroup.com/articles/fitts-law/
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.nngroup.com/articles/gestalt-proximity/
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.nngroup.com/articles/progressive-disclosure/
- https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/

## Goals

- Make the default dialog understandable in under five seconds.
- Keep common styling changes one click or one simple control away.
- Keep advanced CSS available, but visually secondary.
- Preserve the existing `area.styles` state model.
- Preserve slash-command parity: anything applied here should still be ordinary CSS.
- Reduce visible text, dense rows, and competing panels.
- Use visual previews where they communicate faster than words.
- Make errors recoverable with suggested valid values.

## Non-Goals

- Do not build a full Figma-like inspector.
- Do not add layout systems or design tokens beyond existing theme colors.
- Do not hide raw CSS from advanced users.
- Do not create a separate style schema; CSS declarations remain the source of truth.
- Do not add multi-area style editing in this overhaul.

## Proposed UX

### 1. Dialog Shape

Use a compact command-panel style dialog with one primary column and one optional details drawer.

Default visible regions:

1. Header: `Style Area`, close button, subtle selected-area hint if needed.
2. Active styles: compact chips grouped by visual purpose.
3. Style recipes: small visual buttons for common outcomes.
4. Search: one field that searches recipes first, CSS second.

Avoid a persistent two-column inspector by default. Advanced CSS can expand below search or open a slim drawer only after the user chooses `Advanced CSS`.

### 2. Active Styles

Active styles should answer "what is affecting this Area?" quickly.

Render active styles as grouped chips:

- Color
- Text
- Border
- Shape
- Shadow
- Spacing
- Size
- Other

Each chip shows:

- Friendly label: `Fill`, `Rounded`, `Shadow`
- Current value preview when useful: swatch, corner sample, line sample
- CSS detail on hover/focus or secondary code text
- Remove action with a clear accessible label

Clicking an active chip opens the matching edit control.

Empty state:

```text
No custom styles yet
```

No instructional paragraph.

### 3. Style Recipes

Replace the current broad quick preset grid with a smaller set of grouped recipes.

Default groups:

- **Tone:** Plain, Soft, Emphasis, Warning, Success, Muted
- **Frame:** No border, Subtle border, Strong border, Dashed border
- **Shape:** Square, Soft corners, Rounded, Pill
- **Depth:** Flat, Lifted, Floating
- **Text:** Normal, Strong, Quiet, Large
- **Space:** Compact, Comfortable, Roomy

Recipe buttons should be visually self-describing. The button's first read should be the outcome, not the declaration.

Example:

```text
Soft corners
border-radius: 12px
```

Recipes apply immediately and keep the dialog open.

### 4. Search

Use a single search input:

Placeholder:

```text
Search styles or CSS
```

Search result order:

1. Matching recipes and groups
2. Active styles
3. CSS properties

Examples:

- `round` returns Shape recipes and `border-radius`.
- `warning` returns a tone recipe.
- `border` returns Frame recipes and border CSS properties.
- `font` returns Text recipes and CSS properties.

Selecting a CSS property opens the advanced value editor for that property.

### 5. Advanced CSS

Keep Advanced CSS, but make it an explicit mode.

Entry points:

- `Advanced CSS` button near search.
- Selecting a raw CSS property from search.
- Clicking the CSS detail of an active style.

Advanced editor includes:

- Property search.
- Selected property label and CSS name.
- Value input.
- Suggestions.
- Validation.
- Apply and Remove.

The advanced editor should not show a huge property list until the user searches or expands `Browse properties`.

### 6. Value Suggestions

Suggestions should be visual first and textual second:

- Colors: swatch plus token/value.
- Border: line preview plus value.
- Radius: corner sample plus value.
- Shadow: small elevation sample plus value.
- Font weight: text rendered in the weight.
- Alignment: familiar icons.

Keep raw CSS visible for learning and trust.

### 7. Error Recovery

Invalid values should show:

- Short plain-language message.
- The invalid declaration in code styling.
- One-click valid suggestion when feasible.

Example:

```text
Border needs width, style, and color.
Try 1px solid red.
```

Do not close the dialog after invalid Enter.

### 8. Keyboard Behavior

- `Escape` closes the dialog.
- `Enter` applies the focused recipe, selected suggestion, or valid advanced value.
- Arrow keys move through visible search results or suggestions.
- Tab order follows visible layout: close, active chips, recipes/search, advanced controls.

### 9. Accessibility

- Recipe buttons must be real buttons.
- Search results use listbox/option semantics only if they behave like a selectable list.
- Every remove action has an accessible label including the property.
- Visual samples are decorative unless they carry unique information; labels must carry the meaning.
- Interactive targets should meet at least 24 by 24 CSS pixels with adequate spacing.

## Information Architecture

Recommended modules:

- `areaStylePresets.ts`: reduce and reorganize recipes into outcome groups.
- `areaStyleGroups.ts`: shared grouping metadata for active styles and search.
- `AreaStyleDialog.tsx`: orchestrates dialog state and mode.
- `AreaStyleRecipes.tsx`: recipe groups and recipe search results.
- `AreaStyleAdvancedEditor.tsx`: raw CSS property/value workflow.
- `AreaStyleActiveStyles.tsx`: grouped active chips.

This split is part of the overhaul. The current component is carrying too many responsibilities.

## Implementation Plan

1. Create the new grouping and recipe model.
2. Extract active styles into `AreaStyleActiveStyles`.
3. Extract advanced CSS into `AreaStyleAdvancedEditor` without changing behavior.
4. Replace the quick grid with the smaller outcome-first recipe layout.
5. Add unified search that returns recipes before CSS properties.
6. Add visual suggestion previews to advanced suggestions.
7. Update tests for:
   - default dialog content order
   - recipe application
   - active style grouping
   - advanced CSS access
   - keyboard commit behavior
   - validation recovery
   - view-only hiding

## Acceptance Criteria

- Opening `Style Area` shows active styles and outcome-first recipes before any raw CSS property list.
- The dialog can apply fill, border, radius, shadow, text, and spacing recipes.
- Existing `area.styles` remains the only persisted style state.
- Advanced CSS still supports arbitrary property/value search and validation.
- Invalid advanced values do not close the dialog and include a recovery suggestion when possible.
- The visible dialog contains no instructional paragraphs.
- View-only users cannot open the dialog.
- Tests cover recipe-first UX and advanced CSS parity.

## Open Questions

- Should recipe application replace conflicting properties in a group, or only write the declarations in the recipe?
- Should custom theme color recipes include text contrast pairing, or only fill color?
- Should `Style Area` eventually support saving a custom style recipe?
