# Image Support Spec

## Idea

Allow users to add images to the page as movable, resizable canvas objects.

## Status

Audited on 2026-06-29. This remains active for storage/security and image-editing hardening, but the core MVP interaction paths are implemented.

Implemented:

- `/image` slash command.
- `/image <url>` insertion.
- Command palette image insertion.
- Drag/drop and paste insertion.
- Move, resize, delete, duplicate, replace image, and edit alt text.
- Page JSON persistence for image Areas and asset references.

Still outstanding:

- Preserve image aspect ratio by default while resizing.
- Decide first-class SVG support or exclusion.
- Move from local/data URL asset references toward authorization-aware asset storage.
- Verify image content beyond browser MIME hints when server storage exists.
- Add clearer image-specific error surfaces if upload/storage fails.

## HCI/UX Research Basis

- GOV.UK file-upload guidance emphasizes using the native file browser and helping users reuse selected files when appropriate.
- NHS file-upload guidance says uploads should support choosing a file and can support drag and drop.
- GOV.UK image guidance says images need careful alt-text decisions.
- Nielsen Norman Group's error-prevention heuristic supports validating file type and size before adding images.

Sources:
- https://design-system.service.gov.uk/components/file-upload/
- https://service-manual.nhs.uk/design-system/components/file-upload
- https://design-system.service.gov.uk/styles/images/
- https://www.nngroup.com/articles/ten-usability-heuristics/

## User Experience

Image insertion should support familiar paths:

- In-Area slash command: `/image`.
- Command palette command: `Insert image`.
- Drag an image file onto the canvas.
- Paste an image from the clipboard.
- Optional toolbar/menu button later.

After insertion:

- Image appears as an Area-like object at the drop/paste point or center of viewport.
- It can be moved and resized.
- It has a small toolbar for replace, delete, and alt text.
- It participates in share/view-only behavior.

## Area Slash Command

Areas should support image insertion through the same lightweight `/` interaction already used for CSS styling.

Supported commands:

```txt
/image
/image <image-url>
```

Behavior:

- `/image` opens the native file picker.
- `/image <image-url>` inserts an image from a URL after validation.
- On successful insertion, the command text disappears from the source Area.
- If the Area is empty except for the `/image` command, the Area should become the image object or be replaced by the image object at the same x/y position.
- If the Area contains other text, the image should be inserted as a new image object near the source Area, preferably below it with a small offset.
- If insertion is canceled or validation fails, keep the command text so the user can retry or edit it.
- The command parser should treat `/image` as an app command before trying CSS property validation, since `image` is not a CSS declaration.

This keeps image insertion discoverable inside the user's current writing flow while preserving the existing command-palette path for users who prefer global commands.

## Data Model

```ts
type ImageAreaState = {
  id: string
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  assetId: string
  alt: string
  styles: Record<string, string>
}

type AssetState = {
  id: string
  kind: 'image'
  mimeType: string
  width: number
  height: number
  storageKey: string
  createdAt: string
}
```

## Validation Rules

- Accept common safe image formats: PNG, JPEG, GIF, WebP, SVG only if sanitized or explicitly excluded at first.
- Enforce a size limit.
- Reject unsupported files with a visible message.
- Preserve aspect ratio by default while resizing; allow freeform resize later if needed.

## Accessibility

- Prompt for alt text when an image is inserted.
- Allow decorative images with explicit empty alt text.
- In view-only mode, rendered images should expose their alt text.

## Acceptance Criteria

- User can type `/image` inside an Area, press Enter, and open the image picker.
- User can type `/image https://example.com/image.png`, press Enter, and create an image object from the URL.
- Successful `/image` commands are removed from the Area text.
- Canceled or failed `/image` commands remain editable.
- User can insert an image through command palette file selection.
- User can drag and drop an image onto the canvas.
- User can paste an image from clipboard where browser support allows.
- Image object can move and resize.
- Image metadata and asset reference persist in page JSON.
- Invalid file types and oversized files show recoverable errors.
- View-only share links render images but cannot modify them.

## Open Questions

- Should images be embedded in local JSON as data URLs before server storage exists?
- Should SVG be supported in version one?
- Should image cropping/object-fit controls ship with initial image support or later?
