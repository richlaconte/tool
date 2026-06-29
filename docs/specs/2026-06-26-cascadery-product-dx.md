# Cascadery Product and Developer Experience Spec

## Status

Created on 2026-06-26 after choosing the name Cascadery.

Audited on 2026-06-29. Keep this as the product philosophy spec. The refined direction is:

> Cascadery is a CSS-native context canvas for developers and coding agents.

The shorter UI tagline remains "CSS-native canvas for developer thinking." Product and roadmap decisions should favor implementation context, safe agent readability, document trust, and data portability over broad whiteboard parity.

## Goal

Define Cascadery as a developer-native spatial workspace: a CSS-stylable canvas for implementation thinking, architecture discussion, UI exploration, and agent-readable project context.

## Positioning

Cascadery should not lead with "notes" or "whiteboard." Those categories are crowded and too broad. The product should lead with the developer behavior that makes it unusual:

> Cascadery is a CSS-native canvas for developer thinking.

Primary audience:

- Frontend engineers.
- Full-stack developers who think visually.
- Technical founders and product engineers.
- Small teams collaborating on implementation details before or during build work.
- AI-assisted developers who need a structured context surface for coding agents.

Primary alternatives:

- General whiteboards: Miro, FigJam, Excalidraw.
- Canvas SDKs or primitives: tldraw.
- Visual knowledge bases: Obsidian Canvas, Heptabase, Allume.
- Product-team systems: Linear, Notion, Campsite-style async communication.

Cascadery's differentiation is the combination of spatial thinking, web-native styling, developer shorthand, durable JSON/state, real-time collaboration, and future MCP-based agent operations.

## Research Basis

Market and product research:

- tldraw positions its SDK around high-performance web canvases, multiplayer sync, selection/transformation, custom shapes, themes, and accessibility: https://tldraw.dev/
- Obsidian Canvas emphasizes infinite visual organization, embedded media, nested canvases, extensibility, and an open JSON canvas format: https://obsidian.md/canvas
- Heptabase positions whiteboards and cards as a way to clarify thinking, connect sources, notes, highlights, and discussions, and now exposes AI/CLI workflows for agents: https://heptabase.com/
- Allume/Muse emphasizes nested boards and organic spatial thinking: https://allume.com/
- Miro and FigJam are moving toward AI-assisted team canvases, including diagrams, workflows, and coding-agent context: https://miro.com/ and https://www.figma.com/figjam/

HCI and UX research:

- Nielsen Norman Group's visibility-of-system-status heuristic supports clear save, sync, connection, access, and agent-action states: https://www.nngroup.com/articles/visibility-system-status/
- Nielsen Norman Group's flexibility-and-efficiency heuristic supports accelerators for expert users, while keeping commands discoverable and unobtrusive: https://www.nngroup.com/articles/flexibility-efficiency-heuristic/
- Nielsen Norman Group's UI-copy shortcut guidance recommends not overriding standard shortcuts and showing accelerators next to visible commands: https://www.nngroup.com/articles/ui-copy/
- WAI-ARIA dialog guidance requires modal content to manage focus, keep background content inert, and support Escape/Tab behavior: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

## Product Principles

- CSS is a feature, not leakage. Users should feel rewarded for knowing CSS.
- Spatial work should remain fast. Clicking, typing, dragging, duplicating, resizing, and styling should take very few steps.
- Structure should emerge from use. Nested Areas, theme tokens, and future links should organize without forcing a rigid document model up front.
- Expert shortcuts must have visible counterparts. Command palette and slash commands are accelerators, not the only path.
- System status should be obvious but calm. Save, sync, connection, access mode, and agent activity should be visible without stealing attention.
- Collaboration should preserve intent. Remote cursors, selections, and edit status should make multiplayer feel natural, not noisy.
- AI should propose visible changes to the canvas. Avoid hidden transformations that leave users wondering what changed.

## Core User Workflows

### Implementation Map

A developer creates a new page for a feature or bug, adds Areas for files, components, risks, decisions, and tasks, then styles them using simple CSS commands. The team can discuss and rearrange the map before or during implementation.

Required follow-up capabilities:

- Area links or connectors.
- Area types such as decision, question, task, file, component, risk, and code reference.
- Lightweight metadata per Area without turning every Area into a form.
- Export to Markdown or issue/task systems.

Tracking specs:

- [Area Types, Metadata, and Links](2026-06-29-area-types-metadata-and-links.md)
- [Interoperability and Export](2026-06-29-interoperability-and-export.md)

### Visual RFC

A team lays out architecture options, API contracts, UI states, and tradeoffs. Decisions are marked explicitly and remain searchable.

Required follow-up capabilities:

- Decision markers and decision log extraction.
- Comment threads attached to Areas.
- Read-only and edit share links enforced server-side.
- Version history or snapshots for major decisions.

Tracking specs:

- [Share Links](completed/2026-06-26-share-links.md)
- [Version History and Change Review](2026-06-29-version-history-and-change-review.md)

### CSS-Native UI Scratchpad

A frontend developer mocks layout states with text/image Areas and CSS slash commands. Theme tokens let them approximate product/system colors.

Required follow-up capabilities:

- CSS autocomplete and validation hints.
- Reusable style snippets.
- Token-preserving styles so theme updates can propagate.
- Area templates for common UI states.

Tracking specs:

- [Command Palette Completion](completed/2026-06-26-command-palette-completion.md)
- [Area Types, Metadata, and Links](2026-06-29-area-types-metadata-and-links.md)

### Agent Context Board

A coding agent reads a page, summarizes the implementation map, proposes missing risks, creates Areas for a repo scan, and updates a decision summary after a code change.

Required follow-up capabilities:

- MCP resources and tools for pages, Areas, assets, and comments.
- Patch preview before agent writes are applied.
- Audit trail for agent actions.
- Permission scopes for read-only, suggest-only, and write modes.

Tracking specs:

- [AI and MCP Agent Interface](2026-06-26-cascadery-ai-mcp-interface.md)
- [Version History and Change Review](2026-06-29-version-history-and-change-review.md)
- [Security and Privacy Baseline](2026-06-26-cascadery-security-privacy.md)

## Interaction Model

### Canvas

- Click or keyboard command creates a new Area.
- Drag handle moves an Area.
- Resize handle changes dimensions.
- Toolbar actions duplicate/delete an Area.
- Nesting should be visually legible through containment and parent selection states.
- Snap grid should be discoverable from the command palette and a visible page control.

### Area Editing

- Text entry remains direct and low-friction.
- CSS slash commands apply style declarations and remove the command text only after a valid commit.
- Invalid commands should remain editable and show a low-noise inline invalid state.
- Theme token resolution should be visible when users need confidence, for example through command preview or swatches.

### Command Surfaces

- Slash commands: Area-local styling and insertion.
- Command palette: global/page/selection actions.
- Context toolbar: direct manipulation actions.
- Future inspector: richer editing for users who do not want to type CSS.

### Collaboration

- Presence row shows who is present.
- Remote cursors and selected Area outlines must not block pointer events.
- Connection and save state must be visible.
- View-only mode should remove edit affordances rather than presenting a disabled editor.

## Information Architecture

Recommended top-level concepts:

- Page: one collaborative canvas.
- Area: a positioned canvas object.
- Asset: uploaded or linked media.
- Theme: page-level tokens and settings.
- Share: access links and eventual permission state.
- Presence: live collaborator state.
- Agent action: an AI/MCP operation that read or changed the page.

Avoid introducing large concepts too early:

- Workspace/team accounts.
- Databases.
- Complex project management.
- Full design-system management.

## Acceptance Criteria

- README and UI copy consistently use the name Cascadery.
- The app can describe itself in one line: "CSS-native canvas for developer thinking."
- Command palette entries and visible controls expose the same major actions.
- Save, connection, access, and collaboration status are visible.
- Invalid CSS commands are understandable and recoverable.
- Future AI actions are represented as explicit proposed or applied canvas changes.

## Open Questions

- Should Cascadery pages eventually live as local files, cloud documents, or both?
- Should `cascadery.com` be the product site and `app.cascadery.com` the editor?
- Should Area styles preserve token references or only resolved CSS values?
- Which Area metadata should exist before comments/connectors: type, tags, status, or all three?
