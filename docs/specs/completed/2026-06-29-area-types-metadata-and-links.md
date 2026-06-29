# Area Types, Metadata, and Links Spec

## Status

Completed on 2026-06-29 as an MVP foundational product-direction spec.

## Goal

Add lightweight semantic structure to Areas so Cascadery pages can represent implementation context, not only styled text boxes.

## Product Rationale

The product direction depends on Cascadery being useful to both humans and agents. Spatial text alone is flexible, but agents and collaborators need stable meaning:

- This Area is a decision.
- This Area references a file.
- This Area is a risk, task, component, API, UI state, or question.
- These two Areas are related.

Semantic structure should emerge from use and remain optional. It should not turn every Area into a heavyweight form.

## Research Basis

- Miro MCP exposes board content to agents for search, summaries, structured layouts, diagrams, and development workflows: https://developers.miro.com/docs/miro-mcp
- tldraw's agent starter kit passes selected shapes, viewport context, recent actions, screenshots, and simplified shape data to agents: https://tldraw.dev/starter-kits/agent
- Nielsen Norman Group's 2026 AI-agent guidance argues that interfaces increasingly need to serve both humans and agents: https://www.nngroup.com/articles/ai-agents-as-users/
- JSON Canvas supports extensible canvas data and user ownership, which supports adding metadata without trapping users: https://github.com/obsidianmd/jsoncanvas

## Area Type Model

Add optional Area metadata:

```ts
type AreaKind =
  | 'note'
  | 'decision'
  | 'question'
  | 'task'
  | 'risk'
  | 'file'
  | 'component'
  | 'api'
  | 'ui-state'

type AreaMetadata = {
  kind: AreaKind
  status?: 'open' | 'in-progress' | 'decided' | 'done' | 'blocked'
  tags: string[]
  filePath?: string
  url?: string
}
```

Defaults:

- Existing Areas migrate to `kind: 'note'`.
- Metadata is optional in persisted JSON for backwards compatibility.
- UI should not require metadata before an Area is useful.

## Link Model

Support directional links between Areas:

```ts
type AreaLinkKind =
  | 'relates-to'
  | 'depends-on'
  | 'implements'
  | 'blocks'
  | 'answers'
  | 'references'

type AreaLink = {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
  createdAt: string
  updatedAt: string
}
```

Rules:

- Links connect stable Area ids.
- Deleting an Area deletes links attached to it.
- Duplicating an Area does not duplicate links by default.
- Links should be exported with page JSON.

## User Experience

First version:

- Command palette exposes `Set Area type`.
- Area toolbar or future inspector exposes type/status controls.
- Area type appears as a quiet label or icon only when selected or hovered.
- Links can be created through command palette actions:
  - `Link selected area to...`
  - `Mark selected area as blocking...`
- Links render as simple connector lines behind Areas.

Slash command shortcuts:

```txt
/type decision
/type risk
/status blocked
/tag auth security
/file src/App.tsx
```

These are Area metadata commands, not CSS style commands.

## Agent and MCP Behavior

MCP resources should include Area metadata and links in stable JSON.

Agent suggestion tools can:

- Suggest missing Area types.
- Extract decisions into typed decision Areas.
- Link risks to tasks or decisions.
- Create implementation maps from files/components.

Agent write proposals must use the same reviewable patch flow as other changes.

## Accessibility

- Metadata controls use native form controls or command-palette commands.
- Connector lines are decorative unless a link is focused or selected.
- Link relationships must be represented in text in MCP/export data, not only visually.

## Acceptance Criteria

- Areas can store optional type, status, tags, file path, and URL metadata.
- Metadata persists through page JSON and collaboration.
- Existing pages load without metadata.
- Users can set Area type and status without editing JSON.
- Links can connect two Areas and persist in page JSON.
- Deleting an Area removes attached links.
- MCP page resources include metadata and links.
- Tests cover metadata persistence, link CRUD helpers, deletion behavior, and resource serialization.

## Non-Goals

- Full issue-tracker workflow.
- User accounts or assignees.
- Rich graph layout.
- Multi-select bulk metadata editing.

## Implementation Notes

- Added optional Area metadata for kind, status, tags, file paths, and URLs.
- Added directional Area links with stable ids, labels, timestamps, and relationship kinds.
- Page JSON, browser state, Yjs collaboration state, server-side collaborative storage, history restore snapshots, and MCP resources now preserve metadata and links.
- The command palette exposes `Set Area type` and `Link selected Area`.
- The first UI supports editing type/status and creating one directional link from the selected Area to another Area.
- Links render as passive connector lines behind Areas.
- Deleting an Area removes links attached to the deleted Area and its descendants.

## Future Work

- Implement the metadata slash commands listed above (`/type`, `/status`, `/tag`, `/file`).
- Add link selection, link editing, and link deletion UI.
- Add richer icons or visual variants for common Area kinds.
- Let agent proposals create or update metadata and links through the reviewable patch flow.
- Consider a compact Area inspector if metadata editing grows beyond type/status.
