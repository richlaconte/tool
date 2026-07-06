# SDD Fidelity: EARS Requirements and Spec Kit Layout Compatibility

## Status

Priority: P1 — queue #2 (2026-07-06 audit). See the Priority Queue in README.md before starting work.

Created on 2026-07-05 from a market and product research pass. Active.
This is v2 of the completed SDD artifact interchange spec
(completed/2026-07-02-sdd-artifact-interchange.md), which deliberately chose
"generic well-structured Markdown first, Spec Kit's file naming second."
The market has now decided: second is due.

## Goal

Spec-driven development went mainstream in the first half of 2026: GitHub
Spec Kit crossed ~90k stars, AWS Kiro reached broad availability in May, and
EARS (Easy Approach to Requirements Syntax) became the de facto notation for
agent-executable requirements. Cascadery's SDD export produces good generic
Markdown; the ecosystem now expects artifacts in specific shapes. This spec
makes the canvas compile to and from the Spec Kit file layout, gives
requirement authoring an EARS scaffold with gentle lint, and surfaces
requirement→task traceability so a page can answer "is every requirement
covered by a task?" — the question SDD tooling grades teams on.

## Research Basis

- Spec Kit scale and file conventions (spec.md / plan.md / tasks.md per
  feature directory, constitution): https://github.com/github/spec-kit and
  https://github.github.com/spec-kit/
- SDD as 2026 default practice, EARS notation adoption:
  https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2
  and https://www.buildthisnow.com/blog/real-examples/spec-driven-development-explained
- Tooling landscape (Kiro, spec-kit, Tessl) and where artifacts diverge:
  https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- Refined-spec error-reduction findings summarized in:
  https://www.marktechpost.com/2026/05/08/9-best-ai-tools-for-spec-driven-development-in-2026-kiro-bmad-gsd-and-more-compare/

## Current State

- Export: `compileSddBundle` (`src/sddExport.ts`) builds an `SddBundle`
  from `SPEC_SECTIONS`/`PLAN_SECTIONS`/`TASK_SECTION`, orders tasks by
  dependency (`orderTasksByDependency`), and embeds stable area anchors
  (`cascadery:area:` comments) for round-trip identity.
- Import: `parseSddMarkdown` / `layoutSddImport` / `buildSddImportPatch`
  (`src/sddImport.ts`) turn sectioned Markdown into laid-out Areas; agent
  imports flow through the proposal path.
- MCP: `export_sdd` and `import_sdd` tools exist (`src/mcpGateway.ts`).
- Area kinds include `decision`, `task`, `risk` (`src/areaMetadata.ts`);
  links between Areas exist with labels/direction. There is no
  requirement-specific structure: a requirement is just a note, nothing
  checks whether tasks trace to requirements, and export has no
  Spec Kit-shaped profile.

## Scope

### Spec Kit layout profile

- Add an export profile parameter (`generic` | `spec-kit`, default
  `generic` — no behavior change for existing users). The `spec-kit`
  profile emits the bundle as Spec Kit's expected artifact set: a feature
  directory name derived from the page title
  (`NNN-kebab-title` with a user-editable slug), `spec.md`, `plan.md`,
  `tasks.md` with the section headings and checklist shapes Spec Kit's
  templates use. Verify exact headings against the pinned Spec Kit version
  during implementation and record the version in the module docs.
- Download as a zip of the three files (client-side, no new server
  surface) plus the existing single-document option.
- `import_sdd` accepts the same profile: given the three files (or pasted
  contents), reuse the existing section parser with a Spec Kit heading
  map. Import remains best-effort, never claimed lossless (unchanged
  principle from v1).
- Expose the profile on the `export_sdd` / `import_sdd` MCP tools as an
  optional argument.

### EARS requirement scaffold

- New Area kind `requirement` (`src/areaMetadata.ts`, extending
  `AREA_KINDS`; JSON and Yjs round-trip like existing kinds; JSON Canvas
  export maps it through the existing extension namespace).
- Command palette / slash scaffolds inserting the five EARS patterns as
  editable text templates (ubiquitous "The system shall…", event-driven
  "When…", state-driven "While…", optional-feature "Where…", unwanted
  "If…, then…"). Scaffolds are plain text in the Area — no new storage
  format; EARS is a writing discipline, not a schema.
- Gentle lint (new pure module `src/earsLint.ts`): on requirement Areas
  only, flag statements matching known-untestable vagueness ("fast",
  "user-friendly", "robust", missing "shall") as a dismissible hint in the
  Area metadata UI — never a blocker, never auto-rewrite. Keep the rule
  list small (~10 rules) and documented in the module.

### Traceability and coverage

- Convention: a link from a `task` Area to a `requirement` Area means
  "implements". The export renders, under each requirement, references to
  its implementing tasks (and each task line lists its requirement refs) —
  reusing existing link data, no new link semantics stored.
- Coverage query (pure, `src/sddTraceability.ts`): requirements with zero
  linked tasks, tasks linked to no requirement. Surfaced as a section in
  the export's open-questions/gaps output and as a command palette action
  ("Show uncovered requirements") that selects the offending Areas
  (multi-select shipped 2026-07-02).

## Non-Goals

- A structured requirement schema (fields for actor/trigger/response) —
  text plus discipline first; schema only if usage demands it.
- Kiro/Tessl/BMAD-specific profiles (Spec Kit is the open, dominant
  layout; others map through generic or arrive as demand shows).
- Auto-generating requirements from code or tasks.
- Enforcing EARS (lint hints only).
- Writing files into a repo — Cascadery emits artifacts; the agent or
  human places them (evidence-anchor v2 territory otherwise).

## Acceptance Criteria

- Exporting a page with requirements, tasks, decisions, and risks in
  `spec-kit` profile yields three files whose headings and checklist
  syntax match the pinned Spec Kit template version; area anchors survive
  in all three.
- Importing that export reproduces the structural content on a blank page
  (v1's fidelity bar, now across the three-file shape).
- The `requirement` kind round-trips JSON, Yjs sync, JSON Canvas
  (namespaced), and Markdown export; existing pages are unaffected.
- EARS scaffolds insert correct editable templates; the lint flags a
  vague requirement and stays silent on a well-formed EARS statement;
  dismissing a hint persists for that Area.
- Coverage: a requirement with no task link appears in the gaps output
  and the palette action selects it; linking a task clears it.
- `generic` profile output is byte-identical to pre-spec behavior.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/sddExport.test.ts`: profile switching, Spec Kit heading fixtures,
  requirement/task cross-references, anchor persistence.
- `src/sddImport.test.ts`: three-file parse, heading-map fallbacks,
  best-effort behavior on partial bundles.
- New `src/earsLint.test.ts`: each rule fires and each has a passing
  counterexample; dismissal state.
- New `src/sddTraceability.test.ts`: coverage over linked/unlinked
  fixtures, direction handling, nested-Area cases.
- `src/mcpGateway.test.ts`: profile argument on both tools, invalid
  profile rejected.

## Open Questions

- Spec Kit template drift: pin to the version verified at implementation
  and note a re-check cadence, or track latest? Recommend: pin + record.
- Should the constitution file be a fourth export target sourced from a
  dedicated Area? Recommend: defer; page-level principles usually live in
  decision Areas already.
- Feature-number (`NNN`) assignment on export: user-entered vs. always
  `001`? Recommend: user-editable field defaulting to `001` — Cascadery
  cannot see the repo's existing numbering.
