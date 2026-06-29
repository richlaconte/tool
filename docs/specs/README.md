# Cascadery Specs

This directory is split between active foundational specs and completed MVP specs.

## Product Direction

- [Product Direction Audit](2026-06-29-cascadery-product-direction-audit.md)
- [Product and Developer Experience Direction](2026-06-26-cascadery-product-dx.md)

## Active Foundational Specs

These specs still have meaningful product or implementation work remaining.

1. [Security and Privacy Baseline](2026-06-26-cascadery-security-privacy.md)
2. [AI and MCP Agent Interface](2026-06-26-cascadery-ai-mcp-interface.md)

Recommended implementation order:

1. Collaboration rate limits, security logs, and production security docs.
2. Protected MCP access and deeper agent workflows.

## Completed MVP Specs

Completed specs live in [completed](completed). A completed spec means its core MVP acceptance criteria are represented in the app and test suite. Future polish listed inside those specs can still become new active specs later.

- [Area Duplicate Action](completed/2026-06-26-area-duplicate-action.md)
- [Area Resize](completed/2026-06-26-area-resize.md)
- [Area Toolbar Delete](completed/2026-06-26-area-toolbar-delete.md)
- [Area Types, Metadata, and Links](completed/2026-06-29-area-types-metadata-and-links.md)
- [Canvas Zoom](completed/2026-06-26-canvas-zoom.md)
- [Command Palette Completion](completed/2026-06-26-command-palette-completion.md)
- [Image Support](completed/2026-06-26-image-support.md)
- [Interoperability and Export](completed/2026-06-29-interoperability-and-export.md)
- [Multi-User Collaboration](completed/2026-06-26-multi-user-collaboration.md)
- [Nested Areas](completed/2026-06-26-nested-areas.md)
- [Page JSON Persistence](completed/2026-06-26-page-json-persistence.md)
- [Share Links](completed/2026-06-26-share-links.md)
- [Snap Grid](completed/2026-06-26-snap-grid.md)
- [Theme Color Shortcuts](completed/2026-06-26-theme-color-shortcuts.md)
- [Version History and Change Review](completed/2026-06-29-version-history-and-change-review.md)

## Completion Rule

Move a spec into `completed/` only when:

- The core user path exists in the app.
- Page JSON or server persistence supports the new state.
- Interaction behavior is covered by focused tests.
- Any omitted non-MVP items are explicitly future work, not hidden gaps.
