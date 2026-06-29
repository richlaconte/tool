# Cascadery Security and Privacy Baseline Spec

## Status

Completed on 2026-06-29 as an MVP hosted-collaboration security baseline.

Current implemented baseline:

- Server-backed pages and Yjs persistence exist.
- Collaboration origin checks and max payload configuration exist.
- Server-enforced edit/view share links for HTTP page loads and WebSocket collaboration exist.
- Share-token storage helpers, signed page sessions, and stale-session invalidation exist.
- No-auth MCP is environment-gated and rate-limited.
- Message-level collaboration rate limits, active connection limits, and WebSocket max payload configuration exist.
- Structured security logs exist for rejected collaboration auth, connection limits, rate limits, and oversized messages.
- Production deployment docs cover allowed origins, collaboration limits, MCP limits, GLM configuration, and security logging.

Moved to future work:

- Asset serving/storage routes with authorization-aware cache and server-side validation.
- Protected remote MCP authorization before broader hosted write access.
- Account/workspace roles and account-level audit logs.

## Goal

Define the security and privacy baseline for Cascadery before the product expands around sharing, real-time collaboration, assets, and AI/MCP access.

## Scope

This baseline covers:

- Page sharing and access modes.
- WebSocket collaboration.
- Persistence and export/import.
- Image assets.
- CSS slash commands and user-authored content.
- Future MCP/AI agent access.
- Logging, auditing, and operational safeguards.

## Research Basis

Security:

- OWASP WebSocket Security recommends origin validation, authentication/authorization, input validation, payload size limits, rate limiting, connection limits, heartbeat/timeout handling, and TLS: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
- OWASP REST Security guidance supports payload limits and appropriate HTTP error handling for oversized requests and unsupported methods/content types: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP API guidance recommends maximum sizes for incoming parameters and payloads: https://owasp.org/API-Security/editions/2019/en/0xa4-lack-of-resources-and-rate-limiting/
- MCP security best practices and authorization guidance call for clear consent, least privilege, access control, secure token handling, and privacy-aware integration design: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices and https://modelcontextprotocol.io/docs/tutorials/security/authorization
- OWASP GenAI Top 10 identifies prompt injection, sensitive information disclosure, excessive agency, and improper output handling as major AI application risks: https://genai.owasp.org/llm-top-10/
- NIST AI RMF frames AI risk management as an ongoing govern, map, measure, manage process: https://www.nist.gov/itl/ai-risk-management-framework

UX and trust:

- Nielsen Norman Group's visibility-of-system-status heuristic supports clear feedback for saving, syncing, access, and errors: https://www.nngroup.com/articles/visibility-system-status/
- WAI-ARIA dialog guidance supports accessible confirmation and review dialogs for sensitive operations: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

## Threat Model

Primary assets:

- Page content.
- Share tokens and future sessions.
- Uploaded image assets.
- Yjs document state.
- MCP credentials and grants.
- Agent action logs.

Primary threats:

- Guessable or leaked page/share URLs.
- View-only users mutating state.
- Cross-site WebSocket hijacking.
- Oversized WebSocket or asset-upload payloads.
- Malicious imported JSON.
- CSS or content injection through user-authored Area text/styles.
- Unauthorized asset access.
- Prompt injection inside Areas causing agent misuse.
- Excessive-agent agency causing broad or destructive changes.
- Sensitive information disclosure through exports, MCP resources, logs, or AI prompts.

## Access Control Requirements

### MVP

If MVP pages remain link-editable:

- Treat page URLs as bearer secrets.
- Generate high-entropy page ids and share tokens.
- Make UI copy honest: anyone with the edit link can edit.
- Support link regeneration as soon as server-side share-token enforcement exists.

### Next Access Model

Implemented server-enforced share links:

- Edit link grants read/write.
- View link grants read-only state and presence.
- Regenerating a link invalidates old sessions on reconnect.
- WebSocket authorization must verify the same access mode as HTTP routes.
- View-only clients must be rejected from write tools and collaboration update paths server-side.

Future accounts/workspaces:

- Add owner/admin/member/viewer roles.
- Keep page-level sharing separate from workspace membership.
- Provide audit logs for access changes.

## WebSocket Collaboration Requirements

- Require TLS in production.
- Validate `Origin` against configured allowed origins.
- Validate the requested page id and access mode during upgrade.
- Enforce message size limits.
- Rate-limit messages per connection and per IP/user where possible.
- Limit concurrent connections per page and per actor.
- Use heartbeat/idle timeouts.
- Validate message structure and content.
- Do not broadcast raw unexpected messages.
- Log rejected connections with reason codes, not sensitive payloads.

## Persistence Requirements

- Persist Yjs binary state for collaborative documents.
- Do not reconstruct persisted Yjs documents from JSON on every load.
- Store page metadata separately from collaborative document state where useful.
- Keep schema versions on JSON import/export.
- Validate imported JSON with strict shape checks.
- Reject unknown schema versions.
- Bound imported Area count, text length, style count, asset count, and nested depth.

## CSS and Content Safety

CSS slash commands are a product feature, but user-provided CSS still needs boundaries.

Allowed:

- Normal CSS declarations validated by `CSS.supports`.
- Theme-token resolution before validation.
- A future allow-list for high-risk properties if needed.

Disallowed or gated:

- Raw HTML injection into Areas.
- Inline event handlers.
- Remote script URLs.
- CSS values that trigger external network loads unless explicitly allowed.
- Unbounded `url(...)` usage in style commands.

Rendering requirements:

- Treat Area text as text, not HTML.
- Keep image alt text as text.
- Sanitize any future rich-text or pasted HTML before rendering.

## Asset Requirements

- Limit file size and dimensions.
- Allow-list MIME types.
- Verify image content rather than trusting extensions.
- Store asset metadata separately from binary data.
- Serve assets through authorization-aware routes.
- Strip or avoid exposing sensitive metadata where practical.
- Use safe cache headers for private/shared assets.

## AI and MCP Requirements

- Treat all page content as untrusted model input.
- Separate instructions from retrieved page content in prompts.
- Never rely on prompts for authorization.
- Require scopes for MCP tools.
- Start with read-only and suggest-only tools.
- Require human review for destructive or broad write operations.
- Validate model/agent outputs before applying them.
- Redact sensitive data in logs and tool responses.
- Maintain an audit log for agent reads and writes.
- Provide per-page MCP disablement.
- Fail closed if authorization, validation, or policy checks cannot complete.

## Privacy Requirements

- Provide clear indicators for access mode, connected collaborators, and connected agents.
- Make exports explicit and user-initiated.
- Do not include hidden tokens in exported page JSON.
- Do not log full page content by default.
- Redact share tokens and credentials from logs.
- Future cloud mode should provide deletion/export controls for user data.

## Operational Requirements

- Add security-focused tests for unauthorized view writes, invalid share tokens, oversized payloads, origin rejection, malformed JSON imports, invalid CSS, and MCP scope failures.
- Add structured logs for auth failures, rate limits, import failures, asset upload failures, and MCP tool calls.
- Document environment variables that affect allowed origins, database paths, asset paths, and MCP availability.
- Keep production defaults secure: no permissive origins, no debug stack traces, no unrestricted MCP.

## Acceptance Criteria

- Production WebSocket connections reject disallowed origins.
- View-only users cannot modify page state through UI, HTTP, WebSocket, or future MCP paths.
- Oversized WebSocket messages and uploads are rejected with safe errors.
- Imported page JSON cannot create unsupported object shapes or unsafe styles.
- Page exports do not include active share secrets unless explicitly designed and documented.
- MCP tools are disabled by default until a user/admin enables them.
- Agent writes require validation and audit records.
- Logs avoid secrets and raw full-page content.

## Open Questions

- What should the default production max WebSocket message size be for Yjs updates?
- Should anonymous edit-link pages expire by default?
- Should uploaded images be copied into page storage or referenced by URL with explicit warnings?
- Which CSS properties should be blocked or warned on before public sharing?

## Implementation Notes

- `collaborationSecurity.ts` centralizes collaboration message rate limits, max payload checks, and active connection limits.
- `collaborationServer.ts` applies security checks before Yjs messages are handled and rejects over-limit messages before document mutation.
- `securityLog.ts` emits redacted structured JSON security events without page text, cookies, share tokens, image bytes, or Yjs payloads.
- `docs/deployment.md` documents the security-sensitive production environment variables.
- Page JSON import validation, redacted export JSON, image upload size/type/signature validation, view-only access enforcement, and MCP dry-run write behavior are covered by focused tests across the suite.

## Future Work

- Authorization-aware asset upload/download routes and private cache policy.
- Server-side image content verification once binary storage exists.
- OAuth or equivalent protected remote MCP authorization.
- Account/workspace permissions and owner/admin/member/viewer roles.
- Server-backed page-history timeline shared across collaborators.
