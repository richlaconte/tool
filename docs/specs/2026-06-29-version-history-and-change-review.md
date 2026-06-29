# Version History and Change Review Spec

## Status

Created on 2026-06-29 as a foundational trust and recovery spec.

## Goal

Give Cascadery users confidence that collaboration, AI proposals, imports, and destructive actions are reversible and understandable.

## Product Rationale

Cascadery is moving from local canvas to hosted collaborative document. That changes the trust bar. Users need to know:

- What changed?
- Who or what changed it?
- Can I undo it?
- Can I recover from a bad agent proposal, import, or collaborator edit?

This spec connects undo, history, snapshots, and agent audit records into one coherent direction.

## Research Basis

- Nielsen Norman Group's visibility-of-system-status heuristic supports clear save, sync, and change feedback: https://www.nngroup.com/articles/ten-usability-heuristics/
- WAI-ARIA dialog guidance supports accessible review and confirmation flows for important operations: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- MCP security guidance emphasizes authorization, consent, and security-aware operation of tool-enabled agents: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- OWASP WebSocket security guidance recommends authorization, logging, and monitoring of WebSocket events and security violations: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html

## Change Event Model

Introduce a durable change log separate from raw Yjs updates:

```ts
type ChangeActor = {
  kind: 'local-user' | 'remote-user' | 'mcp-agent' | 'system'
  id: string
  displayName: string
}

type ChangeEvent = {
  id: string
  pageId: string
  actor: ChangeActor
  summary: string
  operationCount: number
  createdAt: string
  undoPatch?: PagePatch
  redoPatch?: PagePatch
}
```

Rules:

- Not every keystroke needs a durable event.
- Group continuous text edits, moves, and resize drags into coherent operations.
- Imports, agent patches, deletes, link changes, metadata changes, and share changes should always create events.
- Agent events must include client/tool identity and validation result.

## Undo Model

First version:

- Keep current delete undo.
- Add a general undo stack for local operations.
- Add explicit undo for applied agent proposals using stored undo patches.

Later version:

- Server-backed history can restore a snapshot.
- Multi-user undo should undo only the current user's operation unless a snapshot restore is explicitly chosen.

## Snapshot Model

Create periodic snapshots:

- Before JSON import.
- Before applying an agent proposal with more than one operation.
- Before bulk metadata/link changes.
- Optional timed snapshots after meaningful save intervals.

Snapshots should store a page-state JSON representation, not raw UI state.

## User Experience

First version:

- Add a `History` command palette option.
- History dialog lists recent changes with actor, time, summary, and action type.
- Applied agent proposals show `Undo patch` when reversible.
- Import flow shows `Restore previous page` if import succeeded but was unwanted.

Future:

- Page timeline.
- Named snapshots.
- Version comparison.

## Agent Review Integration

Agent proposal review should eventually show:

- Proposed operation list.
- Estimated impact.
- Validation warnings.
- Accept all, reject all, accept individual operations.
- Undo after apply.
- Link to the change event.

## Acceptance Criteria

- Page changes can create structured change events.
- Applied agent patches create change events with audit identity.
- Applied agent patches can be undone when an undo patch is available.
- JSON imports create a restore point before replacing state.
- History dialog shows recent changes in human-readable language.
- Change events do not store hidden share tokens or full raw page content by default.
- Tests cover event creation, undo patch application, import restore points, and agent audit linkage.

## Non-Goals

- Git-style branching.
- Real-time multi-user conflict visualization.
- Infinite history retention.
- Account-level audit log.
