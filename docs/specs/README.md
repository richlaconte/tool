# Cascadery Specs

This directory is split between active foundational specs and completed MVP specs.

## Product Direction

- [Spec Suite Roadmap](2026-07-02-cascadery-spec-suite-roadmap.md)
- [Product Direction Audit](2026-06-29-cascadery-product-direction-audit.md)
- [Product and Developer Experience Direction](2026-06-26-cascadery-product-dx.md)

## Active Foundational Specs

Drafted on 2026-07-02 from the [Spec Suite Roadmap](2026-07-02-cascadery-spec-suite-roadmap.md).
Tiers are priority order; the roadmap's "Recommended Sequencing" section gives
the suggested build order within and across tiers.

### Tier 1 — Canvas Table Stakes

All Tier 1 specs are complete.

### Tier 2 — Spec-Driven Development and the Agent Round-Trip

All Tier 2 specs are complete.

### Tier 3 — Trust and Ownership

- [JSON Canvas Interoperability](2026-07-02-json-canvas-interop.md)
- [Named Snapshots and Visual Diff](2026-07-02-named-snapshots-visual-diff.md)

### Tier 4 — Reach, Performance, and Craft

- [Canvas Performance at Scale](2026-07-02-canvas-performance-at-scale.md)
- [Keyboard-First Canvas and Accessibility](2026-07-02-keyboard-first-canvas-accessibility.md)
- [Read-Anywhere Responsive View Mode](2026-07-02-responsive-view-mode.md)
- [Product Site, Docs, and Launch Narrative](2026-07-02-product-site-launch.md)
- [Quality Infrastructure: E2E Harness and Telemetry](2026-07-02-quality-infrastructure.md)

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
- [Agent Work Journal and Live Agent Presence](completed/2026-07-02-agent-work-journal.md)
- [Brand Positioning and Narrative System](completed/2026-06-29-brand-positioning-and-narrative.md)
- [Cascadery Brand Leave Confirmation](completed/2026-06-30-brand-leave-confirmation.md)
- [Cascadery Logo and Favicon Integration](completed/2026-06-30-cascadery-logo-favicon-integration.md)
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
- [Markdown and Code-Native Area Content](completed/2026-07-02-markdown-code-area-content.md)
- [Linked Areas Direct Manipulation UX](completed/2026-06-30-linked-areas-direct-manipulation-ux.md)
- [Multi-Select and Group Manipulation](completed/2026-07-02-multi-select-group-manipulation.md)
- [Multi-User Collaboration](completed/2026-06-26-multi-user-collaboration.md)
- [Nested Areas](completed/2026-06-26-nested-areas.md)
- [Offline Resilience and Local-First Cache](completed/2026-07-02-offline-resilience.md)
- [Offscreen Area Indicators](completed/2026-06-30-offscreen-area-indicators.md)
- [Page Search and Navigation](completed/2026-07-02-page-search-navigation.md)
- [Page JSON Persistence](completed/2026-06-26-page-json-persistence.md)
- [Remote MCP Hardening](completed/2026-07-02-remote-mcp-hardening.md)
- [Security and Privacy Baseline](completed/2026-06-26-cascadery-security-privacy.md)
- [Share Links](completed/2026-06-26-share-links.md)
- [Smooth Trackpad Zoom](completed/2026-06-29-smooth-trackpad-zoom.md)
- [SDD Artifact Interchange](completed/2026-07-02-sdd-artifact-interchange.md)
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
