# Cascadery Specs

This directory is split between active foundational specs and completed MVP specs.

## Product Direction

- [Product Direction Audit](2026-06-29-cascadery-product-direction-audit.md)
- [Product and Developer Experience Direction](2026-06-26-cascadery-product-dx.md)

## Active Foundational Specs

These specs still have meaningful product or implementation work remaining.

1. [Security and Privacy Baseline](2026-06-26-cascadery-security-privacy.md)
2. [Share Links](2026-06-26-share-links.md)
3. [AI and MCP Agent Interface](2026-06-26-cascadery-ai-mcp-interface.md)
4. [Command Palette Completion](2026-06-26-command-palette-completion.md)
5. [Image Support](2026-06-26-image-support.md)
6. [Canvas Zoom](2026-06-26-canvas-zoom.md)
7. [Area Types, Metadata, and Links](2026-06-29-area-types-metadata-and-links.md)
8. [Version History and Change Review](2026-06-29-version-history-and-change-review.md)
9. [Interoperability and Export](2026-06-29-interoperability-and-export.md)

Recommended implementation order:

1. Security and server-enforced share access.
2. Command system/accessibility cleanup.
3. Version history and undo foundations.
4. Area metadata/types/links.
5. Interoperability exports.
6. Image storage/security hardening.
7. Protected MCP access and deeper agent workflows.
8. Canvas zoom polish.

## Completed MVP Specs

Completed specs live in [completed](completed). A completed spec means its core MVP acceptance criteria are represented in the app and test suite. Future polish listed inside those specs can still become new active specs later.

- [Area Duplicate Action](completed/2026-06-26-area-duplicate-action.md)
- [Area Resize](completed/2026-06-26-area-resize.md)
- [Area Toolbar Delete](completed/2026-06-26-area-toolbar-delete.md)
- [Multi-User Collaboration](completed/2026-06-26-multi-user-collaboration.md)
- [Nested Areas](completed/2026-06-26-nested-areas.md)
- [Page JSON Persistence](completed/2026-06-26-page-json-persistence.md)
- [Snap Grid](completed/2026-06-26-snap-grid.md)
- [Theme Color Shortcuts](completed/2026-06-26-theme-color-shortcuts.md)

## Completion Rule

Move a spec into `completed/` only when:

- The core user path exists in the app.
- Page JSON or server persistence supports the new state.
- Interaction behavior is covered by focused tests.
- Any omitted non-MVP items are explicitly future work, not hidden gaps.

