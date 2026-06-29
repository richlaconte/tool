# Theme Color Shortcuts Spec

## Idea

Page settings should let users define theme colors that can be reused in Area styling commands. Users should be able to type plain CSS color names like `blue`, but also shortcut names such as `${businessName}-blue` to resolve to a saved page theme color.

## HCI/UX Research Basis

- Material Design color roles recommend applying colors through intended roles and pairings so contrast remains accessible.
- WAI WCAG contrast guidance requires text/background color combinations to preserve readability.
- Figma variables use reusable values to power modes and design-system tokens, which maps well to page-level named colors.
- USWDS organizes colors as theme, state, and system tokens; the same role-based model keeps user-defined colors useful without turning them into an unstructured list.

Sources:
- https://m3.material.io/styles/color/roles
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables
- https://designsystem.digital.gov/design-tokens/color/overview/

## User Experience

Theme colors should feel lightweight, visible, and useful while writing:

- Page styles/settings includes a `Theme colors` section.
- Users can add named colors with a display name, token name, and color value.
- Theme colors display as small swatches in one screen corner, as suggested in the idea, but only when the user is styling or when Page styles is open.
- Slash commands can reference theme colors by token name.
- If a user types a normal CSS color, use normal CSS behavior.
- If a user types a theme token, resolve it before validating/applying the style.

Example commands:

```txt
/color blue
/color business-blue
/background-color brand-accent
/border: 1px solid business-blue
```

## Token Naming

Prefer simple token names without `${...}` in actual user input. The spec supports the concept behind `${businessName}-blue`, but the command surface should be less code-like:

- Recommended: `business-blue`
- Also acceptable alias: `${businessName}-blue`, if users paste or type it.

The parser should support both, but UI should teach the simpler form.

## Data Model

```ts
type ThemeColorToken = {
  id: string
  name: string
  token: string
  value: string
  createdAt: string
  updatedAt: string
}

type PageThemeSettings = {
  colors: ThemeColorToken[]
}
```

Example:

```json
{
  "colors": [
    {
      "id": "color_1",
      "name": "Business Blue",
      "token": "business-blue",
      "value": "#2563eb",
      "createdAt": "2026-06-26T00:00:00.000Z",
      "updatedAt": "2026-06-26T00:00:00.000Z"
    }
  ]
}
```

## Parser Rules

- Resolve theme tokens inside CSS values before calling `CSS.supports`.
- Support tokens in whole-value positions, such as `color: business-blue`.
- Support tokens inside compound values, such as `border: 1px solid business-blue`.
- Do not replace substrings inside longer words.
- If a token is unknown, keep the command text and show a lightweight invalid-state cue.
- Store the user-facing command value or resolved CSS value consistently; recommended storage is resolved CSS value plus optional metadata if design-token fidelity becomes important later.

## Accessibility

- When a user assigns a theme color to text/background roles, show contrast feedback against the current paired color.
- At minimum, warn when text contrast is below WCAG AA for normal text.
- Do not rely only on swatch color; show token names beside swatches.

## Acceptance Criteria

- User can define a named theme color in Page styles/settings.
- Theme colors persist in page JSON.
- Theme color swatches are visible in a low-noise corner surface while styling.
- `/color business-blue` applies the saved theme color.
- `/border: 1px solid business-blue` applies a valid resolved border.
- Unknown tokens do not commit or remove slash-command text.
- Contrast warnings appear for low-contrast text/background combinations.
- Tests cover token resolution in simple and compound CSS values.

## Open Questions

- Should stored Area styles keep token references for future theme changes, or store resolved color values only?
- Should changing a theme color update all Areas that used that token?
- Should tokens be page-scoped only, or eventually reusable across pages?
