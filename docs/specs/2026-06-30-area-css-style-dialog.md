# Area CSS Style Dialog Spec

## Status

Created on 2026-06-30. Not implemented.

## Idea

Add an Area toolbar option that opens a guided CSS style dialog for the selected Area. The dialog should keep Cascadery CSS-native while giving people who are less comfortable typing raw CSS an easier recognition-based path.

The dialog should:

- Show the Area's active styles at the top.
- Let users search and filter through CSS properties.
- Offer value suggestions and autocompletes for common values.
- Validate values before applying them.
- Write to the same `area.styles` state used by slash CSS commands, persistence, collaboration, exports, and agent operations.

This is the visible counterpart to `/property value` and `/property: value` slash styling. Slash commands stay the fastest expert path; the dialog makes the same styling system learnable and forgiving.

## Product Rationale

Cascadery's product direction says "CSS is a feature, not leakage" and "expert shortcuts must have visible counterparts." A style dialog supports both principles:

- CSS-fluent users keep direct slash commands.
- CSS-curious users can discover valid property names and values without memorizing syntax.
- Non-CSS users can search by plain-language aliases such as "corner", "text size", "background", or "shadow" and still learn the actual CSS property underneath.
- Teams get one shared source of truth because every interaction writes ordinary CSS declarations into `area.styles`.

The goal is not to become a full design inspector. It is to make Cascadery's existing CSS-native editing feel approachable enough that styling an Area is never gated by remembering the exact property or value.

## UX Basis

Use these HCI principles to guide the implementation:

- Recognition over recall: show searchable property names, aliases, descriptions, active values, and suggested values.
- Progressive disclosure: keep active styles and search visible first; reveal detailed property/value controls only after a property is selected.
- Error prevention: validate declarations before applying them and explain invalid values inline.
- Flexibility and efficiency: preserve slash commands for experts while adding a visible toolbar route for everyone else.
- Direct manipulation: changes apply to the selected Area immediately after commit and appear in the active styles list.

## Entry Point

Add a new icon-only Area toolbar button for "Area styles."

Recommended placement:

- In the existing selected/hovered Area toolbar near move, duplicate, and delete.
- Use a clear visual metaphor such as sliders, paintbrush, or sparkle-free style controls.
- The button should have `aria-label="Open Area styles"` and a title/tooltip of "Area styles."
- It should follow the same visibility, hover bridge, z-index, and view-only rules as the existing toolbar actions.
- It must not appear in view-only mode.

Clicking the button opens a centered dialog for the currently selected Area. If no Area is selected by the time the button action runs, do nothing.

## Dialog Structure

The dialog title should be "Area styles."

Recommended layout:

1. Active styles
2. Search input
3. Filtered property list
4. Selected property value editor

Keep the dialog compact and utility-focused. Avoid instructional paragraphs in the app UI. Labels, placeholders, empty states, and tooltips should do the teaching.

### Active Styles

The active styles section is pinned at the top and always visible when the Area has styles.

Each row should show:

- CSS property name, for example `border-radius`.
- Current value, for example `12px`.
- A remove button with an accessible label such as `Remove border-radius`.
- An edit affordance that selects the property in the value editor.

Rows can be sorted alphabetically for predictability. If the implementation can preserve user insertion order cheaply, that is also acceptable, but avoid unstable reordering while the user edits.

When there are no active styles, show a very small empty state such as "No Area styles yet."

### Search and Property List

The search input should focus when the dialog opens.

Placeholder:

`Search CSS properties`

Filtering should match:

- CSS property name, for example `font-size`.
- Plain-language label, for example "Text size."
- Aliases, for example "corner" for `border-radius`.
- Category, for example "spacing" or "typography."

The property list should contain every CSS property the browser exposes through `CSSStyleDeclaration`, normalized to kebab-case, with vendor-prefixed properties hidden by default. This gives broad coverage without adding a heavy dependency.

Add a curated metadata layer for high-value properties:

- `background`
- `background-color`
- `border`
- `border-color`
- `border-radius`
- `box-shadow`
- `color`
- `display`
- `font-family`
- `font-size`
- `font-style`
- `font-weight`
- `gap`
- `height`
- `justify-content`
- `line-height`
- `margin`
- `opacity`
- `padding`
- `text-align`
- `width`

The curated layer should add friendly labels, categories, aliases, short descriptions, and stronger value suggestions. Properties without curated metadata should still be searchable and editable using their CSS name.

Property rows should show:

- Friendly label when available.
- CSS property name in code styling.
- Current active value when set.
- A compact category label when useful.

Keyboard support:

- Arrow Up and Arrow Down move through visible properties.
- Enter selects the highlighted property.
- Typing continues to update the search query.

### Value Editor

Selecting a property opens a value editor for that property.

The editor should show:

- The property name.
- A value input.
- Suggested values filtered by the typed value.
- Apply and Remove actions when relevant.
- Inline validation state.

Value input behavior:

- Allow arbitrary CSS values.
- Accept a trailing semicolon and strip it before applying.
- Preserve theme color token values where the user selects a theme token suggestion.
- Validate with `CSS.supports(property, resolvedValue)`.
- For properties not supported by `CSS.supports`, fall back to allowing the user to type, but prefer validation whenever the browser can evaluate it.

Enter behavior:

- If the value input contains a valid value, Enter applies the style.
- If a suggestion is highlighted, Enter applies that suggestion.
- If the value is invalid or incomplete, Enter keeps the dialog open and shows validation feedback.
- Escape closes the dialog without applying the current uncommitted value.

This is a deliberate exception to the generic "Enter closes dialogs" behavior because this dialog contains an actual editor. Enter should commit the form action before close semantics.

Recommended close behavior after apply:

- Keep the dialog open after applying a value so users can style iteratively.
- The active styles section updates immediately.
- A future preference can add "apply and close," but the MVP should optimize for multiple style changes in one session.

### Value Suggestions

Suggestions should be useful without pretending to know every CSS grammar.

Suggestion sources:

- Curated per-property values.
- Theme colors from `page.settings.theme.colors`.
- Generic value groups inferred by property name.
- The current active value, if one exists.

Examples:

- Color properties: theme tokens, `currentColor`, `transparent`, `black`, `white`.
- Length properties: `0`, `4px`, `8px`, `12px`, `16px`, `24px`, `1rem`, `100%`, `auto`.
- Border properties: `1px solid currentColor`, `1px solid #d1d5db`, `2px dashed currentColor`, `none`.
- Radius properties: `0`, `4px`, `8px`, `12px`, `999px`.
- Shadow properties: `0 1px 2px rgba(0, 0, 0, 0.12)`, `0 8px 24px rgba(0, 0, 0, 0.14)`, `none`.
- Display properties: `block`, `inline-block`, `flex`, `grid`, `none`.
- Flex alignment properties: `flex-start`, `center`, `flex-end`, `space-between`.
- Font weight: `400`, `500`, `600`, `700`.
- Opacity: `0`, `0.25`, `0.5`, `0.75`, `1`.

Suggestions should be buttons or listbox options, not plain text, so they are easy to click and keyboard select.

## Implementation Sketch

Add a small CSS style catalog module instead of hard-coding this inside `App.tsx`.

Suggested module:

`src/cssStyleCatalog.ts`

Suggested exports:

- `getBrowserCssProperties(style?: CSSStyleDeclaration): string[]`
- `getStylePropertyDefinitions(properties: string[]): StylePropertyDefinition[]`
- `filterStyleProperties(definitions, query): StylePropertyDefinition[]`
- `getStyleValueSuggestions(property, context): StyleValueSuggestion[]`
- `normalizeStyleValueInput(value): string`
- `validateStyleDeclaration(property, value, cssSupports): StyleValidationResult`

Suggested types:

```ts
export type StylePropertyDefinition = {
  property: string
  label?: string
  category?: string
  aliases?: string[]
  description?: string
  suggestions?: string[]
}

export type StyleValueSuggestion = {
  value: string
  label?: string
  source: 'curated' | 'theme' | 'generic' | 'current'
}
```

The UI can live in a new component:

`src/components/AreaStyleDialog.tsx`

The component should receive:

- `area`
- `themeColors`
- `onApplyStyle(property, value)`
- `onRemoveStyle(property)`
- `onClose()`

Keep state ownership in `App.tsx` so collaboration and persistence continue through existing Area update paths.

Suggested app state:

- `styleDialogAreaId: string | null`
- Or reuse `openDialogId` with a separate selected Area lookup if the existing dialog system stays simple.

## Collaboration and Persistence

No new persistence schema is needed. Applying or removing a style should update `area.styles`.

Collaboration behavior:

- Style updates should flow through the same collaborative style patch path as slash commands and agent operations.
- Remote users should see the Area style change and active slash highlights as they do today.
- The dialog only controls the local user's selected Area; it should not create remote selection conflicts.

Persistence/export behavior:

- Page JSON continues to serialize `area.styles`.
- Markdown/JSON export should pick up the same styles automatically if those exporters already read `area.styles`.
- No server migration is required.

## Accessibility

The dialog should meet the same modal baseline as existing dialogs:

- `role="dialog"` or native dialog-equivalent semantics.
- Programmatic label tied to "Area styles."
- Focus moves into the search input on open.
- Escape closes the dialog.
- Tab stays inside the dialog while open.
- Active style remove buttons and suggestion options have accessible labels.
- Invalid value feedback is announced with `role="alert"` or equivalent.

The property list and suggestion list should support keyboard selection with Arrow Up, Arrow Down, and Enter.

## Acceptance Criteria

- A selected editable Area toolbar includes an icon-only Area styles button.
- Clicking the Area styles button opens a centered dialog for that Area.
- View-only pages do not show the Area styles toolbar button and cannot open the dialog.
- The dialog shows active Area styles at the top.
- Users can remove an active style from the active styles section.
- Users can search CSS properties by name and curated aliases.
- Browser-exposed CSS properties are searchable even when they do not have curated metadata.
- Selecting a property opens a value editor with suggestions.
- Suggestions include useful curated values and theme color values where relevant.
- Valid values apply to `area.styles` and update the selected Area immediately.
- Values ending in `;` are accepted and stored without the semicolon.
- Invalid values do not apply and show a low-noise validation message.
- Enter applies a valid value from the value editor instead of closing the dialog first.
- Escape closes the dialog without applying uncommitted input.
- Existing slash CSS commands continue to work unchanged.

## Suggested Test Coverage

Pure logic tests:

- `cssStyleCatalog` normalizes browser CSS property names to kebab-case.
- Vendor-prefixed properties are hidden by default.
- Search matches property names, labels, aliases, and categories.
- Value normalization strips one trailing semicolon and surrounding whitespace.
- Validation accepts valid declarations and rejects incomplete declarations such as `border: red`.
- Theme color suggestions appear for color-like properties.

Source-level UI tests:

- `Area` renders an Area styles toolbar button with the correct label.
- The button is absent or inert in view-only mode.
- `App` renders an Area styles dialog branch.
- The dialog includes active styles, search, property rows, value suggestions, apply, and remove controls.
- The dialog handles Enter for value commit and Escape for close.

Behavior tests, if practical:

- Applying a style through the dialog updates `area.styles`.
- Removing a style through the dialog deletes that property from `area.styles`.
- Applying a semicolon-terminated value stores the normalized value.

## Non-Goals

- Full Chrome DevTools style inspector parity.
- Visual design system controls unrelated to CSS.
- A custom non-CSS style schema.
- Multi-Area batch editing.
- Page-wide styles. The existing Page styles dialog remains separate.
- AI-generated style suggestions.
- Exhaustive CSS grammar parsing.
- Adding a large CSS language service dependency for the MVP.

## Open Questions

- Should the toolbar icon be sliders or a paintbrush? Recommendation: sliders, because the dialog edits many controls rather than painting one color.
- Should applying a suggestion immediately commit it, or only fill the input? Recommendation: click or Enter on a suggestion commits it for speed; typing in the input requires Enter or Apply.
- Should exact property matches show above curated alias matches? Recommendation: yes, CSS names should win when the user knows them.
- Should the dialog eventually become a side panel? Recommendation: keep it modal until Area selection, focus handling, and canvas navigation need persistent inspector behavior.
- Should Cascadery later add a heavier autocomplete engine such as a CSS language service? Recommendation: only after the lightweight CSSOM plus curated metadata approach proves insufficient.
