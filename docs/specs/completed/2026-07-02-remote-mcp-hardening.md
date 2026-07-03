# Remote MCP Hardening

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 2.3).
Completed MVP on 2026-07-03. The gateway now requires scoped, page-bound
bearer tokens for remote requests, while preserving an explicit loopback-only
anonymous development mode behind `TOOL_MCP_ALLOW_ANONYMOUS`.

## Goal

Move the MCP gateway from "env-flag on, rate-limited, unauthenticated" to
scoped, revocable, audience-bound bearer tokens with per-scope enforcement,
OAuth 2.1-compatible error signaling, security logging of every denial, and a
user-facing connections panel — following the 2026 MCP authorization
direction while deferring a full OAuth authorization server.

## Research Basis

- MCP authorization spec: servers act as OAuth 2.1 resource servers; tokens
  must be audience-bound (RFC 8707 resource indicators); servers validate
  tokens and do not issue them:
  https://modelcontextprotocol.io/specification/draft/basic/authorization
- 2026 ecosystem audits: ~40% of MCP servers unauthenticated; scope sprawl and
  token passthrough are the dominant failure modes:
  https://techcommunity.microsoft.com/blog/microsoft-security-blog/the-state-of-mcp-security-in-2026/4531327
- MCP security best practices (least privilege, fail closed, audit):
  https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- OWASP: rate limiting, message-level authorization, security logging:
  https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html

## Current State

- Endpoint: `app/api/mcp/route.ts`. Auth today is: global env flag
  `TOOL_MCP_ENABLED === 'true'` (404 otherwise), fixed-window rate limiting
  (`src/server/rateLimit.ts`, keyed by client IP via
  `getClientRateLimitKey`), and a per-page opt-in
  `PageSettings.mcp.enabled` checked by `isPageMcpEnabled`
  (`src/mcpGateway.ts` line ~1053). There are no tokens, no identities, no
  scopes enforcement per caller.
- Scopes already exist as a model: `AgentScope = 'page:read' | 'page:search'
  | 'page:suggest' | 'page:write'` and `AgentClient = { id, displayName,
  scopes }` in `src/agentInterface.ts` — but the gateway uses one static
  `MCP_AGENT_CLIENT` (`mcpGateway.ts` line ~85) for all callers. The
  enforcement plumbing exists; the identity layer is missing.
- Persistence: better-sqlite3 via `createDatabase()`
  (`src/server/database.ts`, path `TOOL_DATABASE_PATH ?? ./.data/tool.sqlite`);
  share tokens are already stored hashed (`hashShareToken` in
  `src/server/pageRepository.ts`) — reuse that hashing approach.
- Audit: `src/server/mcpAgentActions.ts` records tool actions; security
  events go to `src/server/securityLog.ts`.
- UI: share dialog exists (`openDialogId === 'share'` in App.tsx); there is no
  MCP/connections management surface.

## Scope

### Token model

- New table `mcp_tokens` (migration in `src/server/database.ts` following the
  existing table-creation pattern): `id`, `token_hash`, `page_id`
  (audience binding — one token, one page), `scopes` (JSON array of
  `AgentScope`), `label` (user-given, e.g. "Claude Code on laptop"),
  `created_at`, `expires_at` (nullable; default 90 days), `revoked_at`
  (nullable), `last_used_at`.
- Token format: `cscd_` prefix + 32 random bytes base64url (prefix makes leaks
  greppable and secret-scanner friendly). Store only the hash; show the
  plaintext once at mint time.
- New module `src/server/mcpTokens.ts`: `mintMcpToken`, `validateMcpToken`
  (hash lookup, expiry, revocation, page audience check → returns an
  `AgentClient` with the token's scopes and label as displayName),
  `revokeMcpToken`, `listMcpTokens(pageId)`, `touchLastUsed`.

### Gateway enforcement

- `app/api/mcp/route.ts` extracts `Authorization: Bearer …`:
  - Valid token → build the `AgentClient` from it and pass to
    `handleMcpJsonRpcRequest` (replace the static `MCP_AGENT_CLIENT`); the
    request may only touch the token's `page_id` — tool calls addressing any
    other page fail with an authorization error even if the scope matches.
  - Missing/invalid token → HTTP 401 with a `WWW-Authenticate` header per the
    MCP auth spec (include `resource_metadata` pointing at a small static
    metadata route `app/api/mcp/.well-known` equivalent — implementer should
    check the current spec section "Protected Resource Metadata" for the
    exact header shape), body a JSON-RPC error. Fail closed.
  - **Local-dev legacy path:** when `TOOL_MCP_ENABLED === 'true'` AND the
    request originates from loopback AND `TOOL_MCP_ALLOW_ANONYMOUS === 'true'`,
    accept tokenless requests with the current static client. This preserves
    the existing local workflow explicitly, not accidentally. Document in
    `.env.example`.
- Scope → tool mapping already declared per tool in `toolDefinitions`; verify
  every tool declares its minimum scope and add a table to the MCP docs:
  read tools → `page:read`/`page:search`; suggestion tools → `page:suggest`;
  `create_area`/`update_area`/`update_area_styles`/`move_area`/`nest_area`/
  `delete_area`/`apply_patch` → `page:write`.
- Per-scope rate limits: separate fixed-window limiters for read vs write vs
  suggest (env-tunable via the `getRateLimitConfigFromEnv` pattern), keyed by
  token id (fall back to IP for the anonymous local path).
- Security logging: every denial (bad token, expired, revoked, wrong page,
  insufficient scope, rate limit) writes a typed `securityLog.ts` event with
  token id (never the token), page id, tool name, and reason.

### Connections panel (UI)

- New dialog "Agent connections" reachable from the share dialog and command
  palette (edit access required):
  - Mint: choose scopes (checkboxes with plain-language descriptions:
    "Read this page", "Suggest changes for review", "Edit directly —
    dangerous"), optional label, optional expiry; show the token once with a
    copy button and setup snippets for Claude Code / Cursor `mcp.json`.
  - List: label, scopes, created, last used, expiry; per-row Revoke with
    confirmation. Revocation takes effect on the next request (no caching of
    validation results).
  - Show recent `mcpAgentActions` audit entries for this page in the same
    dialog (read from the existing `listMcpAgentActions`).
- Minting `page:write` shows an explicit warning that direct writes bypass
  proposal review (audit records still apply).

### OAuth 2.1 migration posture (documented, not built)

- This spec deliberately ships user-minted bearer tokens presented
  OAuth-compatibly (401 + WWW-Authenticate + resource metadata). A future
  authorization-server spec adds dynamic client registration and RFC 8707
  resource indicators; nothing in this design blocks that: tokens are already
  audience-bound per page, scoped, expiring, and revocable. State this
  migration path in the MCP docs page.

## Non-Goals

- Building an OAuth authorization server, dynamic client registration, or
  OIDC login for agents.
- Multi-page or wildcard tokens (one token = one page keeps the blast radius
  of a leak to a single page).
- Rotating the share-link/session system (unchanged; MCP tokens are a
  parallel credential class).
- mTLS or IP allowlists.

## Acceptance Criteria

- A token scoped `page:read` can call `get_page` but gets an authorization
  error (and a security-log entry) calling `create_area`.
- A token minted for page A fails on page B with an authorization error.
- Expired and revoked tokens fail on the next request; revocation via the
  panel is immediate.
- Tokenless remote requests get 401 + `WWW-Authenticate`; the loopback
  anonymous path works only with both env flags set.
- All denials appear in the security log with reasons; no plaintext token is
  ever stored or logged; DB holds hashes only.
- The connections panel mints (with one-time display), lists, and revokes
  tokens, and shows recent agent audit actions.
- Per-scope rate limits enforce independently (write limiter exhaustion does
  not block reads).
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/server/mcpTokens.test.ts`: mint/validate/expire/revoke, hash-only
  storage, audience mismatch, scope construction of `AgentClient`.
- `src/mcpRoute.test.ts` + `src/mcpGateway.test.ts`: extend for 401 shape,
  WWW-Authenticate presence, loopback anonymous gating, per-scope limiter
  separation, wrong-page rejection, security-log emission (inject a fake
  logger).
- Fixture-driven scope matrix test: every tool × every scope → allow/deny
  table asserted in one test so future tools must declare a scope.

## Open Questions

- Default expiry: 90 days vs no expiry. Recommend 90 days with UI to extend.
- Should `page:search` remain a distinct scope or fold into `page:read`?
  Recommend: keep distinct (it exists) but always co-grant in the UI.
- Where the resource-metadata JSON route lives under Next App Router —
  implementer verifies against the current MCP spec revision before coding.

## MVP Completion Notes

- Implemented `mcp_tokens` with hash-only storage, default 90-day expiry,
  per-page audience binding, revocation, and last-used timestamps.
- `/api/mcp` now accepts `Authorization: Bearer ...`, returns 401 with
  `WWW-Authenticate` and `/api/mcp/.well-known` metadata for missing or
  invalid remote credentials, and logs denials as `mcp-auth-denied`.
- The gateway enforces declared tool scopes, page audience, and per-scope
  fixed-window limits before executing tools.
- Added an edit-session-protected Agent connections dialog and
  `/api/pages/[pageId]/mcp-tokens` API for minting, listing, and revoking
  page-scoped tokens. Plaintext tokens are shown only on creation.
- Full OAuth authorization-server work remains a future spec; this MVP keeps
  the migration path open by using bearer semantics, scopes, audience binding,
  expiry, revocation, and protected resource metadata.
