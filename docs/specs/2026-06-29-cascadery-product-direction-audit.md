# Cascadery Product Direction Audit

## Status

Created on 2026-06-29 after a direction and spec audit.

## Audit Verdict

Do not pivot away from the current thesis. Narrow it.

Cascadery should stay a CSS-native canvas for developer thinking, but the positioning should become more explicit:

> Cascadery is a developer context canvas: a spatial, CSS-stylable place where humans and coding agents can understand, shape, and preserve implementation intent.

The strongest wedge is not generic whiteboarding, generic notes, or general-purpose AI chat. The strongest wedge is structured implementation context:

- People map features, decisions, UI states, risks, code references, and handoff notes.
- Teams collaborate around implementation intent, not just diagrams.
- Agents read the page as structured context and propose visible, reversible changes.
- CSS remains a distinctive expert-friendly editing language, but should not be the only product story.

## Research Basis

Market signals:

- Obsidian Canvas frames infinite canvas work as visual organization for research, brainstorming, diagrams, notes, images, PDFs, videos, audio, and web embeds: https://obsidian.md/canvas
- JSON Canvas emphasizes longevity, readability, interoperability, extensibility, and user ownership for infinite-canvas data: https://github.com/obsidianmd/jsoncanvas
- Miro's official MCP server connects AI agents and coding tools directly to Miro boards for search, summaries, structured board creation, and diagrams: https://developers.miro.com/docs/miro-mcp
- tldraw's Agent Starter Kit demonstrates agents that can interpret and manipulate a canvas, using selection, viewport, actions, screenshots, and simplified shape data as context: https://tldraw.dev/starter-kits/agent
- Figma now frames AI around explore, polish, and ship workflows, including agents, diagrams, image editing, search, and MCP-backed code/prototype flows: https://www.figma.com/ai/

UX and security signals:

- Nielsen Norman Group notes that AI agents are becoming users of interfaces, which means products should support both human and agent access patterns: https://www.nngroup.com/articles/ai-agents-as-users/
- WAI-ARIA modal guidance reinforces that command/dialog work needs correct focus containment and Escape behavior: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- OWASP WebSocket guidance recommends message-level authorization, validation, size limits, rate limiting, heartbeat/idle cleanup, and security logging: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
- MCP security guidance recommends reading MCP security and authorization together and treating MCP implementations as a security-sensitive surface: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices

## Strategic Implications

### Keep

- CSS slash commands as a distinctive, developer-native interaction.
- Spatial canvas primitives: Areas, nesting, images, links, comments, and metadata.
- Server-backed collaboration.
- MCP as the agent integration layer.
- Human review for agent changes.
- Durable JSON and future export portability.

### Change Emphasis

- Lead with developer context and implementation intent, not "notes" or "whiteboard."
- Treat AI as a reader/proposer of canvas changes, not the main interface.
- Treat data ownership/export as a product pillar, not a backup feature.
- Treat security and permissions as foundational now that hosted collaboration and MCP exist.
- Treat semantic structure as necessary for agents, not optional power-user metadata.

### Avoid

- Building a broad Miro/FigJam replacement.
- Turning CSS styling into a dense design-inspector product before the developer-context loop works.
- Letting agents mutate shared pages without review, audit, and rollback.
- Adding workspace/account complexity before share enforcement and document history are strong.
- Hiding all powerful actions inside shortcuts without command palette accessibility.

## Recommended Product Pillars

### 1. Developer Context Canvas

Cascadery pages should make implementation intent visible: decisions, risks, tasks, files, components, UI states, API contracts, and open questions.

Required foundations:

- Area types and metadata.
- Links/connectors between Areas.
- Decision and task extraction.
- Markdown and issue export.

### 2. CSS-Native Editing

CSS should remain a fast, expressive authoring language.

Required foundations:

- Better command system and autocomplete.
- Reusable style snippets.
- Token-preserving theme colors.
- Clear invalid-state feedback.

### 3. Collaborative Document Trust

Collaboration needs confidence: access mode, save/sync state, history, undo, snapshots, and view/edit enforcement.

Required foundations:

- Server-enforced share links.
- Version history/change log.
- Structured security logging.
- Recovery from bad changes.

### 4. Agent-Readable, Human-Controlled AI

Agents should read, summarize, and propose. Humans should accept, reject, revise, and roll back.

Required foundations:

- MCP least-privilege scopes.
- Agent proposal review.
- Audit records.
- Permissioned remote MCP before write access.

### 5. Portable Canvas Data

Cascadery should earn trust by making data legible and movable.

Required foundations:

- Stable Cascadery JSON.
- JSON Canvas export/import mapping.
- Markdown export.
- Asset export policy.

## Spec Audit Summary

Moved completed MVP specs to `docs/specs/completed/`:

- Area duplicate action.
- Area resize.
- Area toolbar delete.
- Multi-user collaboration.
- Nested Areas.
- Page JSON persistence.
- Snap grid.
- Theme color shortcuts.

Kept active:

- Security and privacy baseline.
- Share links.
- AI and MCP agent interface.
- Command palette completion.
- Image support.
- Canvas zoom.
- Product and developer experience direction.

Added foundational specs:

- Area types, metadata, and links.
- Version history and change review.
- Interoperability and export.

## Pivot Recommendation

No major pivot. Make a positioning refinement:

Before:

> CSS-native canvas for developer thinking.

After:

> CSS-native context canvas for developers and coding agents.

Use the shorter tagline in UI. Use the fuller version in README, product copy, and specs.

