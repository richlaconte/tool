# Cascadery Logo and Favicon Integration Spec

Created: 2026-06-30
Status: Active foundational spec

## Problem

Cascadery currently has an older `Tool` identity in app metadata and simple custom SVGs in `public/logo.svg` and `public/favicon.svg`. The new downloaded asset set defines a clearer Cascadery identity and should become the app's canonical logo, favicon, app icon, and brand reference set.

Asset source provided by the user:

- `/Users/richardlaconte/Downloads/files (3)/cascadery-mark.svg`
- `/Users/richardlaconte/Downloads/files (3)/cascadery-wordmark.svg`
- `/Users/richardlaconte/Downloads/files (3)/cascadery-favicon.svg`
- `/Users/richardlaconte/Downloads/files (3)/cascadery-mark-mono.svg`
- `/Users/richardlaconte/Downloads/files (3)/cascadery-overview.svg`
- `/Users/richardlaconte/Downloads/files (3)/cascadery-alt-nested.svg`
- `/Users/richardlaconte/Downloads/files (3)/cascadery-alt-lines.svg`

## Product Principle

The new identity should reinforce Cascadery as a spatial, layered canvas for making structure visible. Branding should be present enough to make the product feel real, but it must not compete with the user's canvas.

## Research Basis

- MDN notes that web app manifest icons represent the app across operating-system surfaces, not just the browser tab.
- web.dev recommends including app name, theme color, and icons in a manifest when a web app may be installed or launched like an app.
- MDN and web.dev both call out maskable icons for better Android/PWA integration; if Cascadery adds generated PNG app icons, those assets should keep important artwork inside the mask safe zone.

References:

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons
- https://web.dev/learn/pwa/web-app-manifest
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons

## Scope

### In

- Add the provided SVG logo set to the repo as source-of-truth brand assets.
- Replace the current favicon and header logo with the new Cascadery assets.
- Update Next metadata and the legacy `index.html` title/meta references from `Tool` to `Cascadery`.
- Add a web app manifest with Cascadery name, theme color, background color, and icon references.
- Add or update tests that assert the new branding is wired through browser metadata and editor chrome.
- Document which logo is used where.

### Out

- Redesigning the whole UI around the new palette.
- Building a marketing site.
- Changing product copy beyond metadata and brand surfaces.
- Adding a full brand guidelines page.
- Runtime theme switching for the brand assets.

## Asset Roles

### Canonical Mark

Use `cascadery-mark.svg` as the primary app mark.

Targets:

- Top-left editor brand mark.
- `public/logo.svg` compatibility path.
- Open graph image base, if future social sharing is added.

### Wordmark

Use `cascadery-wordmark.svg` where horizontal space is available and the full brand should be visible.

Targets:

- Future onboarding/empty state brand lockup.
- Optional share/export branding.
- Not recommended for the top-left editor button unless it remains visually lighter than the current mark-plus-text treatment.

### Favicon

Use `cascadery-favicon.svg` as the SVG favicon.

Targets:

- `public/favicon.svg`
- Next `metadata.icons.icon`
- Next `metadata.icons.shortcut`
- Legacy `index.html` `<link rel="icon">`

### Mono Mark

Use `cascadery-mark-mono.svg` for monochrome or high-contrast contexts.

Targets:

- Future print/export surfaces.
- Future dark-on-light contexts where the full color mark is too strong.

### Alternate Symbols

Keep `cascadery-alt-nested.svg` and `cascadery-alt-lines.svg` as supporting brand assets, not as primary app logos.

Targets:

- Future docs or onboarding illustrations.
- Future template/category icons if needed.

### Overview

Keep `cascadery-overview.svg` as a reference asset, not a runtime app asset unless it is intentionally used in docs.

Target:

- `docs/brand/cascadery-overview.svg` or `public/brand/cascadery-overview.svg` if the implementation wants it versioned with the rest of the set.

## File Layout

Recommended repo layout:

```text
public/
  favicon.svg
  logo.svg
  manifest.webmanifest
  brand/
    cascadery-mark.svg
    cascadery-wordmark.svg
    cascadery-favicon.svg
    cascadery-mark-mono.svg
    cascadery-alt-nested.svg
    cascadery-alt-lines.svg
    cascadery-overview.svg
```

Compatibility paths:

- Keep `/logo.svg` because `src/App.tsx`, `app/layout.tsx`, and existing tests already reference it.
- Keep `/favicon.svg` because browser metadata already references it.
- Use `/brand/...` for the full asset library so future code can opt into a specific asset without overwriting compatibility paths.

## Metadata and Browser Integration

Update `app/layout.tsx`:

- `title`: `Cascadery`
- `description`: `A collaborative spatial canvas for shaping ideas with text, style, images, and structure.`
- `applicationName`: `Cascadery`
- `icons.icon`: `/favicon.svg`
- `icons.shortcut`: `/favicon.svg`
- `icons.apple`: `/apple-touch-icon.png` if generated, otherwise `/logo.svg` for the first pass.
- `manifest`: `/manifest.webmanifest`
- `themeColor`: use the brand indigo or slate only if supported by the current Next metadata API version in the repo.

Update `index.html` for the legacy/Vite entry path:

- `<title>Cascadery</title>`
- Keep the SVG favicon link.
- Add a manifest link if the legacy path is still used.

Add `public/manifest.webmanifest`:

```json
{
  "name": "Cascadery",
  "short_name": "Cascadery",
  "description": "A collaborative spatial canvas for shaping ideas with text, style, images, and structure.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#F6F7FB",
  "theme_color": "#4F46E5",
  "icons": [
    {
      "src": "/logo.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

If generated PNG app icons are added during implementation, include:

- `/apple-touch-icon.png`, 180 x 180
- `/icon-192.png`, 192 x 192
- `/icon-512.png`, 512 x 512
- Optional `/icon-maskable-512.png`, 512 x 512, `purpose: "any maskable"`

Do not add a runtime image-generation dependency just for icons. If PNGs are needed, generate them once from the SVGs and commit the outputs.

## Editor Chrome Integration

The top-left editor brand button should keep the current lightweight composition:

- Mark image on the left.
- Text label `cascadery` on the right.
- Same click behavior as the existing brand button.

Use `/logo.svg` for the mark so the current component stays simple. Do not use the full wordmark in the editor chrome unless visual QA proves it remains understated at small sizes.

The mark should:

- Fit the existing 24-32 px visual footprint.
- Not introduce a blue active outline.
- Use `draggable="false"` and empty `alt` because the button already has an accessible label.

## Visual QA

Verify the new assets in:

- Browser tab favicon.
- Next app metadata.
- Top-left editor brand button.
- Empty state.
- View-only canvas.
- Dark browser UI or dark OS tab surfaces when possible.
- Small mobile viewport.

The mark should remain recognizable at 16 px and 32 px. If the full color mark becomes muddy at favicon size, keep `cascadery-favicon.svg` as the favicon instead of reusing `cascadery-mark.svg`.

## Test Plan

Update `src/brandingAssets.test.ts` to assert:

- `app/layout.tsx` uses title `Cascadery`.
- Next metadata points to `/favicon.svg`, `/logo.svg`, and `/manifest.webmanifest`.
- `src/App.tsx` still renders the site brand button with `src="/logo.svg"` and label `cascadery`.
- `public/favicon.svg` contains the new Cascadery asset title or `aria-label="Cascadery"`.
- `public/logo.svg` contains the new Cascadery mark geometry or `aria-label="Cascadery"`.
- `public/manifest.webmanifest` names Cascadery and references at least one icon.

If PNG icons are committed, add tests that verify the expected files exist and are non-empty.

## Acceptance Criteria

- The provided logo SVGs are committed into the repo under a clear brand asset path.
- `/favicon.svg` uses the provided Cascadery favicon asset.
- `/logo.svg` uses the provided Cascadery mark asset.
- The editor top-left brand mark displays the new logo.
- Browser/app metadata says `Cascadery`, not `Tool`.
- A web app manifest exists and references Cascadery icons.
- Branding tests are updated and passing.
- No app workflow behavior changes other than visual brand presentation and browser metadata.

## Future Work

- Add generated PNG and maskable icons if installability becomes a first-class workflow.
- Add Open Graph/Twitter social cards.
- Add a compact brand usage doc for contributors.
- Replace any remaining `tool` package naming only if deployment/runtime implications are understood.
