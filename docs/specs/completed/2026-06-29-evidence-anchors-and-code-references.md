# Evidence Anchors and Code References Spec

## Idea

Add first-class evidence anchors to Areas so implementation context can point at real artifacts: files, code symbols, commits, PRs, issues, URLs, screenshots, terminal commands, docs, and external resources.

An Area should not only say "risk: auth redirect loop." It should be able to point to the route file, the reproduction issue, the failing test, and the screenshot that make the risk concrete.

## Status

Completed on 2026-06-30. The MVP supports Area evidence metadata, `/ref` slash commands, evidence chips, JSON persistence, Markdown/JSON Canvas export, MCP reads, and focused tests.

## Research Basis

Market and workflow signals:

- GitHub Copilot's coding agent starts from issues, produces pull requests, shows logs, incorporates issue/PR discussion, follows repository instructions, and can use images in issues as context: https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/
- Figma Make supports attachments, MCP connectors, annotations, version history, and design/code context so AI work is grounded in artifacts: https://www.figma.com/make/
- tldraw's Agent Starter Kit uses current selection, viewport, screenshots, simplified shape data, and external context as part of the agent context model: https://tldraw.dev/starter-kits/agent
- Anthropic MCP is an open standard for connecting AI tools to external data sources, which makes structured references more valuable than plain text mentions: https://www.anthropic.com/news/model-context-protocol
- JSON Canvas emphasizes readable, extensible canvas data that other apps and scripts can enhance: https://github.com/obsidianmd/jsoncanvas

Developer-market signals:

- JetBrains reports that developers see AI's lack of context awareness as a top concern, alongside inconsistent code quality and privacy/security risks: https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
- Stack Overflow reports broad AI usage but high frustration with answers that are almost right, suggesting a need for better grounding and review context: https://survey.stackoverflow.co/2025

## Product Rationale

Cascadery's wedge is implementation context. Metadata and links describe the shape of the work; evidence anchors ground that shape in reality.

Evidence anchors help:

- Humans verify why an Area exists.
- Agents retrieve the right context without reading the whole canvas.
- Exports produce useful issues, PRDs, and handoff briefs.
- View-only readers understand decisions faster.
- Future search can filter by real artifacts, not only text.

## User Experience

Area-level anchors:

- Each Area can show a compact row of evidence chips.
- Chips are low-noise and wrap if needed.
- Chip labels are short: `App.tsx`, `#123`, `PR 42`, `screenshot`, `curl /api`.
- Hover/title reveals full target.
- Clicking a URL opens it in a new tab.
- Clicking a file/code reference copies or opens the reference when the app can support it; MVP can copy to clipboard.

Adding anchors:

- Command palette action: `Add evidence to selected Area`.
- Slash command inside an Area:
  - `/ref src/App.tsx`
  - `/ref https://github.com/org/repo/pull/42`
  - `/ref issue #123`
  - `/ref command pnpm test`
- Future drop support:
  - dropping a URL or text path onto an Area creates an evidence anchor.

Editing anchors:

- A small edit/delete control appears when the Area is selected.
- View-only users can see and open/copy anchors but cannot edit them.

## Evidence Kinds

Start with these kinds:

- `file`: repository or local file path.
- `symbol`: code symbol or component name.
- `url`: external URL.
- `issue`: issue/task link or ID.
- `pull-request`: PR link or ID.
- `commit`: commit hash or URL.
- `command`: shell command or test command.
- `asset`: image or uploaded artifact.
- `note`: freeform evidence label when kind detection is uncertain.

## Data Model

Extend Area metadata with evidence references:

```ts
type AreaEvidenceReference = {
  id: string
  kind: 'file' | 'symbol' | 'url' | 'issue' | 'pull-request' | 'commit' | 'command' | 'asset' | 'note'
  label: string
  target: string
  createdAt: string
  updatedAt?: string
}

type AreaMetadata = {
  ...
  evidence?: AreaEvidenceReference[]
}
```

Rules:

- Evidence anchors are optional.
- Labels should be generated conservatively and editable later.
- Targets are stored as user-provided strings, not fetched content.
- Do not store external page contents in page JSON.
- Evidence anchors must serialize through Cascadery JSON.
- JSON Canvas export should preserve evidence as custom node metadata when possible.
- Markdown export should include evidence under each Area.
- MCP read resources should include evidence for agent context.

## Detection Rules

MVP detection can be simple:

- `http://` or `https://` -> `url`.
- `#123` or `ISSUE-123` -> `issue`.
- `PR 123`, `pull/123`, or `/pull/123` -> `pull-request`.
- 7+ hex characters with optional `commit` keyword -> `commit`.
- strings containing `/`, `.`, and a code-like extension -> `file`.
- strings starting with `pnpm`, `npm`, `yarn`, `node`, `curl`, `git`, or `npx` -> `command`.
- otherwise -> `note`.

Avoid network validation for MVP.

## Accessibility

- Evidence chips are buttons or links with accessible names.
- Delete/edit controls have visible focus states.
- Keyboard users can tab through anchors on a selected Area.
- View-only anchors remain keyboard reachable if they are links or copy buttons.
- Long targets should not cause layout overflow.

## Acceptance Criteria

- Users can add an evidence anchor to a selected Area.
- Users can add an evidence anchor with `/ref`.
- Evidence chips render on Areas without covering text editing.
- Evidence anchors persist through Cascadery JSON.
- Markdown export includes Area evidence.
- MCP page/Area read resources include evidence anchors.
- View-only users can see and open/copy evidence but cannot edit it.
- Evidence anchors do not fetch or store external content.

## Suggested Test Coverage

- `areaEvidence.test.ts`
  - detects evidence kinds from common inputs.
  - creates and deletes evidence anchors immutably.
  - generates readable labels.
- `areaEvidenceUi.test.ts`
  - app renders evidence chips.
  - selected Area exposes evidence edit controls.
  - view-only mode hides evidence mutation controls.
- `pagePersistence.test.ts`
  - serializes and parses evidence anchors.
- `pageExports.test.ts`
  - Markdown export includes evidence.
  - JSON Canvas export preserves evidence metadata.
- `mcpGateway.test.ts`
  - Area read resources include evidence references.

## Non-Goals

- GitHub API integration.
- File picker or local filesystem browsing.
- Fetching external URLs.
- Rich previews for links.
- Semantic code indexing.
- Repo clone or code search.

## Open Questions

- Should file references eventually integrate with GitHub URLs when a page has a repository setting?
- Should evidence anchors be visible all the time or only on hover/selection?
- Should `/ref` remove the typed command text after commit, matching CSS and image slash command behavior?
