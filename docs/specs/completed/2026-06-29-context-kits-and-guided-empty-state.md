# Context Kits and Guided Empty State Spec

## Idea

Replace the blank-canvas first-run moment with lightweight context kits: one-click starter canvases for common developer workflows. The goal is not a heavy template gallery. The goal is to help users understand what Cascadery is for within seconds.

Initial kits:

- Implementation Map.
- Visual RFC.
- UI State Matrix.
- Bug Triage.
- Agent Handoff.

## Status

Completed on 2026-06-30. The MVP includes static context kits, guided empty-state kit insertion, command-palette kit insertion, persistence through normal Area state, and focused tests.

## Research Basis

Market signals:

- FigJam AI uses prompt/template entry points to populate boards and help teams get started with recognizable workflows: https://www.figma.com/figjam/ai/
- Figma Make offers prompt chips such as onboarding flows and dashboards, and supports plan mode so users can clarify intent before generation: https://www.figma.com/make/
- Miro positions its canvas around team workflows, connected context, and AI that understands the work already on the canvas: https://miro.com/ai/ai-overview/
- Obsidian Canvas and JSON Canvas show that users value durable, portable canvas structures that can be enhanced by apps, scripts, and plugins: https://obsidian.md/canvas and https://github.com/obsidianmd/jsoncanvas

HCI signals:

- Nielsen Norman Group's empty-state guidance says blank states should communicate status, increase learnability, and provide direct paths to key tasks: https://www.nngroup.com/articles/empty-state-interface-design/
- Nielsen Norman Group's progressive-disclosure guidance supports starting with a few important options and revealing specialized options only on request: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group's recognition-rather-than-recall heuristic supports showing recognizable starter choices instead of requiring users to remember abstract commands: https://www.nngroup.com/articles/ten-usability-heuristics/

## Product Rationale

Cascadery's current empty state teaches mechanics: click, type, press Escape, use slash commands. It does not yet teach the product category. Context kits should make the brand positioning concrete:

- This is not an empty whiteboard.
- This is a developer context canvas.
- Areas can represent decisions, tasks, files, risks, UI states, and agent instructions.
- CSS styling is a practical layer over structured context.

Kits should reduce time-to-value without hiding the direct canvas workflow.

## User Experience

Empty canvas state:

- First line: `Map implementation context.`
- Secondary line: `Click anywhere to start, or choose a context kit.`
- Show 3 to 5 compact kit buttons below the text.
- Keep the existing direct click-to-create behavior.
- Keep typing behavior for the command palette in edit mode.
- Do not show the guided empty state in view-only mode.

Kit picker:

- Appears in the empty state.
- Also appears in the command palette as `Insert context kit`.
- Uses compact buttons, not large marketing cards.
- Each kit has:
  - icon.
  - title.
  - one-line outcome.
  - optional "Preview" later, but not required for MVP.

After inserting a kit:

- Add a small set of Areas with meaningful copy and metadata.
- Select the first user-editable Area.
- Mark the canvas as clicked so the empty state disappears.
- Preserve undo/history if page history is available.
- Do not overwrite existing content unless the user explicitly inserts a kit from the command palette.

## Initial Kits

### Implementation Map

Purpose:

- Plan a feature or refactor before code.

Starter Areas:

- Goal.
- Files/components touched.
- Decisions.
- Risks.
- Tasks.
- Validation plan.

### Visual RFC

Purpose:

- Discuss technical tradeoffs and decision paths.

Starter Areas:

- Problem.
- Option A.
- Option B.
- Decision.
- Follow-up questions.

### UI State Matrix

Purpose:

- Map product UI states before implementation.

Starter Areas:

- Happy path.
- Empty state.
- Loading state.
- Error state.
- Permission/read-only state.
- Mobile considerations.

### Bug Triage

Purpose:

- Capture reproduction, evidence, suspected causes, and verification.

Starter Areas:

- Symptom.
- Reproduction steps.
- Evidence.
- Suspected causes.
- Fix plan.
- Regression checks.

### Agent Handoff

Purpose:

- Prepare a clear brief for a coding agent.

Starter Areas:

- Objective.
- Scope.
- Constraints.
- Relevant files.
- Acceptance criteria.
- Review notes.

## Data Model

Kits can be local static definitions at first:

```ts
type ContextKit = {
  id: string
  title: string
  description: string
  areas: ContextKitArea[]
  links?: ContextKitLink[]
}

type ContextKitArea = {
  id: string
  kind?: AreaMetadata['kind']
  status?: AreaMetadata['status']
  text: string
  x: number
  y: number
  width: number
  height: number
  styles?: Record<string, string>
}
```

Rules:

- Inserted Areas become normal Areas with fresh IDs.
- Kit-local links become normal Area links with fresh IDs.
- Use existing metadata and link structures.
- Do not add a server/template table for MVP.

## Visual Direction

- Keep the empty state light grey and centered.
- Kit buttons should read as "ways to begin," not as a dashboard.
- Avoid giant cards, decorative illustrations, and marketing copy.
- Use calm icons and short labels.
- Do not block the canvas; clicking anywhere outside the kit buttons still creates an Area.

## Acceptance Criteria

- Empty canvas explains the product job, not only mechanics.
- Empty canvas offers at least three context kits.
- Clicking a kit inserts multiple typed Areas and any starter links.
- Inserted kit Areas are normal editable Areas.
- Kit insertion is available from the command palette.
- Kit insertion does not appear in view-only mode.
- Direct click-to-create and direct typing still work.
- Page history records kit insertion as one recoverable change if history is available.
- Existing persistence serializes kit-created Areas without schema changes.

## Suggested Test Coverage

- `contextKits.test.ts`
  - each kit has a title, description, and at least three Areas.
  - kit insertion creates fresh IDs.
  - kit links point to inserted Area IDs.
- `contextKitsUi.test.ts`
  - app source renders the guided empty-state copy.
  - app source exposes context kit buttons only when editor chrome is visible.
  - command palette includes `Insert context kit`.
- Existing persistence tests
  - kit-created Areas round-trip through page JSON.

## Non-Goals

- Public template marketplace.
- User-created templates.
- AI-generated templates.
- Multi-step onboarding tour.
- Replacing direct canvas creation.
- Server-side template management.

## Open Questions

- Should the empty state show all five kits or only the top three with "More" in the command palette?
- Should context kits include CSS styling by default, or start plain to avoid implying visual design work?
- Should a kit insertion ask for a page title first, or keep the first version one-click?
