# Evidence Anchors v2: Repo-Linked Context

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 2.4). Completed MVP
on 2026-07-04.
Depends on the Markdown/code spec (Tier 1.2) for the `codeHighlight` module.

## Completion Notes

- GitHub and GitLab code permalinks parse into bounded, highlighted snippets.
- Snippets resolve through a rate-limited server endpoint with SQLite caching
  and public-repo-only allowlisting.
- Area evidence chips expose expandable previews and drift hints for mutable
  refs.
- Handoff briefs, Markdown export, and MCP page/area resources can include
  already-resolved snippets while preserving synchronous/export-safe fallbacks.

## Goal

Make evidence references resolve: paste a GitHub/GitLab permalink and see the
actual highlighted code lines on the canvas, in handoff briefs, and in MCP
resources — with staleness signaling for refs that can drift.

## Research Basis

- Evidence anchors MVP: docs/specs/completed/2026-06-29-evidence-anchors-and-code-references.md
- GitHub permalink format (`/blob/<sha-or-ref>/<path>#L10-L20`) and raw
  content endpoints (`raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`).
- GitHub unauthenticated API limits (60 req/hr/IP) argue for raw-file fetching
  plus caching, and against API-dependent features in v1:
  https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

## Current State

- Evidence model: `AreaEvidenceReference = { id, kind, label, target,
  createdAt, updatedAt? }` with kinds `file | symbol | url | issue |
  pull-request | commit | command | asset | note` (`src/areaMetadata.ts`).
  Creation/detection helpers live in `src/areaEvidence.ts`
  (`detectAreaEvidenceKind`, `createAreaEvidenceReference`,
  `addAreaEvidenceReference`), including a `/ref` slash command flow.
- Targets are opaque strings today; nothing fetches, previews, or validates
  them.
- Handoff briefs (`src/agentHandoff.ts`) and Markdown export render evidence
  as text references.
- Server: SQLite via `src/server/database.ts`; API routes under `app/api/…`;
  rate limiting via `src/server/rateLimit.ts`.
- `src/codeHighlight.ts` will exist after Tier 1.2 (tokens for ts/js, css,
  json, html, bash).

## Scope

### Reference parsing

- New pure module `src/codeReferences.ts`:
  - `parseCodeReference(target: string): ParsedCodeReference | null` —
    recognizes GitHub (`github.com/<owner>/<repo>/blob/<ref>/<path>#L<n>(-L<m>)?`)
    and GitLab (`gitlab.com/<group>/<project>/-/blob/<ref>/<path>#L<n>(-<m>)?`)
    permalinks, returning `{ host, owner, repo, ref, path, startLine, endLine,
    isImmutableRef }` where `isImmutableRef` is true when `ref` looks like a
    full 40-char SHA.
  - `getRawContentUrl(parsed): string` — maps to
    `raw.githubusercontent.com/...` or GitLab's raw endpoint.
  - `getLanguageFromPath(path): string` — extension → highlight language,
    aligned with `codeHighlight.ts` supported languages.

### Server fetch + cache

- New API route `app/api/code-snippet/route.ts` (GET, query `url`):
  - Strict allowlist: only URLs whose parsed form round-trips through
    `parseCodeReference` (never fetch arbitrary URLs — this endpoint must not
    become an SSRF proxy; validate host against the two known hosts and
    rebuild the raw URL server-side rather than fetching caller-supplied
    URLs).
  - Fetch the raw file, slice to the requested line range plus 2 context
    lines, cap at 40 lines and 8 KB; respond
    `{ lines, startLine, language, fetchedAt, truncated }`.
  - Cache table `code_snippets` (`url_hash`, `payload_json`, `fetched_at`,
    `status`) in `src/server/database.ts`; TTL 24h for immutable-SHA refs
    effectively forever (they cannot change — refresh only on miss), 15 min
    for branch refs. Failed fetches cache a negative result for 5 min.
  - Rate limit per client IP with the existing fixed-window limiter; fetch
    errors return a typed error the client renders as a plain reference.
- Fetching is public-repo only in v1: no tokens, no auth forwarding. A private
  fetch simply 404s and degrades gracefully.

### UI

- Evidence list entries whose target parses as a code reference render an
  expandable snippet preview: file path + line badge header, highlighted
  lines via `codeHighlight`, monospace block styled in `src/App.css`,
  internal scroll for long ranges. Collapse state is session-local.
- Staleness: branch/short refs (non-SHA) show a subtle "ref may drift" badge
  with a title explaining that commit permalinks are stable. No conversion
  flow in v1 (needs API calls; see Open Questions).
- Fetch failures/offline render exactly what renders today (label + target
  link) — the preview is strictly progressive enhancement and must never
  block or reflow the Area itself (previews live in the evidence
  flyout/panel, not inside the Area body).

### Brief, export, and MCP integration

- `createAgentHandoffBrief` (`src/agentHandoff.ts`) and `exportPageAsMarkdown`
  render parsed code references as fenced code blocks with a `// <path>:<lines>`
  header comment when a cached snippet is available client-side; otherwise
  keep the current plain reference (exports are synchronous — use only
  already-fetched snippets passed in via an optional argument; never make
  export async).
- MCP: `get_area` and `get_page` (in `src/agentInterface.ts` /
  `src/mcpGateway.ts`) include `resolvedEvidence` for parseable refs —
  server-side resolution through the same cache, ≤ 40 lines each, capped at 5
  resolved refs per Area to bound payloads. This gives agents real code
  context without a second tool call.

## Non-Goals

- Private repositories, auth tokens, GitHub App installation.
- Branch→SHA permalink conversion (requires API budget).
- Live re-validation ("this line moved") or diff detection.
- Editing code from Cascadery.
- Any host beyond github.com / gitlab.com.

## Acceptance Criteria

- Pasting a GitHub permalink via the existing `/ref` flow yields an evidence
  entry whose preview shows the highlighted requested lines.
- SHA permalinks show no drift badge; branch permalinks do.
- The snippet endpoint refuses non-allowlisted hosts and malformed URLs
  (tested), rate-limits, caches (second request within TTL does not refetch —
  verifiable via an injected fetch stub), and caps size.
- Handoff brief and Markdown export embed available snippets as fenced blocks
  and degrade to plain refs otherwise.
- MCP `get_area` returns `resolvedEvidence` with correct line slices; caps
  respected.
- Fetch failure, offline, and private-repo cases degrade to today's rendering
  with no errors thrown.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/codeReferences.test.ts`: permalink parsing matrix (both hosts, single
  line, ranges, SHAs vs branches, malformed), raw-URL construction, language
  mapping.
- `src/server/codeSnippets.test.ts` (new, alongside the route logic —
  extract fetch/cache/slice into `src/server/codeSnippets.ts` so it is
  testable with an injected `fetch`): slicing, caps, TTL behavior, negative
  caching, allowlist enforcement.
- Extend `src/agentHandoff.test.ts` / `src/pageExports.test.ts` for snippet
  embedding and degradation.

## Open Questions

- Permalink conversion (branch → SHA) as a follow-up: worth an optional
  `GITHUB_TOKEN` env for teams who want it? Capture demand first.
- Should snippet previews render inside Area bodies for `file`-kind Areas?
  Recommend: no in v1 — keep Areas light; the flyout preview is enough.
