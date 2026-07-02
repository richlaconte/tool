# Cascadery Spec Suite Roadmap

## Status

Created on 2026-07-02 after a deep product, market, and UX analysis pass. This is a
direction document, not an implementation spec. Each outlined spec below should be
expanded into its own dated spec file before implementation, following the
conventions in "How to Expand These Outlines" at the bottom.

## Part 1: Analysis

### Product Philosophy Assessment

Cascadery's thesis — a CSS-native context canvas for developers and coding agents —
remains sound, and the 2026-06-29 audit's "narrow, don't pivot" verdict still holds.
The philosophy rests on five pillars (developer context, CSS-native editing,
document trust, human-controlled AI, portable data), and the completed-spec record
shows real follow-through: typed Areas, connectors with cardinality, evidence
anchors, agent handoff briefs, MCP gateway with proposal review and audit records,
version history, and server-enforced share links all exist and are tested.

Three philosophical tensions deserve explicit attention in the next spec wave:

1. **The canvas is agent-readable but not yet developer-writable enough.** Areas
   are plain text. A tool "for developers" that cannot render a fenced code block,
   a Markdown list, or a syntax-highlighted snippet undercuts its own audience.
   Markdown is exported but never rendered. This is the largest gap between the
   stated philosophy and the shipped product.
2. **The agent loop is half a loop.** Cascadery can hand context *to* agents
   (handoff briefs, MCP resources) and agents can propose patches *into* the
   canvas. But the dominant 2026 workflow — spec-driven development — is
   file-based: spec.md, plan.md, tasks.md living in the repo. Cascadery either
   interoperates with that artifact chain or sits beside it unused.
3. **Trust features exist; ownership features do not.** There are share links,
   history, and audit records, but no notion of "my pages," no revocation
   story a user can see, and no way to find a page again except keeping its URL.
   Document trust without document ownership is incomplete.

### Market Fit Assessment

The competitive field splits into four camps, none of which occupies Cascadery's
exact position:

- **General whiteboards** (Miro, FigJam, Excalidraw): broad, meeting-oriented,
  now adding AI/MCP (Miro ships an official MCP server). They are not
  developer-context-native and their data is not portable-first.
- **Visual knowledge bases** (Heptabase, Obsidian Canvas): strong on durable
  personal knowledge, weak on real-time team collaboration and agent write
  workflows. Obsidian's JSON Canvas is the de facto open interchange format.
- **Canvas-AI experiments** (tldraw Agent Starter Kit, Storyflow): prove that
  "the AI reads the whole board" is becoming table stakes. tldraw's kit shows
  the pattern: structured shape data + viewport + screenshots as agent context,
  modular actions as agent output, streamed visibly.
- **Spec-driven development tooling** (GitHub Spec Kit at ~90k stars, AWS Kiro,
  Tessl, OpenSpec, Claude Code plan mode): the fastest-growing adjacent
  category. SDD is text-file-centric and *has no visual layer*. Nobody owns
  "the canvas that compiles to and from SDD artifacts."

The sharpest available market position: **Cascadery is the visual, collaborative,
agent-readable layer for spec-driven development.** A team maps a feature
spatially, the map exports as spec/plan/tasks files an agent can execute, and the
agent reports progress back onto the canvas through MCP. No incumbent does this;
every ingredient already exists in the codebase in partial form.

Market risks to design against:

- **Commoditization of canvas-AI.** "AI reads the board" is no longer a moat.
  The moat must be the round-trip with real engineering artifacts (repos,
  specs, issues) plus data portability.
- **CSS-native is a flavor, not a category.** It attracts the right users but
  will not retain them if core canvas ergonomics (multi-select, code blocks,
  search) lag behind Excalidraw's free tier.
- **No-auth limits team adoption.** Share-token access is fine for the wedge but
  a team cannot standardize on a tool where pages are unlisted URLs.

### Design and UX Philosophy Assessment

The stated principles (NN/g visibility of system status, accelerators with
visible counterparts, calm status, AI as visible canvas changes) are good and
mostly honored: save/sync/access/presence status exists, the command palette
mirrors shortcuts, agent patches render as visible proposals.

Current violations and gaps, in rough severity order:

1. **Single selection only.** `selectedAreaId` is a single id. No marquee, no
   shift-click, no group move/align/distribute, no bulk style or delete. This is
   the single most universal spatial-canvas expectation Cascadery fails.
2. **Plain-text Areas.** No Markdown rendering, no code blocks. See philosophy
   tension #1.
3. **No comments.** The Visual RFC workflow in the product-DX spec names comment
   threads as a required capability; it is the only named workflow capability
   with no completed or active spec.
4. **No in-page search.** Once a page grows past a screenful, finding an Area
   requires panning. Offscreen indicators help orientation, not retrieval.
5. **App.tsx is 6,618 lines.** Not a user-facing issue, but every future spec
   pays a tax on it. UI-level tests are thin (`*Ui.test.ts` files average ~40
   lines) and there is no end-to-end harness.
6. **Keyboard and accessibility depth.** Dialogs follow WAI-ARIA patterns, but
   canvas-level keyboard work (arrow-key nudge, tab traversal of Areas,
   screen-reader page summary) is unspecified.

## Part 2: The Spec Suite

Specs are grouped in four tiers. Tiers are priority order; specs within a tier
are roughly independent and can be built in parallel. Each outline gives a lesser
model the problem, scope boundaries, key decisions, and acceptance-criteria seeds
needed to draft the full spec.

---

### Tier 1 — Canvas Table Stakes

The daily-use gaps that make the product feel unfinished to its own target user.
Nothing in Tiers 2–4 lands well while these are missing.

#### 1.1 Multi-Select and Group Manipulation

- **Problem:** Only one Area can be selected. Rearranging an implementation map
  of 20 Areas is 20 drags.
- **Scope:** Marquee (drag on blank canvas with a modifier or dedicated mode),
  shift-click add/remove, group drag, group delete/duplicate, bulk style
  application via the existing style dialog and slash commands, align/distribute
  actions in toolbar and command palette. Selection state must sync into
  presence (collaborators see multi-selections) and respect nesting (selecting a
  parent implies its children move with it, which nesting already handles).
- **Key decisions:** How marquee coexists with click-to-create on blank canvas
  (recommend: plain drag = marquee, plain click = create, matching current
  click semantics); whether group resize is in scope (recommend: defer).
- **Acceptance seeds:** Marquee selects intersecting root Areas; shift-click
  toggles; dragging any selected Area moves all; Escape clears; align
  left/right/top/bottom and distribute horizontal/vertical exist in palette;
  undo restores pre-group-move positions in one step.

#### 1.2 Markdown and Code-Native Area Content

- **Problem:** Areas hold plain text. Developers need lists, emphasis, links,
  inline code, and fenced code blocks with syntax highlighting.
- **Scope:** Render a safe Markdown subset in non-editing Areas; raw text while
  editing (Obsidian-style toggle, cheaper than a live WYSIWYG). Fenced code
  blocks get syntax highlighting (bundle a small highlighter; no CDN). Links are
  clickable in view mode. Markdown source is the stored text — no schema change
  beyond possibly an Area `kind` of `code`. Export (`pageExports`) and agent
  resources (`agentInterface`) already carry text and need no format change,
  but the Markdown export should stop double-escaping.
- **Key decisions:** Sanitization strategy (never `dangerouslySetInnerHTML`
  with unsanitized output; prefer a small AST renderer); which subset (headings,
  bold/italic, lists, links, inline code, fenced code — no tables/images in v1
  since image Areas exist); highlighter choice sized for bundle constraints.
- **Acceptance seeds:** A fenced ```ts block renders highlighted; editing shows
  raw source; XSS strings render inert; view-only mode renders Markdown;
  existing plain-text pages render unchanged.

#### 1.3 Area Comment Threads

- **Problem:** The Visual RFC workflow requires discussion attached to Areas;
  nothing exists.
- **Scope:** Per-Area threads stored in the collaborative doc (Yjs map keyed by
  Area id), comment = author name (from collaboration profile) + text +
  timestamp; resolved/unresolved state; a small indicator on Areas with open
  threads; a thread panel anchored to the selected Area; comments included in
  page JSON export and readable through a new MCP resource; agents may draft
  comments only via the existing proposal flow.
- **Key decisions:** Whether view-only visitors can comment (recommend: yes,
  it is the async-review use case); notification story (recommend: none in v1);
  whether comments appear in Markdown export (recommend: optional section).
- **Acceptance seeds:** Two collaborators see each other's comments live;
  resolving hides the indicator; deleted Areas archive rather than orphan their
  threads; export/import round-trips comments.

#### 1.4 Page Search and Navigation

- **Problem:** No way to find an Area by content, kind, or status on a large page.
- **Scope:** A search affordance (command palette mode and/or dedicated
  shortcut) matching Area text, kind, status, and evidence refs; results list
  with keyboard navigation; selecting a result pans/zooms to the Area and
  selects it; zoom-to-fit-all and zoom-to-selection commands. Reuse
  `searchAgentAreas` logic so human search and agent search stay consistent.
- **Acceptance seeds:** Typing in search filters live; Enter jumps to the top
  hit; jump animates viewport and selects; works in view-only mode.

#### 1.5 Undo/Redo Consolidation

- **Problem:** History exists (`pageHistory`) and some undo paths exist, but a
  spec should define one coherent model: what Cmd+Z undoes, per-user scoping in
  multiplayer, and how deletion-toast recovery, agent-patch rollback, and
  version history relate.
- **Scope:** Adopt Yjs UndoManager (or document why not) scoped to local-origin
  transactions; standard shortcuts; command palette entries; define the
  boundary between undo (session-local, fine-grained) and version history
  (durable, page-level).
- **Acceptance seeds:** A user undoes only their own changes; undo of a group
  move is atomic; agent-applied patches are undoable by the accepting user;
  redo works; no undo history leaks across pages.

---

### Tier 2 — The Wedge: Spec-Driven Development and the Agent Round-Trip

This tier is the market position. It converts existing half-built loops into the
differentiating workflow.

#### 2.1 SDD Artifact Interchange (flagship spec)

- **Problem:** SDD tooling (GitHub Spec Kit, Kiro, Claude Code plan mode) runs
  on Markdown artifacts in repos. Cascadery pages describe the same content
  spatially but cannot become or consume those artifacts.
- **Scope:** (a) **Export:** a deterministic "compile" of a page into
  spec/plan/tasks Markdown, driven by Area kinds and links — decisions become a
  Decisions section, task Areas with status become a checklist, risk/question
  Areas become open questions, evidence anchors become file references. Builds
  on `pageExports` and `agentHandoff`. (b) **Import:** paste or upload a
  spec/plan Markdown document and get a laid-out page (sections → parent Areas,
  checklist items → task Areas, headings → kinds where inferable), reusing the
  context-kit layout machinery. (c) **MCP:** expose both directions as MCP
  tools so a coding agent can pull the compiled spec and push a plan onto the
  canvas without copy-paste.
- **Key decisions:** Target format flavor (recommend: generic well-structured
  Markdown first, Spec Kit's file naming second); how much layout intelligence
  import attempts (recommend: simple grid by section, let humans rearrange);
  round-trip fidelity guarantees (recommend: export is canonical, import is
  best-effort, never claim lossless).
- **Acceptance seeds:** A page with decisions/tasks/risks exports to Markdown an
  agent can execute against; importing that export reproduces the structural
  content; both operations available via command palette and MCP; import is a
  proposal (reviewable) when triggered by an agent.

#### 2.2 Agent Work Journal and Live Agent Presence

- **Problem:** Agents can read and propose, but a long-running coding agent has
  no way to narrate progress ("implementing task 3, tests failing") onto the
  board. MCP activity is currently a transient indicator plus audit records.
- **Scope:** A journal construct (likely a reserved Area kind or page-level
  log) agents append to via a low-privilege MCP tool (append-only, no review
  needed since it cannot mutate user content); task-status updates by agents on
  task Areas routed through the existing proposal flow or an opt-in
  auto-accept-for-status-only scope; agent presence chip in the presence row
  while an MCP session is active.
- **Key decisions:** Journal as Areas on canvas vs. side panel (recommend: side
  panel with optional pin-to-canvas, to avoid agents spamming spatial layout);
  retention/size limits (append-only logs need caps, reuse the
  `MAX_AGENT_*` limit pattern).
- **Acceptance seeds:** An agent can append journal entries that all
  collaborators see live; entries are attributed and timestamped; a journal
  flood is rate-limited server-side; task-status change requests surface as
  reviewable proposals unless the page owner enabled status auto-accept.

#### 2.3 Remote MCP Hardening (OAuth 2.1)

- **Problem:** The MCP gateway is page-token based. 2026 MCP spec revisions
  mandate OAuth 2.1 resource-server behavior with RFC 8707 resource indicators;
  industry audits show unauthenticated MCP servers are the top ecosystem risk.
  Before promoting remote agent write access, the gateway needs real authz.
- **Scope:** OAuth 2.1 resource-server validation (validate tokens, do not
  issue them — pair with an external or minimal built-in authorization server);
  scopes mapped to the existing `AgentScope` model (`page:read`,
  `page:suggest`, `page:write`, journal append); audience binding per RFC 8707;
  token expiry; per-scope rate limits (extend `rateLimit.ts`); an in-app
  connections panel showing active grants with revocation; fail-closed
  defaults; expand `securityLog.ts` coverage to all MCP denials.
- **Key decisions:** Whether to keep bearer page-tokens as a legacy local-dev
  path (recommend: yes, loopback only); minimal viable authorization server
  (recommend: defer full OAuth AS; start with user-minted scoped API tokens
  presented as OAuth-compatible bearer tokens, documented as the migration
  path).
- **Acceptance seeds:** A token scoped `page:read` cannot call write tools; a
  token for page A fails on page B; revocation takes effect on the next
  request; all denials are security-logged; unauthenticated remote requests
  fail closed.

#### 2.4 Evidence Anchors v2: Repo-Linked Context

- **Problem:** Evidence anchors are strings. The "context stays true to the
  code" promise needs anchors that resolve, preview, and detect staleness.
- **Scope:** Recognize GitHub/GitLab permalink formats; fetch and cache
  referenced line ranges server-side (respecting private-repo boundaries — v1
  public repos only); render snippet previews with the Tier 1.2 highlighter;
  mark anchors stale when the referenced ref moves (permalinks with commit SHAs
  are stable — prefer them and offer conversion); expose resolved snippets in
  MCP resources so agents get code context without a second tool.
- **Acceptance seeds:** Pasting a GitHub permalink into an evidence field shows
  a highlighted snippet; snippets render in handoff briefs and Markdown export;
  fetch failures degrade to the plain reference, never block the Area.

---

### Tier 3 — Trust and Ownership

What turns "a URL someone shared" into "our team's tool."

#### 3.1 Identity-Lite and the Page Shelf

- **Problem:** No accounts, no page list, no ownership. Users lose pages;
  share links cannot be revoked by an identifiable owner; teams cannot adopt.
- **Scope:** Minimal auth (recommend: email magic-link or GitHub OAuth — the
  audience all have GitHub); a "shelf" home listing your pages (title, updated,
  collaborator count); page ownership assigned at creation, claimable for
  legacy anonymous pages via the edit link; owner-only operations: revoke/rotate
  share links, delete page, manage MCP grants (pairs with 2.3). Explicitly out
  of scope per the direction audit: workspaces, orgs, roles, billing.
- **Key decisions:** Whether anonymous page creation survives (recommend: yes —
  zero-friction first-run is a strength; auth is for keeping, not creating).
- **Acceptance seeds:** Signed-in user sees their pages; owner revokes a view
  link and the link stops resolving; anonymous creation still works; deleting a
  page requires ownership and confirmation.

#### 3.2 Offline Resilience and Local-First Cache

- **Problem:** Yjs makes this nearly free and the portability pillar demands
  it, but there is no client persistence: a dropped connection or closed tab
  mid-edit risks work and trust.
- **Scope:** y-indexeddb (or equivalent) client cache; explicit offline status
  in the existing status surface ("offline — changes saved locally");
  auto-resync on reconnect; define behavior for view-only offline (read cached
  copy). No peer-to-peer, no offline share-link validation.
- **Acceptance seeds:** Kill the server mid-edit, keep typing, restart server,
  changes converge; reload while offline restores the local copy; status
  transitions offline → syncing → saved are visible and calm.

#### 3.3 JSON Canvas Interoperability

- **Problem:** JSON Canvas (Obsidian) is the open interchange format for
  infinite canvases; the direction audit names this mapping a pillar
  requirement. Import/export makes Cascadery legible to the local-first
  ecosystem and de-risks adoption ("I can leave anytime").
- **Scope:** Export page → `.canvas` (Areas → nodes with text/file/link types,
  links → edges with labels/direction; document lossy fields: CSS styles, kinds,
  evidence, comments go to a namespaced extension or are dropped with a
  manifest); import `.canvas` → page. List Cascadery-specific data explicitly
  and use JSON Canvas's extensibility rather than corrupting core fields.
- **Acceptance seeds:** Exported file opens in Obsidian Canvas with correct
  positions, sizes, text, and edges; importing an Obsidian file produces
  editable Areas and links; export → import round-trip in Cascadery preserves
  everything JSON Canvas can carry and reports what it cannot.

#### 3.4 Named Snapshots and Visual Diff

- **Problem:** Version history exists; the Visual RFC workflow wants "snapshot
  at decision time" and a way to see what changed between two states.
- **Scope:** Named, user-created snapshots ("pre-review", "v1 approved") on
  top of the existing history model; a diff view listing added/removed/changed
  Areas and links between two snapshots (list-based diff first, spatial
  ghosting later); restore-as-copy rather than destructive rollback by default.
- **Acceptance seeds:** Create/name/list snapshots; diff two snapshots and see
  changed Areas with before/after text; restore creates a new page or requires
  explicit confirmation to overwrite.

---

### Tier 4 — Reach, Performance, and Craft

#### 4.1 Canvas Performance at Scale

- **Problem:** Real implementation maps grow to hundreds of Areas; every Area
  is a live DOM node with React state in a 6,600-line component.
- **Scope:** Define budgets (recommend: 500 Areas at 60fps pan/zoom on a
  mid-tier laptop; 2,000 Areas usable); viewport culling for offscreen root
  Areas; memoized Area rendering; profile-then-fix methodology with a
  benchmark page generator checked into the repo; App.tsx decomposition as an
  enabling refactor (Canvas, AreaLayer, Dialogs, StatusBar extraction) — the
  refactor spec and the perf spec can be one document since the second requires
  the first.
- **Acceptance seeds:** Benchmark page meets budgets; no interaction
  regressions in the existing test suite; App.tsx no longer contains the Area
  render path.

#### 4.2 Keyboard-First Canvas and Accessibility

- **Problem:** Dialog a11y is handled; canvas a11y is not. NN/g accelerator
  guidance is a stated principle; the canvas itself should honor it.
- **Scope:** Tab/arrow traversal of Areas in a deterministic order; arrow-key
  nudge (with snap-grid multiplier) for selected Areas; keyboard resize; a
  screen-reader-accessible page outline (the Markdown export structure, live);
  focus-visible states distinct from selection; WCAG 2.2 AA pass on all
  chrome; shortcut cheat-sheet dialog.
- **Acceptance seeds:** Create, move, style, link, and delete an Area without a
  pointer; screen reader announces Area kind/status/text on focus; cheat sheet
  lists every shortcut with its palette counterpart.

#### 4.3 Read-Anywhere Responsive View Mode

- **Problem:** View links get opened on phones (standups, PR reviews on the
  go). The canvas is desktop-only.
- **Scope:** View-only responsive treatment: touch pan/pinch-zoom, a linear
  "outline mode" fallback (reuse Markdown export structure) for small screens,
  legible presence/status. Mobile *editing* is explicitly out of scope.
- **Acceptance seeds:** A view link on a 390px viewport can pan, zoom, read all
  text, and switch to outline mode; no horizontal body scroll; edit affordances
  never render.

#### 4.4 Product Site, Docs, and Launch Narrative

- **Problem:** The brand spec exists; there is no site, no public docs, no
  demo. Market fit cannot be tested without distribution.
- **Scope:** Landing page leading with the SDD-visual-layer story (not "CSS
  whiteboard"); a live read-only demo page embedded or one click away
  (view-link infrastructure already supports this); docs covering the MCP
  gateway (agent authors are a growth channel — a good MCP doc is marketing);
  domain checkout for cascadery.com plus trademark check (still open from the
  README); a changelog page fed by the spec-completion cadence.
- **Acceptance seeds:** A visitor reaches a real canvas within one click of the
  landing page; MCP docs include copy-paste configuration for Claude Code and
  Cursor; site is static, fast, and carries the brand system.

#### 4.5 Quality Infrastructure: E2E Harness and Privacy-Respecting Telemetry

- **Problem:** All tests are node:test unit tests; UI behavior is asserted by
  thin `*Ui.test.ts` files that inspect source strings rather than run the app.
  Regressions in pointer interactions (the recent deselect-fix commit streak)
  show the cost. Separately, there is no signal about which features are used,
  so spec prioritization is guesswork.
- **Scope:** Playwright E2E suite covering the golden paths (create/edit/style
  Area, multi-select once 1.1 lands, share link round-trip, two-browser
  collaboration, agent proposal accept); CI wiring in the existing GitHub
  workflow; anonymous, self-hosted, opt-out event counts (feature invoked, not
  content) with a public list of collected events — data-ownership positioning
  demands the telemetry be exemplary or absent.
- **Acceptance seeds:** E2E suite runs headless in CI on every push; a
  two-client collaboration test passes; telemetry can be disabled by env var
  and collects zero page content.

---

## Recommended Sequencing

1. **Now:** 1.1 multi-select, 1.2 Markdown/code Areas, 4.5 E2E harness (cheap
   early, pays for everything after).
2. **Next:** 2.1 SDD interchange (flagship), 1.3 comments, 1.4 search, 1.5 undo.
3. **Then:** 2.2 agent journal, 2.3 MCP hardening, 3.1 identity-lite (2.3 and
   3.1 travel together), 2.4 evidence v2.
4. **Later:** 3.2 offline, 3.3 JSON Canvas, 3.4 snapshots, 4.1 performance,
   4.2 keyboard/a11y, 4.3 responsive view, 4.4 site/launch.

Rationale: Tier 1 restores credibility with the core user; 2.1 is the market
bet and should ship while SDD momentum is high; trust/ownership converts teams;
Tier 4 scales what works. If forced to cut, protect 1.1, 1.2, 2.1, and 2.3 —
they are the product.

## How to Expand These Outlines

When turning an outline into a full spec, follow the existing repo conventions:

- File name: `docs/specs/YYYY-MM-DD-<kebab-title>.md`; link it under "Active
  Foundational Specs" in `docs/specs/README.md`.
- Sections: `Status`, `Goal`, `Research Basis` (with URLs), `Scope` /
  `Non-Goals`, interaction details, `Acceptance Criteria`, `Open Questions`.
- Ground scope in the current code: name the modules touched (e.g. selection
  work lives against `App.tsx` state and `canvasPointerActions.ts`; export work
  extends `pageExports.ts` and `agentHandoff.ts`; MCP work extends
  `mcpGateway.ts`, `agentInterface.ts`, and `src/server/`).
- Every behavior change needs focused tests colocated in `src/` (node:test),
  and page-state changes must round-trip through page JSON export/import and
  the Yjs collaborative doc (`collaborativePage.ts`).
- Agent-facing changes must preserve the AI posture: least privilege, visible
  proposals, audit records, fail-closed.
- Respect the "Avoid" list from the direction audit: no workspaces/orgs before
  3.1's minimal ownership proves out, no broad whiteboard parity, no unreviewed
  agent mutation of shared pages.

## Research Basis

- GitHub Spec Kit and the SDD workflow (spec → plan → tasks → implement):
  https://github.github.com/spec-kit/ and
  https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- SDD tooling landscape comparison (Kiro, spec-kit, Tessl):
  https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- tldraw Agent Starter Kit — structured shape data + screenshots as agent
  context, modular visible actions: https://tldraw.dev/starter-kits/agent
- Miro MCP server — incumbent canvas exposing boards to agents:
  https://developers.miro.com/docs/miro-mcp
- JSON Canvas open format — longevity, interoperability, extensibility:
  https://github.com/obsidianmd/jsoncanvas
- MCP authorization specification — OAuth 2.1 resource servers, RFC 8707
  resource indicators:
  https://modelcontextprotocol.io/specification/draft/basic/authorization
- MCP ecosystem security audits (unauthenticated servers, scope sprawl):
  https://techcommunity.microsoft.com/blog/microsoft-security-blog/the-state-of-mcp-security-in-2026/4531327
- Infinite-canvas market surveys, 2026 (AI-native boards as an axis; "AI reads
  the full board" as emerging table stakes):
  https://storyflow.so/blog/best-infinite-canvas-tools-2026
- OWASP WebSocket security guidance (message-level authz, rate limiting,
  heartbeat cleanup):
  https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
- NN/g: AI agents as users of interfaces:
  https://www.nngroup.com/articles/ai-agents-as-users/
- NN/g: visibility of system status and flexibility/efficiency heuristics:
  https://www.nngroup.com/articles/visibility-system-status/ and
  https://www.nngroup.com/articles/flexibility-efficiency-heuristic/
