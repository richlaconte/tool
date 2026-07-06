# Cascadery Specs

This directory is split between active foundational specs and completed MVP specs.

## Product Direction

- [Spec Suite Roadmap](2026-07-02-cascadery-spec-suite-roadmap.md)
- [Product Direction Audit](2026-06-29-cascadery-product-direction-audit.md)
- [Product and Developer Experience Direction](2026-06-26-cascadery-product-dx.md)

## Active Foundational Specs

**The Priority Queue below is the authoritative pick order.** The tier
sections that follow it are provenance — they explain where each spec came
from and why it exists, but they are not a build order. An agent or
developer looking for the next task takes the lowest-numbered queue entry
that is not already in progress. Audited on 2026-07-06: every spec listed
here was verified against the codebase as genuinely not yet implemented.

### Priority Queue

Each spec is scored 0–2 on four axes:

- **Wedge** — how directly it advances the core bet (developer context
  canvas + reviewable agent round-trip, per the direction audit).
- **Clock** — external time pressure (protocol windows, market momentum).
- **Unblocks** — whether other queued specs or launch depend on it.
- **Daily** — breadth × frequency of benefit to existing users.

Priority bands by total score: **P0** ≥ 6, **P1** 4–5, **P2** 2–3.
Two sequencing overrides can demote a spec below its score: a dependency on
an earlier queue entry, or an explicit gate (noted inline). When a spec
completes, move it to `completed/`, delete its queue row, and re-check the
overrides — do not renumber mid-flight work.

| # | Spec | Band | W | C | U | D | Rationale |
|---|------|------|---|---|---|---|-----------|
| 4 | [Adaptive Color Scheme](2026-07-06-adaptive-color-scheme.md) | P1 | 1 | 0 | 1 | 2 | Dark-IDE audience fit; token layer retires the contrast-audit debt and unblocks theming. |
| 5 | [Canvas Wayfinding: Minimap + Viewport History](2026-07-06-canvas-wayfinding-minimap.md) | P2 | 1 | 0 | 1 | 1 | Deferred-until-perf minimap (precondition met); viewport history feeds #6. |
| 6 | [Async Change Awareness](2026-07-06-async-change-awareness.md) | P2 | 2 | 0 | 0 | 1 | The async agent-edit recap; sequenced after #5 for reversible jumps (dependency override). |
| 7 | [Read-Anywhere Responsive View Mode](2026-07-02-responsive-view-mode.md) | P2 | 1 | 0 | 1 | 1 | Share-link reach on phones; reuses the outline component. |
| 8 | [Product Site, Docs, and Launch Narrative](2026-07-02-product-site-launch.md) | P1* | 1 | 1 | 2 | 0 | *Gated: start when a launch date exists or the queue above is nearly drained — the site must document what shipped, and it owns the MCP registry listing. |

### Tier 1 — Canvas Table Stakes

All Tier 1 specs are complete.

### Tier 2 — Spec-Driven Development and the Agent Round-Trip

All Tier 2 specs are complete.

### Tier 3 — Trust and Ownership

All Tier 3 specs are complete.

### Tier 4 — Reach, Performance, and Craft

- [Read-Anywhere Responsive View Mode](2026-07-02-responsive-view-mode.md) — queue #7
- [Product Site, Docs, and Launch Narrative](2026-07-02-product-site-launch.md) — queue #8 (gated)

### Tier 5 — 2026-07-05 Market Pulse

Drafted on 2026-07-05 from a follow-up market and product research pass.
The signals behind them: the MCP 2026-07-28 release candidate (stateless
core, Tasks and Apps extensions), spec-driven development going mainstream
(Spec Kit ~90k stars, Kiro GA, EARS notation), the rise of "mission control"
tools for parallel coding agents, and Mermaid as the lingua franca of
agent-emitted structure. Suggested order: MCP alignment and mission control
first (they compound the agent wedge), then SDD fidelity, then Mermaid.
All Tier 5 specs are complete.

### Tier 6 — 2026-07-06 HCI/UX Research Pass

Drafted on 2026-07-06 from a deep audit of the app surface against HCI and
CSCW research. The signals: 259 hard-coded light-scheme hex colors and no
`prefers-color-scheme` support for a dark-IDE audience; teleporting
navigation (search, outline, journal, indicators) with no way back and a
minimap three completed specs deferred until performance work landed (it
has); and no asynchronous change awareness for returning collaborators
despite agents editing pages while users are away (Gutwin & Greenberg;
Tam & Greenberg). Suggested order: color scheme first (broad daily-use
payoff, unblocks contrast audit debt), then wayfinding, then change
awareness (it benefits from wayfinding's viewport history).

- [Adaptive Color Scheme: Semantic Chrome Tokens and Dark Mode](2026-07-06-adaptive-color-scheme.md) — queue #4
- [Canvas Wayfinding: Minimap and Viewport History](2026-07-06-canvas-wayfinding-minimap.md) — queue #5
- [Asynchronous Change Awareness: The "Since You Were Away" Recap](2026-07-06-async-change-awareness.md) — queue #6

### Tier 7 — 2026-07-06 Reliability Defects

Created from live product debugging rather than market research. These specs
preempt normal queue order when they threaten the core promise of a shared
canvas.

All Tier 7 specs are complete.

## Completed MVP Specs

Completed specs live in [completed](completed). A completed spec means its core MVP acceptance criteria are represented in the app and test suite. Future polish listed inside those specs can still become new active specs later.

- [Area Duplicate Action](completed/2026-06-26-area-duplicate-action.md)
- [Area Resize](completed/2026-06-26-area-resize.md)
- [Area CSS Style Dialog](completed/2026-06-30-area-css-style-dialog.md)
- [Area Style Dialog Overhaul](completed/2026-07-01-area-style-dialog-overhaul.md)
- [Area Styles Dialog UX Audit and Simplification](completed/2026-06-30-area-styles-dialog-ux-audit.md)
- [Area Connector System](completed/2026-06-30-area-connector-system.md)
- [Area Comment Threads](completed/2026-07-02-area-comment-threads.md)
- [Area Toolbar Delete](completed/2026-06-26-area-toolbar-delete.md)
- [Area Types, Metadata, and Links](completed/2026-06-29-area-types-metadata-and-links.md)
- [AI and MCP Agent Interface](completed/2026-06-26-cascadery-ai-mcp-interface.md)
- [Agent Handoff Briefs](completed/2026-06-29-agent-handoff-briefs.md)
- [Agent Mission Control](completed/2026-07-05-agent-mission-control.md)
- [Agent Work Journal and Live Agent Presence](completed/2026-07-02-agent-work-journal.md)
- [Brand Positioning and Narrative System](completed/2026-06-29-brand-positioning-and-narrative.md)
- [Cascadery Brand Leave Confirmation](completed/2026-06-30-brand-leave-confirmation.md)
- [Cascadery Logo and Favicon Integration](completed/2026-06-30-cascadery-logo-favicon-integration.md)
- [Canvas Performance at Scale](completed/2026-07-02-canvas-performance-at-scale.md)
- [Canvas Zoom](completed/2026-06-26-canvas-zoom.md)
- [Child Area Drop Target Feedback](completed/2026-06-30-child-area-drop-target-feedback.md)
- [Command Palette Completion](completed/2026-06-26-command-palette-completion.md)
- [Context Kits and Guided Empty State](completed/2026-06-29-context-kits-and-guided-empty-state.md)
- [Evidence Anchors and Code References](completed/2026-06-29-evidence-anchors-and-code-references.md)
- [Evidence Anchors v2: Repo-Linked Context](completed/2026-07-02-evidence-anchors-v2.md)
- [Empty State Zoom Options](completed/2026-06-30-empty-state-zoom-options.md)
- [GIF Search and Insertion](completed/2026-06-30-gif-search-insertion.md)
- [Image Support](completed/2026-06-26-image-support.md)
- [Identity-Lite and the Page Shelf](completed/2026-07-02-identity-lite-page-shelf.md)
- [Interoperability and Export](completed/2026-06-29-interoperability-and-export.md)
- [JSON Canvas Interoperability](completed/2026-07-02-json-canvas-interop.md)
- [Keyboard-First Canvas and Accessibility](completed/2026-07-02-keyboard-first-canvas-accessibility.md)
- [Markdown and Code-Native Area Content](completed/2026-07-02-markdown-code-area-content.md)
- [Mermaid Diagram Interop: Paste Agent Diagrams, Export Canvas Structure](completed/2026-07-05-mermaid-diagram-interop.md)
- [MCP 2026 Alignment: Stateless Core, Tasks Extension, and an MCP App Surface](completed/2026-07-05-mcp-2026-alignment.md)
- [Linked Areas Direct Manipulation UX](completed/2026-06-30-linked-areas-direct-manipulation-ux.md)
- [Live Collaboration Convergence](completed/2026-07-06-live-collaboration-convergence.md)
- [Multi-Select and Group Manipulation](completed/2026-07-02-multi-select-group-manipulation.md)
- [Multi-User Collaboration](completed/2026-06-26-multi-user-collaboration.md)
- [Named Snapshots and Visual Diff](completed/2026-07-02-named-snapshots-visual-diff.md)
- [Nested Areas](completed/2026-06-26-nested-areas.md)
- [Offline Resilience and Local-First Cache](completed/2026-07-02-offline-resilience.md)
- [Offscreen Area Indicators](completed/2026-06-30-offscreen-area-indicators.md)
- [Page Search and Navigation](completed/2026-07-02-page-search-navigation.md)
- [Page JSON Persistence](completed/2026-06-26-page-json-persistence.md)
- [Quality Infrastructure: E2E Harness and Telemetry](completed/2026-07-02-quality-infrastructure.md)
- [Remote MCP Hardening](completed/2026-07-02-remote-mcp-hardening.md)
- [Security and Privacy Baseline](completed/2026-06-26-cascadery-security-privacy.md)
- [Share Links](completed/2026-06-26-share-links.md)
- [Smooth Trackpad Zoom](completed/2026-06-29-smooth-trackpad-zoom.md)
- [SDD Artifact Interchange](completed/2026-07-02-sdd-artifact-interchange.md)
- [SDD Fidelity: EARS Requirements and Spec Kit Layout Compatibility](completed/2026-07-05-sdd-fidelity-ears-spec-kit.md)
- [Snap Grid](completed/2026-06-26-snap-grid.md)
- [Sprint Retro Context Kit](completed/2026-06-30-sprint-retro-context-kit.md)
- [Theme Color Shortcuts](completed/2026-06-26-theme-color-shortcuts.md)
- [Undo/Redo Consolidation](completed/2026-07-02-undo-redo-consolidation.md)
- [Version History and Change Review](completed/2026-06-29-version-history-and-change-review.md)
- [View-Only Presentation Mode](completed/2026-06-29-view-only-presentation-mode.md)

## Completion Rule

Move a spec into `completed/` only when:

- The core user path exists in the app.
- Page JSON or server persistence supports the new state.
- Interaction behavior is covered by focused tests.
- Any omitted non-MVP items are explicitly future work, not hidden gaps.

When completing a spec, also: mark its Status section "Completed" with a
date (never leave "Active." text in `completed/`), remove its Priority
Queue row and tier-list line above, add it to the completed list below, and
re-check the queue's dependency/gate overrides. When adding a new spec,
score it on the four axes and insert it into the queue at its band.
