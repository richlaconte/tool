# Brand Positioning and Narrative System Spec

## Idea

Make Cascadery's product story explicit across the app, README, help copy, share surfaces, and first-run UX:

> Cascadery is a CSS-native context canvas for developers and coding agents.

The current product direction is strong, but the visible product language can still read like a general canvas or lightweight whiteboard. This spec turns the positioning into a small narrative system so every visible surface reinforces the same wedge.

## Status

Completed on 2026-06-30. The MVP narrative is reflected in README copy, app empty/help/share surfaces, command palette entries, and source-level tests.

## Research Basis

Market signals:

- Miro now describes its AI canvas as a place where "your team, your agents, and your context come together" and explicitly frames the canvas as a prompt enriched by team work and connected tools: https://miro.com/ai/ai-overview/
- Figma Make frames AI product work around idea-to-feature flow, design context, editable plans, MCP connectors, attachments, annotations, and version history: https://www.figma.com/make/
- tldraw's Agent Starter Kit shows a canvas agent model built around user input, selection, viewport, actions, screenshots, simplified shape data, and external context: https://tldraw.dev/starter-kits/agent
- Anthropic positions MCP as an open standard for secure, two-way connections between data sources and AI-powered tools: https://www.anthropic.com/news/model-context-protocol
- JSON Canvas emphasizes longevity, readability, interoperability, extensibility, and user ownership for infinite-canvas data: https://github.com/obsidianmd/jsoncanvas

Developer-market signals:

- Stack Overflow's 2025 survey says 84% of respondents are using or planning to use AI tools, but 66% are frustrated by AI solutions that are "almost right": https://survey.stackoverflow.co/2025
- JetBrains reports that 85% of developers regularly use AI tools, while developers still prefer to stay in charge of creative and complex tasks such as debugging and application logic design: https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
- GitLab's 2026 AI Accountability Report says 80% of organizations adopted AI tools faster than they developed governance policies, and 92% report governance challenges with AI-generated code: https://ir.gitlab.com/news/news-details/2026/GitLab-Research-Reveals-Organizations-Are-Generating-AI-Code-Faster-Than-They-Can-Control-It/default.aspx

HCI signals:

- Nielsen Norman Group argues that AI agents now function as users and that products need to design for both human and agent access patterns: https://www.nngroup.com/articles/ai-agents-as-users/
- Nielsen Norman Group's progressive-disclosure guidance supports showing only the most important options first and moving specialized capabilities behind deliberate entry points: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group's empty-state guidance supports using blank states to communicate status, teach the system, and provide direct paths to key tasks: https://www.nngroup.com/articles/empty-state-interface-design/

## Strategic Read

Do not compete as:

- A generic online whiteboard.
- A general notes app.
- A Figma or Miro replacement.
- A chatbot wrapper.
- A project-management suite.

Compete as:

- The developer context canvas between messy implementation thinking and reliable agent execution.
- A place where spatial notes become structured context.
- A place where CSS is a fast authoring language, not a visual-inspector burden.
- A place where agents can read the work without secretly rewriting it.
- A portable canvas whose data can outlive the product.

## Brand System

### One-Line Position

Use this in README, product docs, and future landing copy:

> Cascadery is a CSS-native context canvas for developers and coding agents.

### Short UI Tagline

Use this where space is tight:

> Map implementation context. Style it with CSS. Hand it to agents safely.

### Longer Product Description

Use this in README and product-direction docs:

> Cascadery helps developers map implementation intent on a spatial canvas: decisions, tasks, risks, files, UI states, links, and handoff notes. Humans shape the context visually with direct manipulation and CSS-native commands. Agents read the same canvas as structured context and propose reviewable changes.

### Product Pillars

Use these consistently as the visible proof points:

- Context: Areas, links, metadata, evidence, and decisions.
- CSS-native control: slash commands, tokens, snippets, and visible style state.
- Human-controlled agents: MCP, proposals, audit, review, and rollback.
- Portable data: Cascadery JSON, JSON Canvas, Markdown, and code/issue exports.

### Anti-Positioning

Avoid phrases that make Cascadery sound broader but weaker:

- "Whiteboard for everyone."
- "AI brainstorming tool."
- "Notes on an infinite canvas."
- "Design tool."
- "Project management."

Prefer phrases that name the job:

- "implementation context."
- "agent-readable canvas."
- "developer thinking."
- "CSS-native styling."
- "reviewable handoff."

## App Surface Changes

Primary visible surfaces should reinforce the same story:

- Empty canvas:
  - First line: "Map implementation context."
  - Secondary line: "Click anywhere to start, or choose a context kit."
- Help dialog:
  - Explain Areas, slash CSS, command palette, share/view-only, and agent handoff in one short list.
- Settings dialog:
  - Rename placeholder copy away from generic settings and toward page-level canvas preferences.
- View-only create CTA:
  - Keep `Create your own Cascadery canvas`.
  - Future hover/title can explain: "Start a fresh context canvas."
- README:
  - Start with the one-line position.
  - Add "Who this is for" and "What it is not."
- Share dialog:
  - Explain edit/view links as collaboration modes for implementation context, not generic document links.

## Information Architecture

Use these terms consistently:

- Page: a collaborative context canvas.
- Area: a spatial context object.
- Evidence: a file, URL, issue, PR, commit, command, or artifact that grounds an Area.
- Handoff brief: structured output for humans, agents, issues, or Markdown.
- Context kit: a starter canvas for a developer workflow.
- Agent proposal: a reviewable suggested canvas change.

Avoid introducing:

- Workspace.
- Database.
- Project.
- Board.
- Card.

These terms pull the product toward broader categories that are not the wedge yet.

## Acceptance Criteria

- README opens with the one-line position.
- Product copy uses "context canvas" and "developers and coding agents" consistently.
- Help copy explains the product using the four product pillars.
- Empty state introduces implementation context and points to context kits once those exist.
- Share/view-only copy keeps the clean viewer story but reinforces "create your own context canvas."
- No primary product surface describes Cascadery as a generic whiteboard, notes app, or design tool.
- Product-direction docs link to this spec as the canonical narrative system.

## Suggested Test Coverage

- `brandingAssets.test.ts` or a new `brandPositioningUi.test.ts`
  - asserts the README contains the one-line position.
  - asserts app source contains the short UI tagline.
  - asserts command/help copy contains context, CSS, handoff, and agents.
- Source-level tests for future first-run UI
  - assert empty-state copy says `context`.
  - assert no visible app copy uses `whiteboard`.

## Non-Goals

- Full marketing website.
- Pricing.
- Account/workspace naming.
- Visual rebrand.
- Logo redesign.
- Public examples gallery.

## Open Questions

- Should the short UI tagline appear permanently, or only in the empty state/help surfaces?
- Should "context canvas" replace "canvas" everywhere, or only in explanatory copy?
- Should the homepage route eventually show a product intro before creating a page, or should the app stay zero-friction and create a canvas immediately?
