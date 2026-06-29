# Interoperability and Export Spec

## Status

Created on 2026-06-29 as a foundational portability spec.

## Goal

Make Cascadery pages portable, inspectable, and useful outside Cascadery.

## Product Rationale

Developer context becomes more valuable when it can move into tools developers already use:

- Markdown docs.
- GitHub issues or PR descriptions.
- JSON Canvas files.
- Agent prompts/context bundles.
- Local backups.

Portability also reinforces trust. Users should feel they own the implementation context they create.

## Research Basis

- JSON Canvas was created for longevity, readability, interoperability, extensibility, and user ownership of infinite-canvas data: https://github.com/obsidianmd/jsoncanvas
- Obsidian Canvas supports visual organization with embedded notes and media, showing that canvas content often needs to coexist with document systems: https://obsidian.md/canvas
- Miro MCP demonstrates that shared board context can become useful input to coding agents and development workflows: https://developers.miro.com/docs/miro-mcp

## Export Targets

### Cascadery JSON

Purpose:

- Full-fidelity backup.
- Round-trip import.
- Debugging and migration.

Rules:

- Includes schema version.
- Includes page, Areas, assets, links, metadata, theme, and share settings.
- Does not include raw active share secrets in server-backed exports.
- Can include local-only share tokens only if clearly marked and user-initiated.

### JSON Canvas

Purpose:

- Interop with Obsidian and other infinite canvas tools.

Mapping:

- Text Areas become text nodes.
- Image Areas become file nodes when asset export can produce files, or text nodes with image references when not.
- Links become edges.
- Cascadery-specific metadata goes into extension fields.
- CSS styles map to color/border fields only when compatible; full CSS remains in extension metadata.

### Markdown

Purpose:

- Human-readable handoff.
- README/RFC/issue generation.
- Agent context bundle.

Structure:

```md
# Page title

## Decisions

## Tasks

## Risks

## Questions

## Areas
```

Rules:

- Use Area type metadata when available.
- Preserve Area text exactly as text.
- Include file paths and URLs.
- Include links as relationship lines.

## Import Targets

First version:

- Cascadery JSON round-trip.

Later:

- JSON Canvas import.
- Markdown import as a new page or Area set.

## User Experience

- Export dialog offers `Cascadery JSON`, `Markdown`, and later `JSON Canvas`.
- Each export option explains what it preserves.
- Import dialog validates before replacing page state.
- Import errors name the field or section that failed validation.

## Agent and MCP Behavior

MCP tools can expose export-friendly resources:

- `cascadery://pages/{pageId}/markdown`
- `cascadery://pages/{pageId}/json-canvas`
- `cascadery://pages/{pageId}/context-bundle`

These resources should be read-only and safe by default.

## Security and Privacy

- Exports must not include raw hidden server tokens.
- Asset exports should respect access mode.
- Remote image URLs should be preserved as URLs with clear warnings.
- Exported context bundles should avoid private operational data unless explicitly requested.

## Acceptance Criteria

- Cascadery JSON export remains full-fidelity and round-trippable.
- Markdown export groups typed Areas into useful implementation sections.
- JSON Canvas export maps Areas and links into a valid `.canvas`-style structure.
- Exports do not include active server share secrets.
- Import validation rejects unsupported schema versions and unsafe data.
- Tests cover Markdown grouping, JSON Canvas mapping, and secret exclusion.

## Non-Goals

- Perfect visual fidelity in other canvas tools.
- Bidirectional sync with Obsidian or Miro.
- Exporting binary asset bundles in the first version.

