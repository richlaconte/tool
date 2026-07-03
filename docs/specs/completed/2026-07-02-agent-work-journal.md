# Agent Work Journal and Live Agent Presence

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 2.2). Completed
MVP on 2026-07-02.

## Goal

Give long-running coding agents a narrated presence on the page: an
append-only journal they can write progress into ("implementing task 3, tests
failing"), an agent chip in the presence row while an MCP session is active,
and a reviewable path for agents to update task Area status.

## Research Basis

- tldraw's agent starter kit streams agent activity visibly so users see work
  happen rather than discover it after: https://tldraw.dev/starter-kits/agent
- NN/g visibility of system status applied to agent actors:
  https://www.nngroup.com/articles/visibility-system-status/ and
  https://www.nngroup.com/articles/ai-agents-as-users/
- Cascadery AI posture (README): agents propose visible changes; the journal
  is deliberately the one low-privilege append-only exception because it
  cannot mutate user content.

## Current State

- MCP activity is already tracked transiently: `src/mcpAgentActivity.ts`
  (client display state) and `src/server/mcpAgentActions.ts` (persisted audit
  records via `recordMcpAgentAction` / `listMcpAgentActions`); App.tsx shows
  an `mcpAgentActivity` indicator.
- Presence row: `remotePresences` + `CollaborationProfile` in
  `src/collaboration.ts`, rendered as initials chips in App.tsx (~line 4600).
- The Yjs doc has maps `page`, `areas`, `assets`, `links`
  (`src/collaborativePage.ts`); a `Y.Array` is appropriate for an append-only
  log.
- Agent write limits pattern: `MAX_AGENT_OPERATIONS`, `MAX_AGENT_TEXT_LENGTH`
  etc. in `src/agentInterface.ts` (lines ~176-181).
- Task status lives at `area.metadata.status` (`AreaStatus` in
  `src/areaMetadata.ts`), but `AgentPatchOperation` has no metadata operation
  — agents currently cannot even propose a status change.
- Page settings: `PageSettings.mcp = { enabled: boolean }`
  (`src/pagePersistence.ts`).
- Rate limiting: `createFixedWindowRateLimiter` in `src/server/rateLimit.ts`,
  already applied per-request in `app/api/mcp/route.ts`.

## Scope

### Journal data model

- New top-level `Y.Array` named `journal` on the collaborative doc. Entry:
  `{ id, actor: { name, kind: 'agent' | 'human' }, text, createdAt,
  taskAreaId?: string | null }`. Entries are immutable once appended.
- Caps: `MAX_JOURNAL_TEXT_LENGTH = 2000`, `MAX_JOURNAL_ENTRIES = 500` — when
  full, the server-side append prunes oldest entries (document that the
  journal is a working log, not an audit record; `mcpAgentActions` remains
  the audit trail).
- New pure module `src/agentJournal.ts`: entry creation/validation, pruning
  logic, `getJournalEntries(doc)`, `appendJournalEntry(doc, entry)`
  (single transaction, tagged `AGENT_ORIGIN` from the undo spec so journal
  appends never pollute user undo).
- Persistence: `PageJsonSnapshot` gains optional `journal?: JournalEntry[]`
  (round-tripped in `pagePersistence.ts`; schemaVersion stays 1). Excluded
  from Markdown export by default.

### MCP tool

- New tool `append_journal_entry` in `src/mcpGateway.ts`:
  - Scope: allowed for `page:suggest` and above (low privilege by design; it
    is append-only and cannot touch user content).
  - Args `{ pageId, text, taskAreaId? }`; validates caps; invalid
    `taskAreaId` is stored as null with a warning in the result rather than
    rejecting (progress reporting should be resilient).
  - Server-side rate limit: a dedicated fixed-window limiter (e.g. 30
    appends/minute per client key) separate from the global MCP limiter, so a
    chatty agent cannot exhaust the page's request budget; over-limit appends
    are dropped with a JSON-RPC error and security-logged
    (`src/server/securityLog.ts`).
  - Appends are appended to the *hosted* doc server-side (the MCP route
    already loads stored collaborative state via
    `getStoredCollaborativePageState` in `src/server/collaborativeStorage.ts`;
    follow the same write path used when agent patches are applied
    server-side — study `src/server/mcpAgentActions.ts` and the gateway's
    write tools for the exact mechanism).

### Journal UI

- A side panel (not canvas Areas — agents must not be able to spam spatial
  layout): toggled from a status-bar button and a palette entry
  "Toggle agent journal". Entries newest-first, showing actor name, relative
  time, text, and — when `taskAreaId` is set — a chip that jumps to the Area
  (reuse the search spec's `getZoomToArea`).
- Unread affordance: a small dot on the toggle button when entries arrived
  while the panel was closed (session-local state only).
- Humans can also append short notes from the panel composer (actor kind
  `human`, same caps) — useful for leaving instructions agents will read
  via MCP.

### Agent presence chip

- While MCP requests for this page are active (reuse/extend the TTL logic in
  `src/mcpAgentActivity.ts` — e.g. active within the last 60s), render an
  agent chip in the presence row, visually distinct (robot glyph or dashed
  ring), labeled with the agent client name (`AgentClient.displayName`,
  currently the static `MCP_AGENT_CLIENT` in `mcpGateway.ts`).

### Task status updates by agents

- Add a new `AgentPatchOperation` variant to `src/agentInterface.ts`:
  `{ op: 'updateAreaMetadata', areaId, patch: { status?: AreaStatus } }` —
  status only in v1 (not kind/tags). Wire it through patch validation,
  `apply`, dry-run, the proposal renderer, and a new MCP tool
  `update_area_status` (scope `page:suggest`, returns a proposal).
- Opt-in auto-accept: extend `McpSettings` to
  `{ enabled: boolean; autoAcceptStatusUpdates: boolean }` (default false),
  surfaced as a checkbox wherever page MCP settings are edited. When true,
  status-only patches from agents apply immediately but still write
  `mcpAgentActions` audit records and journal-style visibility (auto-applied
  patches append a system journal entry "Agent X marked 'deploy fix' done").
  Parse legacy settings without the new field safely.

## Non-Goals

- Chat with agents. The journal is a log, not a conversation UI.
- Streaming partial entries; each append is atomic.
- Agent-authored canvas comments (comments spec keeps agents out in v1).
- Multiple concurrent named agent identities (single `AgentClient` today;
  real identities arrive with the MCP hardening spec's tokens — design the
  chip/journal to read the client display name so tokens slot in later).

## Acceptance Criteria

- An MCP client can append journal entries; all connected collaborators see
  them live in the panel; entries are attributed and timestamped.
- Appends beyond the rate limit are rejected with a JSON-RPC error and appear
  in the security log; the journal itself never exceeds 500 entries.
- Journal appends do not create user undo steps and do not move any Area.
- The agent chip appears in the presence row during active MCP use and
  expires afterward.
- An agent can propose a task status change; the human sees a reviewable
  proposal; with auto-accept enabled, status-only changes apply instantly,
  are audited, and produce a visible journal entry.
- Page JSON round-trips the journal; Markdown export omits it.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/agentJournal.test.ts`: validation caps, pruning at 500, ordering,
  taskAreaId fallback-to-null.
- `src/agentInterface.test.ts`: extend for `updateAreaMetadata` validation,
  apply, dry-run, and rejection of non-status metadata fields.
- `src/mcpGateway.test.ts`: extend for `append_journal_entry` (scopes, caps,
  rate-limit error shape) and `update_area_status` proposal flow incl.
  auto-accept setting.
- `src/pagePersistence.test.ts`: journal round-trip + legacy settings parse.

## Open Questions

- Should journal entries with `taskAreaId` also render a subtle badge on the
  task Area itself? Recommend: defer; the jump chip covers v1.
- Retention on export: full 500 entries in page JSON could bloat files —
  recommend exporting only the most recent 100 and documenting it.
