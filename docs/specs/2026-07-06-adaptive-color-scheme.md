# Adaptive Color Scheme: Semantic Chrome Tokens and Dark Mode

## Status

Priority: P1 — queue #4 (2026-07-06 audit). See the Priority Queue in README.md before starting work.

Created on 2026-07-06 from a UX research pass over the app surface. Active.
Absorbs the open "measured WCAG contrast table" future work from the
completed keyboard-first accessibility spec
(completed/2026-07-02-keyboard-first-canvas-accessibility.md).

## Goal

Cascadery's audience lives in dark IDEs, dark terminals, and dark browser
themes — and the editor chrome is hard-coded light. `src/App.css` (3,100+
lines) contains 259 raw hex colors, no CSS custom properties for chrome, and
no `prefers-color-scheme` handling anywhere in `src/`. This spec introduces
a semantic color-token layer for all editor chrome, ships a dark scheme that
follows the OS preference with an in-app override, and lands the deferred
WCAG contrast audit on both schemes. Canvas content stays user-controlled:
page background and Area CSS are document state, not chrome.

## Research Basis

- `prefers-color-scheme` should be respected by default, with an optional
  in-app override of the system signal:
  https://web.dev/articles/prefers-color-scheme
- Inclusive dark-mode design — avoid pure black/white inversion, re-derive
  elevation and state colors per scheme (Smashing Magazine, 2025):
  https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/
- Dark mode helps some users and harms others (astigmatism, low-vision
  halation); it must be a choice, not a replacement — and focus indicators
  need re-validation per scheme:
  https://stephaniewalter.design/blog/dark-mode-accessibility-myth-debunked/
- WCAG 2.2 — 1.4.3 text contrast ≥ 4.5:1, 1.4.11 non-text contrast ≥ 3:1,
  2.4.7 focus visible; each criterion must hold in *both* schemes:
  https://www.w3.org/TR/WCAG22/
- NN/g aesthetic-and-minimalist / visibility heuristics already anchor the
  product principle "system status should be obvious but calm" — scheme
  changes must not change status legibility:
  https://www.nngroup.com/articles/visibility-system-status/

## Current State

- Chrome styling: `src/App.css`, `src/index.css`,
  `src/components/area.css`, `src/components/commandPalette.css`,
  `src/components/markdownContent.css` — all raw hex values, no `:root`
  token block, no `prefers-color-scheme` media queries.
- Presence colors (`--presence-color`) and theme-color swatches are the
  only custom properties in use, and both are document/user data.
- Canvas surface: `page.settings.background` is page state (shared,
  exported in page JSON); Area backgrounds/borders are user CSS. These are
  content, not chrome, and must not be touched by scheme switching.
- Focus-visible rings, selection outlines, drop-target feedback, and status
  chips shipped across earlier specs assuming a light background.
- The keyboard-a11y spec explicitly left "a measured WCAG 2.2 AA contrast
  table for chrome and focus states" as future work — never landed.
- Device-local preferences already have an idiom: telemetry opt-out and the
  journal read marker persist via `localStorage` helpers.

## Scope

### Semantic token layer

- Introduce a `:root` block of semantic custom properties in `index.css` —
  surface, surface-raised, border, text, text-muted, accent, danger,
  success, warning, focus-ring, backdrop, shadow — named for *role*, not
  color. Every chrome selector in the five CSS files migrates from raw hex
  to tokens. A lint-style unit test walks the CSS files and fails on new
  raw hex outside the token block and documented exceptions (presence
  palette, theme swatches, brand logo colors).
- Token values are defined twice: the light scheme (current values,
  normalized) and a dark scheme under `[data-color-scheme='dark']`.

### Scheme resolution and override

- New pure module `src/colorScheme.ts`: `resolveColorScheme(preference,
  systemScheme)` where preference ∈ `'system' | 'light' | 'dark'`;
  persistence helpers using `localStorage` (device preference — explicitly
  *not* page state, not exported, not collaborative).
- App shell applies `data-color-scheme` on the document element; listens to
  the `prefers-color-scheme` media query when preference is `'system'`.
- Settings dialog gains a three-way control (System / Light / Dark); a
  command-palette entry ("Toggle color scheme") cycles it. Both surfaces
  render from the same option data (existing palette-parity convention).
- No flash of wrong theme: `app/layout.tsx` inlines a tiny synchronous
  script that reads the stored preference before first paint.

### Canvas boundary

- The canvas world (`canvas-world`, Area content, connectors as styled by
  users, page background) renders identically in both schemes. Default
  chrome *on* the canvas — selection rings, focus rings, marquee, snap
  grid lines, drop-target feedback, offscreen indicators, remote presence
  rings — moves to tokens and gets per-scheme values validated against the
  *default* page background and a dark user background.
- Default Area chrome (border/background when the user has set none) stays
  as-is in light scheme; dark scheme keeps user content untouched but may
  adjust only the non-content defaults if contrast fails — decide during
  implementation and document.

### Contrast audit

- Land the deferred audit: a table in this spec (on completion) recording
  measured contrast for text, muted text, borders, focus rings, status
  chips, and toasts against their surfaces in both schemes; every row must
  meet WCAG 2.2 AA. Fix via token values only.

## Non-Goals

- Theming canvas content or shipping "dark canvas" page templates (users
  already own page background and Area CSS).
- A theme marketplace, custom user themes, or high-contrast scheme (the
  token layer makes these possible later; `prefers-contrast` is future
  work).
- Per-page or collaborative scheme state — this is a device preference.
- Rebranding or changing the existing light palette beyond normalization.

## Acceptance Criteria

- All chrome selectors in the five CSS files consume semantic tokens; the
  no-raw-hex test passes and guards regressions.
- With preference `system`, the editor follows `prefers-color-scheme` and
  reacts to live OS changes without reload; Light/Dark overrides win and
  persist across sessions on the device.
- Scheme switching never mutates page JSON, the Yjs doc, or exports —
  round-trip tests prove document bytes are identical across schemes.
- Focus rings, selection outlines, and status chips meet 3:1 non-text
  contrast in both schemes; chrome text meets 4.5:1; the measured table is
  recorded in this spec.
- No flash of incorrect theme on load; view-only pages honor the same
  preference.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/colorScheme.test.ts`: preference resolution matrix, persistence
  round-trip, invalid stored values fall back to `system`.
- New `src/chromeTokensUi.test.ts`: CSS files contain a token block; no
  raw hex outside allowed files/sections; dark block defines every token
  the light block defines (parity assertion).
- Existing UI tests keep passing unmodified (tokens preserve current
  computed light values).
- Page JSON and Yjs round-trip unchanged under both schemes
  (extend `src/pagePersistence.test.ts` with a scheme-independence note).

## Open Questions

- Should the dark scheme slightly dim the default snap-grid lines to avoid
  vibrating against dark user backgrounds? Decide visually during
  implementation.
- Should presence avatar colors be re-mapped per scheme for contrast, or
  kept stable for identity recognition? Recommend: stable hue, per-scheme
  lightness clamp.
