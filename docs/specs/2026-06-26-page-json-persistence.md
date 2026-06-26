# Page JSON Persistence Spec

## Idea

Save the whole page state in a carefully planned JSON format so the canvas can be persisted, shared, versioned, and later synchronized across users.

## HCI/UX Research Basis

- Nielsen Norman Group warns that autosave can conflict with user expectations when people assume changes require explicit Save or Apply. In canvas/document tools, autosave is still valuable, but it needs visible feedback and recovery.
- GitLab Pajamas states that timely save feedback is vital and describes manual save and autosave as two main patterns.
- Nielsen Norman Group's visibility-of-system-status heuristic supports showing whether changes are saved, saving, or failed.
- Nielsen Norman Group's user-control heuristic supports undo/recovery after destructive or accidental changes.

Sources:
- https://www.nngroup.com/articles/efficiency-vs-expectations/
- https://design.gitlab.com/patterns/saving-and-feedback
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.nngroup.com/articles/user-control-and-freedom/

## User Experience

Persistence should feel invisible but trustworthy:

- Changes autosave after a short debounce.
- A small status indicator says `Saved`, `Saving...`, or `Offline changes`.
- Manual export/import remains available for confidence and portability.
- Failed saves do not silently disappear; the app keeps local unsaved data and shows a recoverable state.
- Future collaboration can reuse the same page model.

## JSON Shape

The persisted format should be versioned from day one:

```json
{
  "schemaVersion": 1,
  "page": {
    "id": "page_uuid",
    "title": "Untitled page",
    "createdAt": "2026-06-26T00:00:00.000Z",
    "updatedAt": "2026-06-26T00:00:00.000Z",
    "settings": {
      "background": "#ffffff",
      "snapGrid": {
        "enabled": false,
        "size": 16,
        "visible": false
      }
    }
  },
  "areas": [
    {
      "id": "area_uuid",
      "type": "text",
      "x": 240,
      "y": 160,
      "width": 200,
      "height": null,
      "text": "Example",
      "styles": {
        "border": "1px solid red"
      },
      "createdAt": "2026-06-26T00:00:00.000Z",
      "updatedAt": "2026-06-26T00:00:00.000Z"
    }
  ],
  "assets": []
}
```

## Data Rules

- Use stable UUIDs instead of array indexes for all user-created objects.
- Store CSS properties in dash-case exactly as users type commands.
- Keep page settings separate from Area styles.
- Add migrations from older schema versions rather than mutating old data ad hoc.
- Store transient UI state, such as selected Area and open dialog, outside the saved page JSON.

## Persistence Layers

1. `localStorage` or IndexedDB for immediate local persistence.
2. Export/import JSON file for manual backup.
3. Server persistence when share links or multi-user support exists.

## Acceptance Criteria

- Reloading the page restores Areas, text, styles, and page settings.
- Saved JSON is deterministic enough for debugging.
- Unknown future fields are preserved or safely ignored.
- Invalid JSON import shows a clear error and does not destroy the current page.
- Save status is visible and accurate.
- Tests cover serialization, migration, import validation, and round-trip restoration.

## Open Questions

- Should the first version use `localStorage` or IndexedDB?
- Should exported files include embedded image data or references to separately stored assets?
- How many undo/history entries should be retained locally?
