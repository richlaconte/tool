# SDD Artifact Interchange

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 2.1). Active.
This is the flagship market-position spec: Cascadery as the visual layer for
spec-driven development.

## Goal

Compile a Cascadery page into the Markdown artifacts coding agents execute
against (spec / plan / tasks), and import such artifacts back onto the canvas
as laid-out Areas — via the UI and via MCP — so a page and an agent's working
files stay two views of the same implementation intent.

## Research Basis

- GitHub Spec Kit's SDD process is Spec → Plan → Tasks → Implement, driven by
  Markdown files: https://github.github.com/spec-kit/ and
  https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- SDD tool landscape (Kiro, spec-kit, Tessl) — all text-file-centric, none has
  a visual layer: https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- Cascadery's own agent-handoff brief already proves demand for a
  deterministic Markdown compile of a page
  (docs/specs/completed/2026-06-29-agent-handoff-briefs.md).

## Current State

- Area kinds map naturally onto SDD sections: `decision`, `question`, `task`,
  `risk`, `file`, `component`, `api`, `ui-state`, `note` (`AREA_KINDS` in
  `src/areaMetadata.ts`), with `AreaStatus` (`open`, `in-progress`, `decided`,
  `done`, `blocked`) and evidence references
  (`AreaEvidenceReference: { kind, label, target }`).
- Links (`AreaLink`) carry kinds including `depends-on`, `implements`,
  `blocks` — usable for task ordering.
- Existing exporters: `exportPageAsMarkdown` and `exportPageAsJsonCanvas` in
  `src/pageExports.ts`; `createAgentHandoffBrief` in `src/agentHandoff.ts`.
  Study both before writing new code — the SDD compile is a sibling, and
  shared helpers (reading-order sort, section grouping) should be extracted,
  not copied.
- Layout-on-insert machinery exists: `insertContextKit` in
  `src/contextKits.ts` (line ~169) places a set of Areas + links into an
  existing page. The importer should follow its patterns
  (`InsertContextKitOptions/Result`).
- MCP gateway: tools are defined in `toolDefinitions` in `src/mcpGateway.ts`;
  suggestion tools return `AgentPatch` proposals (`suggestAreas`,
  `suggestImplementationMap` in `src/agentInterface.ts`) that render as
  reviewable proposals in the UI. `MAX_AGENT_OPERATIONS = 25` currently caps
  patch size — imports may need a higher, import-specific cap (see Open
  Questions).
- Downloads/copy: App.tsx already downloads Markdown/JSON exports
  (`exportPageMarkdown`, line ~3988) — reuse its download helper.

## Scope

### Export: compile page → SDD bundle

- New pure module `src/sddExport.ts`:
  - `compileSddBundle(state: PageAppState): SddBundle` where
    `SddBundle = { spec: string; plan: string; tasks: string; combined: string }`.
  - **spec.md** — page title as H1; `note` Areas as context prose;
    `decision` Areas under `## Decisions` (with status and decided/open
    marker); `question` Areas under `## Open Questions`; `risk` Areas under
    `## Risks`; `api`/`ui-state` Areas under `## Contracts and States`.
  - **plan.md** — `component`/`file` Areas under `## Architecture` with
    evidence anchors rendered as `path:line` / URL references; nesting
    renders parent Area text as a subsection heading with children beneath;
    `implements`/`depends-on` links rendered as "Depends on: …" lines.
  - **tasks.md** — `task` Areas as a checklist: `- [x]` when status `done`,
    `- [ ]` otherwise, with `(blocked)` / `(in-progress)` annotations;
    ordered by dependency links first (topological where acyclic, stable
    reading order fallback on cycles), then reading order.
  - Deterministic ordering everywhere: sort by (y, x) reading order; identical
    input state must produce byte-identical output (this is tested).
  - Every compiled item carries a stable anchor comment
    `<!-- cascadery:area:<areaId> -->` on its own line so a future re-import
    or agent edit can address specific Areas.
- UI: command palette entries "Export SDD bundle" (downloads the three files
  sequentially with the existing download helper, names `spec.md`, `plan.md`,
  `tasks.md`) and "Copy SDD bundle" (copies `combined`, which concatenates the
  three with `# spec.md` / `# plan.md` / `# tasks.md` H1 separators).

### Import: SDD Markdown → canvas proposal

- New pure module `src/sddImport.ts`:
  - `parseSddMarkdown(markdown: string): SddImportResult` producing
    `{ sections: ImportedSection[]; warnings: string[] }` — headings become
    sections; list items under a Tasks-like heading become task items with
    checkbox → status mapping (`[x]` → `done`, `[ ]` → `open`); recognized
    section names (Decisions, Risks, Open Questions, Architecture) map to
    Area kinds; unrecognized content becomes `note` Areas. Existing
    `<!-- cascadery:area:… -->` anchors map back to Area ids so re-importing
    an edited export updates matching Areas instead of duplicating them
    (update = text/status only; never move or delete on import).
  - `layoutSddImport(result, existingState): PageAppState` fragment —
    sections become parent Areas in a left-to-right grid placed below the
    current content bounds (use `getCanvasWorldSize` /
    `CanvasBoundsItem` math from `src/canvasViewport.ts`), items become
    child Areas, following the `insertContextKit` placement conventions.
- UI: palette entry "Import spec/plan Markdown…" opens a dialog with a
  textarea (paste) and a file input; shows a summary preview (counts by kind
  + warnings) before applying; applies as one transaction (one undo step).
- Import is best-effort by design. Warnings (skipped constructs, cycles) are
  shown, never silently dropped. Export remains the canonical direction —
  document this asymmetry in the dialog copy.

### MCP surface

- New tools in `src/mcpGateway.ts` `toolDefinitions`:
  - `export_sdd` — scope `page:read`; args `{ pageId }`; returns the
    `SddBundle` as structured content. Agents use this to pull executable
    context without screen-scraping `get_page`.
  - `import_sdd` — scope `page:suggest`; args `{ pageId, markdown }`; runs
    `parseSddMarkdown` + `layoutSddImport` and returns an `AgentPatch`
    proposal (reusing the `suggestAreas`-style flow) that the human reviews
    and accepts in the UI. Never applies directly, regardless of scope.
- Record both in the MCP audit trail like existing tools
  (`recordMcpToolAction`).

## Non-Goals

- Spec Kit's exact file/directory conventions (`.specify/…`) — generic
  well-structured Markdown first; a Spec Kit flavor toggle is a fast-follow
  once the generic path is proven.
- Git integration (committing artifacts to a repo) — agents already have
  filesystem access; Cascadery hands them content.
- Lossless round-trip guarantees. Import that collides with concurrent canvas
  edits takes canvas-wins semantics on anything not matched by an anchor.
- Importing arbitrary non-SDD Markdown documents as a general outliner.

## Acceptance Criteria

- A page using decisions/tasks/risks/questions/components compiles to three
  Markdown files a coding agent can act on; compiling twice yields identical
  bytes.
- tasks.md checkbox state reflects Area status; dependency-linked tasks order
  correctly; cycles fall back to reading order with a warning.
- Importing a bundle into an empty page reproduces the structural content
  (kinds, statuses, section grouping); re-importing an edited export updates
  anchored Areas in place without duplication.
- Import applies as a single undo step and shows a preview with warnings
  first.
- `export_sdd` returns the bundle over MCP with `page:read`; `import_sdd`
  returns a reviewable proposal with `page:suggest` and cannot mutate the page
  directly; both are audited.
- Palette entries exist for export (download + copy) and import.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/sddExport.test.ts`: full-page fixture → snapshot of all three files;
  determinism (double compile); status/checkbox mapping; dependency ordering
  incl. a cycle; evidence anchor rendering; anchor comments present.
- `src/sddImport.test.ts`: parse fixtures (well-formed, messy headings,
  unknown sections, checkbox variants), anchor-matched re-import updates,
  layout placement below existing bounds, warning generation.
- `src/mcpGateway.test.ts`: extend for both tools — scope enforcement,
  proposal-only behavior of `import_sdd`, audit records.

## Open Questions

- Import size cap: `MAX_AGENT_OPERATIONS = 25` is too small for a real plan.
  Recommend a separate `MAX_IMPORT_OPERATIONS = 200` used by the import
  proposal path only, with the UI preview making large imports legible.
- Should `combined` output be the default copy target for chat-based agent
  workflows? Recommend: yes (single paste beats three files in chat).
- Zip download instead of three sequential downloads once a zip helper exists
  — do not add a zip dependency just for this.
