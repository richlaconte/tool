# Cascadery

Cascadery is a CSS-native context canvas for developers and coding agents.

It is a collaborative spatial workspace where implementation context lives as movable Areas: notes, sketches, decisions, risks, tasks, UI states, files, images, and architecture fragments. Cascadery assumes its users are comfortable with the web platform: an Area can be styled directly with CSS slash commands, arranged spatially, nested inside other Areas, shared with collaborators, and read or updated by AI agents through controlled, reviewable MCP workflows.

## Who this is for

- Developers planning features, refactors, bug hunts, UI states, and agent handoffs.
- Teams that need implementation context to stay visible, spatial, portable, and reviewable.
- People who prefer CSS-native controls over hidden visual inspectors.

## What it is not

- A generic meeting whiteboard.
- A general-purpose notes app.
- A replacement for Figma, Miro, Linear, GitHub, or a coding agent.

## Product Direction

Cascadery is not trying to be a general notes app or another meeting whiteboard. The sharpest wedge is developer-native implementation context:

- Map an implementation before touching code.
- Turn an issue, PRD, or repo scan into a visual plan.
- Discuss architecture and UI states asynchronously with enough structure to preserve decisions.
- Use CSS as an editing language instead of hiding all styling behind palettes and inspectors.
- Give coding agents a readable, writable project context surface without making chat the center of the product.
- Preserve decisions, risks, and handoff context in a durable, portable document.

Working UI tagline:

> CSS-native canvas for developer thinking.

Full product direction:

> CSS-native context canvas for developers and coding agents.

## Current Capabilities

- Click the canvas to create a text Area.
- Move, resize, duplicate, delete, and nest Areas.
- Style Areas with CSS slash commands such as `/border: 1px solid red`.
- Define page theme color tokens and use them inside style commands.
- Insert and replace images.
- Toggle snap-grid movement and grid visibility.
- Import and export durable page JSON.
- Generate edit and view links.
- Show save status, access mode, connection status, and collaborator presence.
- Run server-backed collaboration through the Next.js custom server and Hocuspocus/Yjs.

## Research-Informed Principles

Cascadery's follow-up specs are grounded in current market and interaction research:

- Infinite-canvas tools such as tldraw, Obsidian Canvas, Heptabase, Miro, and FigJam show that spatial canvases work best when they combine lightweight creation with durable structure.
- Developer teams need accelerators, but they still need visible, discoverable commands. Cascadery should support keyboard-first experts without becoming invisible to newer users.
- Collaboration should expose clear save, sync, connection, access, and agent-action status.
- AI should act through explicit, reviewable operations. It should summarize, organize, annotate, and create Areas, but sensitive or destructive changes need human approval.
- MCP support should use least privilege, clear consent, tool allow-lists, structured outputs, audit logs, and fail-closed behavior.

## Follow-Up Specs

- [Spec Index](docs/specs/README.md)
- [Product Direction Audit](docs/specs/2026-06-29-cascadery-product-direction-audit.md)
- [Product and Developer Experience Direction](docs/specs/2026-06-26-cascadery-product-dx.md)
- [AI and MCP Agent Interface](docs/specs/2026-06-26-cascadery-ai-mcp-interface.md)
- [Security and Privacy Baseline](docs/specs/2026-06-26-cascadery-security-privacy.md)

Completed MVP specs are archived under [docs/specs/completed](docs/specs/completed).

## Development

Use Node.js `>=24.11.0 <25`.

```bash
pnpm install
pnpm dev
```

The development server runs the custom Next.js/Hocuspocus server from `server.ts`.

Build:

```bash
pnpm build
```

Lint:

```bash
pnpm lint
```

## AI Posture

AI in Cascadery should feel like an interface to the canvas, not the product's personality. The preferred model is:

- Human and team context lives on the canvas.
- Agents can read board structure through MCP.
- Agents propose changes as structured patches.
- Users can review, accept, reject, or roll back those changes.
- Security boundaries are enforced by the app, not delegated to prompts.

## Domain

Preferred name: `Cascadery`

Preferred domain to verify and purchase: `cascadery.com`

The initial availability research found a strong "likely available" signal for `cascadery.com`, but final domain choice still needs registrar checkout and a trademark search.
