# Product Site, Docs, and Launch Narrative

## Status

Priority: P1-gated — queue #8; start only when a launch date exists or the queue is nearly drained (2026-07-06 audit). See the Priority Queue in README.md before starting work.

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 4.4). Active.
Market fit cannot be tested without distribution; this spec is the
distribution surface. Sequence after the SDD interchange spec (Tier 2.1) so
the story it tells is shippable truth.

## Goal

A public landing page leading with the "visual layer for spec-driven
development" story, a live read-only demo one click away, public docs whose
centerpiece is MCP setup (agent authors are a growth channel), and the domain
finally purchased.

## Research Basis

- Brand system exists: docs/specs/completed/2026-06-29-brand-positioning-and-narrative.md
  and logo/favicon assets in `public/`
  (completed/2026-06-30-cascadery-logo-favicon-integration.md).
- Positioning line from the direction audit: "CSS-native context canvas for
  developers and coding agents"; UI tagline "CSS-native canvas for developer
  thinking" — the site leads with the SDD workflow and uses these as support,
  per the roadmap's market analysis.
- README records the domain research: `cascadery.com` "likely available",
  pending registrar checkout and trademark search.
- Comparable launch surfaces: https://tldraw.dev/ (SDK docs as marketing),
  https://github.github.com/spec-kit/ (workflow docs as marketing).

## Current State

- There is no marketing page: `/` (`app/route.ts`) immediately creates a page
  and redirects to the editor with an edit token — great demo mechanics,
  invisible product story.
- The app is a self-hosted Next 16 deployment on Fly.io
  (`fly.toml`, `docs/deployment.md`, GitHub Actions `deploy.yml`).
- View share links already deliver a polished read-only experience
  (presentation mode spec) — the live-demo mechanism exists.
- MCP endpoint + tools exist (`app/api/mcp/route.ts`); after Tier 2.3, setup
  requires minting a token in the connections panel — the docs must reflect
  whichever auth model is live at publish time.
- Brand assets: `public/` contains logo/favicon files
  (`src/brandingAssets.test.ts` pins them).

## Scope

### Information architecture and routing

- Marketing lives in the same Next app (one deploy, no CMS): a route group
  `app/(site)/` with `home/page.tsx` served at `/`, `docs/…` pages, and
  `changelog/page.tsx`. The current instant-page-creation behavior of `/`
  moves to `/new` (`app/new/route.ts`, same handler code); the landing hero's
  primary CTA points at `/new`. Signed-in users (Tier 3.1) hitting `/` still
  bounce to the shelf.
  - Keep `/new` unauthenticated and rate-limited (page creation is already
    server-side; add a fixed-window limiter keyed by IP to prevent DB-fill
    abuse now that the URL is public marketing).
- Site pages are static/server-rendered React with inline styles from a small
  shared stylesheet — no new UI framework, no external fonts/scripts
  (self-contained, fast, brand-consistent).

### Landing page content (order matters)

1. **Hero:** the SDD story — "The visual layer for spec-driven development.
   Map the implementation. Compile it to specs your agents execute. Watch
   progress land back on the canvas." Primary CTA "Start a canvas" (`/new`),
   secondary "See a live example" (demo view link).
2. **Show, don't claim:** an embedded or linked live demo page — a curated
   implementation map (decisions, tasks with statuses, evidence anchors,
   a connector or two) shared via a **view** link on a dedicated demo page id.
   Seed it from a checked-in page JSON fixture (`docs/demo/demo-page.json`)
   with a small script (`scripts/seed-demo.ts`) run at deploy time so the
   demo is reproducible and vandalism-proof (view-only).
3. **Three pillars, one screenshot each:** developer context canvas (typed
   Areas/kinds), agent round-trip (SDD export + journal), CSS-native styling
   (slash command in action).
4. **MCP strip:** "Point Claude Code or Cursor at your canvas" with a
   four-line config snippet and a link to the MCP docs.
5. Footer: GitHub repo (if/when public), changelog, docs, the fuller
   positioning line.

### Docs

- `docs/` route section, authored as MDX or simple TSX pages:
  - **Getting started:** create, style (CSS slash commands table), share.
  - **MCP setup:** the centerpiece. Copy-paste `mcp.json` blocks for Claude
    Code and Cursor, scope explanations in plain language, the tool catalog
    (generate the tool list from `toolDefinitions` in `src/mcpGateway.ts` at
    build time so docs cannot drift from code), and the security model
    (tokens, scopes, audit, proposals).
  - **SDD workflow:** page → `export_sdd` → agent implements → journal +
    status updates flow back. This page is the market position, written as a
    tutorial.
  - **Data & portability:** page JSON, JSON Canvas, Markdown exports; the
    ownership/retention story.
- **Changelog:** `changelog/page.tsx` rendered from a checked-in
  `docs/changelog.md` fed by the spec-completion cadence (one entry per
  completed spec, newest first).

### Domain and launch checklist

- Purchase `cascadery.com` (registrar checkout) and run the trademark search
  noted in the README; update `fly.toml`/DNS docs for the custom domain +
  certs; canonical URLs, `robots.txt`, `sitemap.xml`.
- Meta/OG: per-page titles/descriptions; a single OG image built from brand
  assets (checked into `public/`); favicon already shipped.
- Analytics: none until the quality-infrastructure spec's telemetry decision
  lands — do not add a third-party analytics script; server request logs
  suffice for launch week.

## Non-Goals

- A CMS, blog infrastructure, or newsletter.
- Pricing/billing pages (no paid tier exists).
- Open-sourcing decisions (site copy must not promise it either way).
- Video production (screenshots/GIFs from the real product only).

## Acceptance Criteria

- `/` renders the marketing page (fast: no external requests, Lighthouse
  performance ≥ 95 on the landing page); `/new` creates a page exactly as `/`
  does today, rate-limited.
- The live demo link opens a seeded, view-only canvas that demonstrates typed
  Areas, connectors, statuses, and at least one evidence anchor; the seed
  script reproduces it from the fixture.
- MCP docs contain working copy-paste configs for Claude Code and Cursor,
  validated against the current auth model; the tool catalog is generated
  from `toolDefinitions`, not hand-written.
- Changelog lists completed specs to date; adding a Markdown entry publishes
  on next deploy.
- Domain purchased and serving with TLS, or — if the registrar/trademark
  check fails — a decision record in this spec documenting the fallback name
  choice before any public promotion.
- All site pages pass the same lint/build pipeline; no horizontal scroll at
  320 px; AA contrast (reuse the a11y spec's audit method).
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/deploymentConfig.test.ts` pattern: extend for the `/new` route
  behavior move (a route test asserting `/` no longer redirects and `/new`
  does).
- Build-time doc generation test: the MCP tool catalog page contains every
  tool name in `toolDefinitions` (parity assertion, same spirit as the
  shortcut-parity test).
- Demo seed script test: fixture parses via `parsePageJson` and the script is
  idempotent (re-running does not duplicate).

## Open Questions

- Should the demo page be interactive-copyable ("Duplicate this canvas" →
  `/new` seeded from the fixture)? Recommend: yes if trivial — it converts
  lookers to users — but only after `/new` rate limiting is in.
- MDX vs plain TSX for docs: implementer's choice; pick whichever avoids
  adding heavyweight tooling to the build.
