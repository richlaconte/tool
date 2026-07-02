# JSON Canvas Interoperability

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 3.3). Active.

## Goal

Complete the JSON Canvas story: audit and finish the existing export, add
import, and round-trip Cascadery-specific data through namespaced extension
fields — so Cascadery pages are legible to the Obsidian/local-first ecosystem
and users can leave (or arrive) anytime. Data portability is a product pillar,
not a backup feature.

## Research Basis

- JSON Canvas spec (nodes: `text`/`file`/`link`/`group`; edges with
  `fromNode`/`toNode`, sides, ends, color, label; colors are preset `"1"`-`"6"`
  or hex): https://jsoncanvas.org/spec/1.0/ and
  https://github.com/obsidianmd/jsoncanvas
- Obsidian Canvas is the reference consumer:
  https://obsidian.md/canvas
- Direction audit names the JSON Canvas mapping a required foundation of the
  Portable Canvas Data pillar
  (docs/specs/2026-06-29-cascadery-product-direction-audit.md).

## Current State

- Export already exists: `exportPageAsJsonCanvas` /
  `stringifyPageAsJsonCanvas` in `src/pageExports.ts`, with local
  `JsonCanvasNode`/`JsonCanvasEdge`/`JsonCanvasExport` types and MIME constant
  `JSON_CANVAS_MIME_TYPE`. **First implementation step is an audit of this
  exporter against the 1.0 spec** — verify node types, edge side/end fields,
  group handling for nested Areas, and color mapping; fix gaps before
  building import.
- There is no JSON Canvas import anywhere. Import exists only for Cascadery's
  own page JSON (`parsePageJson` in `src/pagePersistence.ts`, wired to a file
  input in App.tsx with `importError` state).
- Cascadery data with no JSON Canvas equivalent: Area kind/status/tags,
  evidence references, CSS style declarations (beyond color), theme tokens,
  comments (Tier 1.3), journal (Tier 2.2), link cardinality/optionality/
  visual-mode fields (`src/areaMetadata.ts`).
- Nested Areas: Cascadery nests by `parentId` with relative child coords;
  JSON Canvas expresses grouping via `group` nodes and absolute positions —
  the mapping must convert coordinates both ways (`src/nestedAreas.ts` has
  the containment helpers).

## Scope

### Export completion

- Audit + fix per above. Mapping rules to enforce:
  - Text Area → `text` node (raw Markdown text — synergy with Tier 1.2).
  - Image Area → in-app assets have no file path; export as `text` node with
    the alt text and an `x-cascadery-asset` extension field, documented as
    lossy (JSON Canvas `file` nodes reference vault-relative paths Cascadery
    cannot guarantee).
  - Area with `metadata.url` → `link` node.
  - Parent Area with children → `group` node plus absolute-positioned child
    nodes (convert child relative → absolute coordinates).
  - `AreaLink` → edge; `kind` becomes the edge `label` when no explicit label
    exists; direction maps to `toEnd`/`fromEnd` arrows.
  - Style: map a detected `border-color`/`background` to the nearest of the
    six preset colors or pass a hex; everything else goes to extensions.
- Extension fields (JSON Canvas tolerates unknown top-level keys on
  nodes/edges; keep them clearly namespaced): `x-cascadery-kind`,
  `x-cascadery-status`, `x-cascadery-tags`, `x-cascadery-styles`,
  `x-cascadery-evidence`, `x-cascadery-link` (the full `AreaLinkVisual`
  payload). A Cascadery→Cascadery trip through `.canvas` must be lossless
  for these; foreign consumers simply ignore them.

### Import

- New pure module `src/jsonCanvasImport.ts`:
  - `parseJsonCanvas(json: string): JsonCanvasImportResult` →
    `{ state: PageAppState fragment, warnings: string[] }`, defensive against
    missing/extra fields (real-world `.canvas` files vary).
  - Node mapping: `text` → text Area (Markdown preserved); `file` → `note`
    Area with the path stored as `metadata.filePath` and a `file` kind;
    `link` → `note` Area with `metadata.url`; `group` → parent Area with
    contained nodes nested (absolute → relative coordinate conversion;
    containment determined by the group's rect, matching Obsidian semantics).
  - Edge mapping: → `AreaLink` with `relates-to` kind (or restored kind from
    `x-cascadery-link`), label preserved, sides → anchor hints.
  - Colors: preset `"1"`–`"6"` map to a documented palette table in the
    module; hex passes through to `border-color` style.
  - Restore all `x-cascadery-*` extensions when present.
- UI: extend the existing import affordance (same dialog/file-input path as
  page JSON import) to accept `.canvas` files, detected by extension or by
  shape sniffing (`nodes`/`edges` keys without `schemaVersion`). Import into
  the current page places content below existing bounds as one transaction
  (one undo step), reusing the SDD-import layout helper if it has landed;
  show warnings before applying.

### Lossy-export manifest

- The export dialog/palette action surfaces what will not survive a foreign
  round-trip: comments, journal, evidence detail, full CSS, theme tokens —
  one static, honest sentence plus a docs link, not a dynamic report in v1.

## Non-Goals

- Obsidian vault/file integration (paths in `file` nodes are imported as
  metadata, not resolved).
- Syncing (this is one-shot import/export, not a live bridge).
- Mermaid or other diagram-format interop (separate future spec if demanded).
- Preserving Cascadery extensions through *third-party* editors that strip
  unknown fields — best-effort only, documented.

## Acceptance Criteria

- The exporter passes a spec-conformance test suite covering every node/edge
  field in JSON Canvas 1.0, including groups from nested Areas with correct
  absolute coordinates.
- An exported `.canvas` opens in Obsidian Canvas with correct positions,
  sizes, text, groups, and edges (manual verification recorded on
  completion).
- Cascadery → `.canvas` → Cascadery round-trips kinds, statuses, tags,
  styles, evidence, and link visuals via extension fields.
- A hand-written minimal `.canvas` file and an Obsidian-produced fixture both
  import: correct Areas, nesting, links, colors; unknown fields ignored with
  warnings, never a crash.
- Import applies as a single undo step, places content without overlapping
  existing Areas, and reports warnings first.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/pageExports.test.ts`: extend to full 1.0 conformance for export,
  nested-group coordinate conversion, color mapping table, extension
  emission.
- `src/jsonCanvasImport.test.ts`: fixtures — minimal file, Obsidian-flavored
  file, file with unknown node types/fields, malformed JSON, extension
  restoration, absolute→relative nesting, edge/anchor mapping.
- Round-trip test: export a rich fixture page, import it into an empty state,
  deep-compare the semantically preserved fields.

## Open Questions

- Group membership on import: Obsidian determines containment spatially.
  Contained-but-overlapping edge cases should follow "fully contained →
  child; partial overlap → sibling" and be tested.
- Should import offer "new page" vs "into current page"? Recommend: into
  current page only in v1 (new-page creation flows through the server;
  keep import client-pure).
