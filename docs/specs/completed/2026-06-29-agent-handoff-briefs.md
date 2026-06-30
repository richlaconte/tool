# Agent Handoff Briefs Spec

## Idea

Create a structured handoff brief from a Cascadery page so humans can give coding agents a focused, reviewable package of implementation context.

The first version should be deterministic and transparent: gather typed Areas, links, metadata, evidence anchors, decisions, tasks, risks, and acceptance criteria into a Markdown-style brief. AI can later improve wording, but the MVP should not depend on a model.

## Status

Completed on 2026-06-30. The MVP includes deterministic Markdown handoff generation, missing-context warnings, copy/export UI, MCP handoff resource, and focused tests.

## Research Basis

Market and workflow signals:

- Miro frames the canvas as a team and agent context surface where the canvas becomes a prompt for AI work: https://miro.com/ai/ai-overview/
- Figma Make emphasizes plan mode, attachments, MCP connectors, annotations, and version history as ways to clarify and control AI-assisted product generation: https://www.figma.com/make/
- GitHub Copilot's coding agent starts from assigned issues, uses repository context, opens pull requests, records logs, and requires human approval before workflows run: https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/
- Anthropic MCP exists to connect AI assistants to relevant data sources through a shared protocol: https://www.anthropic.com/news/model-context-protocol
- tldraw's Agent Starter Kit shows that canvas agents need structured shape data, selection, viewport, screenshot context, and recent actions: https://tldraw.dev/starter-kits/agent

Developer-market signals:

- Stack Overflow reports broad AI adoption but significant frustration with almost-correct AI solutions and debugging generated code: https://survey.stackoverflow.co/2025
- JetBrains reports that developers want AI for repetitive tasks but prefer to keep control of creative and complex work, and cite lack of context awareness as a top AI concern: https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
- GitLab reports that AI code velocity is outpacing governance, creating demand for traceability and controls: https://ir.gitlab.com/news/news-details/2026/GitLab-Research-Reveals-Organizations-Are-Generating-AI-Code-Faster-Than-They-Can-Control-It/default.aspx
- Nielsen Norman Group says AI agents are now functional users of interfaces, which supports designing a specific agent-readable handoff surface rather than assuming human UI is enough: https://www.nngroup.com/articles/ai-agents-as-users/

## Product Rationale

Cascadery should not compete with coding agents. It should make agents better by giving them better inputs.

The handoff brief is the bridge:

- Human thinking stays spatial while it is being shaped.
- Agent input becomes structured when it is time to execute.
- Teams can review the brief before sending it to an agent.
- The brief can be copied into Codex, Claude Code, GitHub issues, Linear, PRDs, or MCP resources.
- Missing context becomes visible before an agent starts producing almost-right work.

## User Experience

Entry points:

- Command palette: `Create agent handoff brief`.
- Page persistence/action area once the feature is important enough: `Handoff`.
- MCP read resource: `cascadery://pages/{pageId}/handoff`.

Brief dialog:

- Opens as a focused dialog, not a permanent sidebar for MVP.
- Shows a generated brief preview.
- Has actions:
  - `Copy Markdown`.
  - `Export Markdown`.
  - `Open MCP resource` or copy resource URI later.
- Shows warnings when important context is missing.

Brief sections:

- Title and page ID.
- Goal.
- Scope.
- Decisions.
- Tasks.
- Risks.
- Open questions.
- Evidence and references.
- Relevant Areas.
- Acceptance criteria.
- Suggested agent instructions.
- Review checklist.

Missing-context warnings:

- No explicit goal.
- No acceptance criteria.
- Open questions still present.
- Risks without mitigation.
- Tasks without evidence anchors.
- No validation/test plan.

## Brief Generation Rules

Use deterministic heuristics:

- Area metadata kind `decision` -> Decisions.
- Area metadata kind `task` -> Tasks.
- Area metadata kind `risk` -> Risks.
- Area metadata kind `question` -> Open questions.
- Area metadata kind `file` or evidence kind `file` -> Relevant files.
- Area text containing `acceptance`, `criteria`, or checklist syntax -> Acceptance criteria.
- Area text containing `test`, `verify`, `validation`, or command evidence -> Validation plan.
- Links between Areas should be rendered as relationships.

If metadata is missing:

- Use headings and first-line text to infer categories.
- Preserve uncategorized Areas under Relevant Areas.
- Do not invent facts.

## Output Shape

Example Markdown shape:

```md
# Agent Handoff: <Page Title>

## Goal

...

## Scope

- In:
- Out:

## Decisions

- Decision: ...
  - Evidence: ...

## Tasks

- [ ] ...

## Risks

- Risk: ...
  - Mitigation:

## Relevant Files and Evidence

- `src/App.tsx`
- Issue #123

## Acceptance Criteria

- ...

## Suggested Agent Instructions

Use this canvas as the source of truth. Implement only the scoped changes. Preserve existing user work. Run the listed verification commands before reporting completion.
```

## MCP Integration

Add a read-only MCP resource:

```text
cascadery://pages/{pageId}/handoff
```

Rules:

- Available only when MCP is enabled for the page.
- Read-only for MVP.
- Returns Markdown text and optional structured JSON later.
- Redacts share tokens and raw asset payloads.
- Includes evidence anchors but not fetched external content.

## Relationship to Exports

- Existing Markdown export remains a full page export.
- Handoff brief is a task-oriented summary.
- Handoff brief can reuse export helpers but should live as separate logic so it can support warnings and MCP-specific shape.

## Acceptance Criteria

- User can open a handoff brief preview from the command palette.
- User can copy the brief as Markdown.
- Brief groups Areas by metadata where available.
- Brief includes links, evidence anchors, tasks, decisions, risks, questions, and acceptance criteria when present.
- Brief includes missing-context warnings.
- Brief never includes share tokens or raw asset payloads.
- MCP exposes a read-only handoff resource.
- View-only users can read/copy a handoff brief but cannot mutate the page from it.

## Suggested Test Coverage

- `agentHandoff.test.ts`
  - groups typed Areas into sections.
  - infers fallback sections from text when metadata is missing.
  - includes links and evidence anchors.
  - emits warnings for missing goal, acceptance criteria, and validation.
  - redacts share tokens and raw assets.
- `agentHandoffUi.test.ts`
  - command palette exposes `Create agent handoff brief`.
  - dialog renders copy/export actions.
  - view-only mode can render read-only brief actions if allowed.
- `mcpGateway.test.ts`
  - lists and reads `cascadery://pages/{pageId}/handoff`.
  - respects MCP page access settings.

## Non-Goals

- Auto-running a coding agent.
- AI rewriting the brief.
- Direct issue creation in GitHub or Linear.
- Full project-management workflow.
- Server-side background generation.
- Paid AI credits or usage tracking.

## Open Questions

- Should the brief be persisted as a snapshot, or generated live every time?
- Should view-only users see the handoff action, or only edit users?
- Should agent instructions be configurable per page?
- Should a future version support "send to Codex/GitHub/Linear" integrations directly?
