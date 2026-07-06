# Agent Mission Control: Parallel Agent Sessions and the Board Lens

## Status

Completed MVP spec on 2026-07-06.

Created on 2026-07-05 from a market and product research pass.
Builds directly on the completed agent work journal
(completed/2026-07-02-agent-work-journal.md) and remote MCP hardening
(completed/2026-07-02-remote-mcp-hardening.md) specs.

## Goal

The dominant 2026 agent workflow is parallel: several coding agents running
at once on separate tasks, with the human as orchestrator. A whole product
category ("mission control" dashboards — GitHub Agent HQ, Google Antigravity,
Lanes, MissionControlHQ) exists to answer "what are my agents doing right
now, and what needs my attention?" — but every entrant is a list or a
terminal multiplexer. Cascadery already holds the primitives those tools
lack: spatial task Areas with status, an attributed agent journal, reviewable
proposals, and per-token agent identity. This spec turns those primitives
into the spatial mission-control surface: distinct concurrent agent
identities, task claiming, a board lens over task Areas, and a single
needs-attention queue.

## Research Basis

- Parallel agents with human-as-orchestrator is the consensus 2026 pattern:
  https://mikemason.ca/writing/ai-coding-agents-jan-2026/
- The mission-control category and its gap (boards of terminals, no shared
  spatial context): https://github.blog/news-insights/company-news/welcome-home-agents/
  and https://missioncontrolhq.ai/ and https://github.com/lanes-sh/app
- NN/g on agents as users of interfaces — the same surface should serve both:
  https://www.nngroup.com/articles/ai-agents-as-users/
- Product pillar 4 (agent-readable, human-controlled AI) in
  2026-06-29-cascadery-product-direction-audit.md — this spec adds no new
  agent authority; it adds human visibility.

## Current State

- Agent identity exists per token: `McpTokenRecord` carries a `label` and
  the gateway builds an `AgentClient` with `displayName`
  (`src/server/mcpTokens.ts`, `src/mcpGateway.ts`). But all agent activity
  renders through a single transient activity chip
  (`src/mcpAgentActivity.ts`) — two concurrent agents are
  indistinguishable.
- The journal (`src/agentJournal.ts`) attributes entries to a
  `JournalActor` (`kind: 'agent' | 'human'`, name) and is append-only with
  caps. The `update_area_status` MCP tool already writes a journal line
  ("X marked Y done", `src/mcpGateway.ts:1468`).
- Task Areas exist: `kind: 'task'` with `AreaStatus`
  (`todo`/`doing`/`done`/`blocked`, `src/areaMetadata.ts`). SDD export
  orders them by dependency (`orderTasksByDependency`, `src/sddExport.ts`).
- There is no assignee concept, no aggregate view of task status, and no
  single place that collects pending proposals, blocked tasks, and open
  comment threads.
- Page search navigation shipped viewport jump-to-Area
  (completed/2026-07-02-page-search-navigation.md) — the board lens reuses
  that motion.

## Scope

### Distinct concurrent agent identities

- Track active MCP sessions per page keyed by token id (extend the activity
  record in `src/mcpAgentActivity.ts` to a list rather than
  latest-wins). Each active agent renders its own presence chip in the
  presence row: display name from the token label, a stable color derived
  from the token id (same derivation idiom as collaborator colors).
- An agent chip shows its most recent action label and fades after the
  existing activity timeout. Clicking a chip filters the journal panel to
  that actor.

### Task claiming

- New optional Area metadata field `assignee: { kind: 'agent' | 'human',
  name: string }` on task Areas (`src/areaMetadata.ts`), round-tripped
  through page JSON and the Yjs doc (`src/collaborativePage.ts`).
- New MCP tool `claim_task` (minimum scope `page:write`): sets the assignee
  to the calling client and status to `doing` in one operation; writes a
  journal entry. Claiming an already-claimed task fails with a structured
  error naming the current assignee — no silent steals.
- Humans set or clear the assignee from the Area metadata UI; a claimed
  task Area shows a small assignee badge (name + agent/human glyph).

### The board lens

- A "Board" panel (command palette entry + toolbar toggle) rendering task
  Areas as cards in four status columns (todo / doing / done / blocked).
  Cards show title (`areaTitle` from `src/sddExport.ts`), assignee badge,
  and open-comment indicator. The board is a lens over existing Areas —
  no new document data beyond `assignee`.
- Clicking a card pans/zooms the canvas to the Area and selects it (reuse
  the search-navigation jump). Dragging a card between columns updates the
  Area status (same mutation path as the metadata UI, undoable).
- The board is available in view-only mode (read-only: no drag, no assign).

### The needs-attention queue

- A compact section at the top of the board (and a status-bar count chip)
  aggregating, in order: pending agent proposals awaiting review, `blocked`
  task Areas, unresolved comment threads. Each row jumps to its subject.
  This is the orchestrator's inbox; it introduces no new state, only a
  unified query over existing state.

## Non-Goals

- Spawning, stopping, or configuring agents from Cascadery. Agents connect
  via MCP; Cascadery never becomes a process manager or terminal host.
- Cost/token/duration tracking of agent sessions.
- Chat with agents (journal remains a log; posture unchanged).
- Cross-page/fleet dashboards — one page, one mission. (A shelf-level
  aggregate can be a follow-up once per-page value is proven.)
- Notifications outside the app.

## Acceptance Criteria

- Two agents with different token labels active on one page render two
  distinct presence chips with stable distinct colors; each journal entry
  attributes to the right actor; clicking a chip filters the journal.
- `claim_task` sets assignee + `doing` status atomically, journals the
  claim, and rejects claims on already-claimed tasks with the assignee
  name in the error.
- The board shows every task Area in the correct column; dragging a card
  updates status and is undoable in one step; clicking a card jumps the
  canvas to the Area.
- The needs-attention queue lists pending proposals, blocked tasks, and
  unresolved threads, and empties as each is handled.
- Assignee round-trips through page JSON export/import and survives
  collaborative sync; pages without assignees are unchanged.
- View-only sessions see board and queue read-only; no mutation affordances
  render.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/areaMetadata.test.ts`: assignee validation, normalization, JSON
  round-trip.
- `src/mcpGateway.test.ts`: `claim_task` happy path, already-claimed
  rejection, scope enforcement (`page:read` token cannot claim), journal
  side effects.
- New `src/taskBoard.test.ts`: pure grouping of Areas into columns,
  needs-attention aggregation ordering, view-only flag handling.
- `src/mcpAgentActivity.test.ts`: multi-agent activity list, per-token
  chip data, timeout pruning.

## Open Questions

- Should claiming require a fresh opt-in scope (`task:claim`) instead of
  `page:write`? Recommend: no — `page:write` already gates status
  mutation, and scope sprawl has its own cost; revisit if abuse appears.
- Column order and whether `done` collapses after N cards — pick during
  implementation; cap visible done cards at 20 with a "show all".
- Should the human assignee picker offer collaborator presence names?
  Recommend: yes, free-text plus suggestions from current presence.
