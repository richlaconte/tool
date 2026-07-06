# Mermaid Diagram Interop: Paste Agent Diagrams, Export Canvas Structure

## Status

Completed MVP spec on 2026-07-06. Shipped: `src/mermaidImport.ts` (subset
parser with line-anchored errors, unsupported shapes/diagram types fail
loudly, chains and one subgraph level supported, deterministic layered
layout) and `src/mermaidExport.ts` (shapes from kinds, subgraphs from one
nesting level, `%% lossy:` manifest comment, direction by selection
bounds); `createLink`/`deleteLink` became first-class agent patch
operations (validated, applied, undoable in `src/agentInterface.ts`) so
`import_mermaid` proposals arrive whole; MCP tools `export_mermaid`
(page:read, optional areaIds, cache metadata) and `import_mermaid`
(page:suggest, reviewable dry-run proposal); UI: "Import Mermaid…" palette
dialog, "Copy as Mermaid" (selection when multi-select is active), and a
"Convert to Areas" action on rendered ```mermaid fences (edit mode only,
source Area untouched, structure lands right of the source).

Resolved open questions: only the `{decision}` shape maps to a kind in v1;
converted structure lands right of the source at a fixed gap; dotted/thick
edge styles import as plain links (the connector visual model has no
stroke-style field — documented in the module).

Created on 2026-07-05 from a market and product research pass.
Named twice as a "future spec if demanded" in completed specs
(completed/2026-07-02-json-canvas-interop.md,
completed/2026-07-02-markdown-code-area-content.md); market signal now
justifies it.

## Goal

Mermaid is how coding agents emit structure: every major agent produces
`flowchart` blocks in plans, PR descriptions, and architecture discussions,
and the 2026 pattern reviewers call "the agent lives with your diagram" runs
on Mermaid and diagram-MCP servers. Cascadery renders a Mermaid block as
dead highlighted text. The Cascadery-native answer is not to render foreign
diagrams — it is to convert them into editable canvas structure: paste a
Mermaid flowchart, get Areas and links you can rearrange, annotate, and
compile back out. And the reverse: any set of linked Areas exports as a
Mermaid block for PRs and docs. This makes Cascadery legible to the largest
diagram ecosystem in developer tooling without adding a rendering engine.

## Research Basis

- "Agent lives with your diagram" as the 2026 shift; Mermaid/diagram-MCP
  servers as the active frontier:
  https://nimbalyst.com/blog/best-ai-diagram-tools-2026/ and
  https://storyflow.so/blog/best-infinite-canvas-tools-2026
- Mermaid flowchart syntax (nodes, shapes, edges, labels, direction):
  https://mermaid.js.org/syntax/flowchart.html
- Precedent in this codebase: JSON Canvas interop mapped nodes/edges both
  ways with documented lossiness; SDD import reused layout machinery —
  this spec follows both patterns.
- Portability pillar (2026-06-29-cascadery-product-direction-audit.md):
  data legible and movable; Mermaid is a text interchange format, exactly
  the pillar's shape.

## Current State

- Markdown Areas render fenced code with syntax highlighting
  (`src/markdownContent.ts`, `src/codeHighlight.ts`); a ```mermaid block
  is inert text.
- Areas + links are a directed labeled graph already: links carry labels
  and direction (`src/areaLinkControls.ts`, `src/linkGeometry.ts`); Area
  kinds/status exist (`src/areaMetadata.ts`).
- Import machinery precedent: `src/jsonCanvasImport.ts` (foreign format →
  Areas/links patch) and `layoutSddImport` (`src/sddImport.ts`,
  section-grid layout). Both are pure and proposal-compatible.
- Export precedent: `src/pageExports.ts` and the JSON Canvas exporter
  document lossy fields explicitly.
- No-CDN constraint: the bundle cannot absorb Mermaid's renderer (~2 MB);
  parsing a syntax subset is cheap and pure.

## Scope

### Import: Mermaid flowchart → Areas and links

- New pure module `src/mermaidImport.ts`: parse a supported subset of
  `flowchart` / `graph` syntax — direction header (`TD`/`TB`/`LR`/`RL`),
  node ids with label shapes (`[text]`, `(text)`, `{text}`, `([text])`,
  `[[text]]`), edges (`-->`, `---`, `-.->`, `==>`) with optional labels
  (`-->|label|`, `-- label -->`), and `subgraph`/`end` blocks. Everything
  else (classDefs, styles, click handlers, sequence/class/state diagrams)
  is out of the subset and reported, not silently dropped.
- Mapping: node → Area (label as text; shape → kind hint: `{decision}` →
  `decision`, others → `note`, documented and easily contested in review);
  edge → link with label and direction; `subgraph` → parent Area with
  members nested (nesting machinery exists).
- Layout: layered by graph depth along the declared direction, reusing the
  SDD/context-kit layout idiom — simple, deterministic, human-rearranged
  afterward (v1 principle from SDD import: no layout cleverness).
- Entry points: paste detection is too magical — explicit only. Command
  palette "Import Mermaid…" with a paste dialog, plus a per-block action
  on rendered ```mermaid fences in Areas ("Convert to Areas"). Converting
  a block keeps the source Area untouched and creates the structure
  beside it.
- Unparseable input fails with a line-anchored error; partial success is
  not applied (all-or-nothing patch, matching JSON Canvas import).

### Export: selection or page → Mermaid flowchart

- New pure module `src/mermaidExport.ts`: linked Areas → `flowchart TD`
  (or `LR` chosen by aspect of the selection bounds) with node labels from
  `areaTitle`, edge labels/direction from links, nesting → `subgraph`.
  Kind renders as shape (inverse of the import mapping); status and CSS
  are documented lossy fields, listed in a trailing comment line
  (`%% lossy: …`) consistent with the JSON Canvas manifest approach.
- Entry points: command palette ("Copy as Mermaid" — selection if
  multi-select active, else whole page) and a section in the existing
  export dialog. Output is clipboard/text, no file surface needed.
- Round-trip: import of an export reproduces nodes, edges, labels,
  nesting, and direction (positions are layout-derived, not preserved —
  Mermaid has no coordinates; state this in the export comment).

### MCP

- Two tools on the existing gateway: `export_mermaid` (minimum scope
  `page:read`, optional area-id list) and `import_mermaid` (scope
  `page:suggest`, lands as a reviewable proposal like `import_sdd`).
  Agents can then post a plan diagram straight onto the canvas and pull
  the human-edited structure back.

## Non-Goals

- Rendering Mermaid diagrams as images in Areas (bundle cost; conversion
  to native structure is the product answer — revisit only with strong
  demand).
- Diagram types beyond flowchart/graph (sequence/class/state/ER have no
  clean Area mapping; report as unsupported).
- Live sync between a Mermaid block and previously converted Areas
  (one-shot conversion, like JSON Canvas).
- D2/PlantUML/Graphviz (same slot, later specs if demanded).

## Acceptance Criteria

- Importing a 15-node agent-generated flowchart with labeled edges and one
  subgraph produces correctly linked, nested, deterministically laid-out
  Areas; the operation is one undo step.
- Decision-shaped nodes import as `decision` kind; unsupported syntax
  yields a line-anchored error and no partial apply.
- "Copy as Mermaid" on a multi-selection produces a block that renders in
  GitHub Markdown preview and re-imports to equivalent structure
  (nodes/edges/labels/nesting).
- The lossy-field comment lists status/CSS when present; export of
  link-free Areas still produces valid (edge-less) Mermaid.
- `import_mermaid` via MCP arrives as a reviewable proposal; `page:read`
  tokens can export but not import.
- Existing ```mermaid fences keep rendering as highlighted code,
  now with the convert action.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/mermaidImport.test.ts`: parser fixtures per supported construct,
  subgraph nesting, direction variants, kind mapping, error line anchors,
  rejection of unsupported diagram types.
- `src/mermaidExport.test.ts`: shape/kind inverse mapping, edge labels,
  subgraph emission, lossy comment, GitHub-renderable syntax validity
  (assert against the grammar subset, no renderer in tests).
- Round-trip property tests: export→import structural equivalence on
  fixture pages.
- `src/mcpGateway.test.ts`: both tools' scope enforcement and proposal
  routing.

## Open Questions

- Should `{decision}` → `decision` kind mapping extend to task-ish
  conventions (e.g. `((circle))`)? Recommend: only the decision mapping in
  v1; kinds are cheap to set after import.
- Where converted structure lands relative to the source Area: to the
  right at a fixed gap, or viewport center? Recommend: right of source,
  matching duplicate-offset conventions.
- Edge style (`-.->` dotted, `==>` thick) → link styling: import as plain
  links in v1 or map to link style metadata if the connector system
  already supports it — check `areaLinkControls` capabilities during
  implementation.
