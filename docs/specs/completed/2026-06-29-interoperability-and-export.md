# Interoperability and Export Spec

## Status

Completed on 2026-06-29 as an MVP foundational portability spec.

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

- The page toolbar offers `Cascadery JSON`, `Markdown`, and `JSON Canvas` downloads.
- The JSON download uses the Cascadery schema but redacts active share secrets.
- Import dialog validates before replacing page state.
- Import errors name the field or section that failed validation.

## Agent and MCP Behavior

MCP tools can expose export-friendly resources:

- `cascadery://pages/{pageId}/markdown`
- `cascadery://pages/{pageId}/json-canvas`

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

## Implementation Notes

- `pageExports.ts` provides pure Markdown, JSON Canvas, and redacted Cascadery JSON export helpers.
- Markdown export groups typed Areas into implementation sections and preserves text Area bodies exactly.
- JSON Canvas export maps text Areas to text nodes, image Areas to text nodes with image references when no binary bundle is produced, and Area links to edges.
- JSON Canvas node and edge extension fields preserve Cascadery metadata, styles, link kinds, and non-secret asset metadata.
- User-facing JSON export redacts `shareLinks`; browser/server persistence still keeps full internal state where appropriate.
- MCP resources expose the same Markdown and JSON Canvas formats with `text/markdown` and `application/vnd.jsoncanvas+json` MIME types.
- Tests cover Markdown grouping, JSON Canvas mapping, MCP resources, and secret/raw asset exclusion.

## Future Work

- Add a richer export dialog with preservation summaries once the toolbar has more than a few export targets.
- Add JSON Canvas import and Markdown import into new pages or selected Areas.
- Add optional binary asset bundle export for local image files.
- Add a dedicated `context-bundle` MCP resource once agent context packaging needs prompts, file references, and constraints beyond Markdown.
- Map compatible CSS fields into native JSON Canvas color/border fields while keeping full CSS in extension metadata.
