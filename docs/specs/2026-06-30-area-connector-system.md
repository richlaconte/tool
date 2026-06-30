# Area Connector System Spec

## Status

Created on 2026-06-30. Not implemented.

## Goal

Refine Cascadery's line/link system into a clear Area connector model that supports:

- Simple visual connections for less technical users.
- Developer-native semantic relationships for implementation context.
- Lightweight database/schema-style connectors for technical diagrams.
- Agent-readable structured links that still render calmly on the canvas.

This should improve the current `AreaLink` MVP without turning Cascadery into a broad diagramming clone.

## Research Basis

HCI and visual perception:

- Nielsen Norman Group's connectedness guidance says visually connected elements are perceived as belonging together, and that line connection is strong enough to override other small differences: https://www.nngroup.com/videos/connectedness-gestalt/
- Nielsen Norman Group's proximity guidance says nearby elements are perceived as related, which means connectors must work with spatial layout rather than replace it: https://www.nngroup.com/articles/gestalt-proximity/
- Nielsen Norman Group's recognition-over-recall guidance supports showing relationship presets and visual choices instead of requiring users to remember relationship vocabulary: https://www.nngroup.com/articles/recognition-and-recall/

Graph readability:

- Dunne and Shneiderman's graph readability work identifies node occlusion, edge crossings, crossing angle, and edge tunneling as important readability metrics for network drawings: https://www.researchgate.net/publication/216017178_Improving_graph_drawing_readability_by_incorporating_readability_metrics_A_software_tool_for_network_analysts
- The same work notes that reducing edge crossings improves edge tracing tasks and user preference, while edge-crossing angle affects path-finding performance.

Accessibility:

- WAI-ARIA modal/dialog guidance should apply to any connector editing dialog: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

## Product Direction

Cascadery should not compete with Miro/FigJam as a general diagramming product. Connectors should exist because implementation context often needs relationships:

- A task implements a decision.
- A risk blocks a plan.
- A UI state depends on an API state.
- A component references a file.
- A table has a foreign-key relationship to another table.

The connector system should preserve the product principles:

- CSS-native, but not CSS-expert-only.
- Spatial work stays fast.
- Structure emerges from use.
- Expert shortcuts have visible counterparts.
- Agents can read semantic intent.

## Design Recommendation

Build a two-layer connector system:

1. Semantic model
   - Stable link data for agents, persistence, exports, MCP, and future history.
   - Stores relationship kind, direction, label, endpoints, and optional schema details.

2. Visual presentation
   - Calm line/arrow rendering for humans.
   - Defaults to simple, readable connectors.
   - Supports an advanced schema mode only when explicitly chosen.

This gives less technical users a simple visual system while still allowing developer and database relationships to be precise.

## User Experience

### Connector Creation

Support three creation paths:

1. Direct manipulation
   - Selected/hovered Areas show a small connector handle.
   - Dragging from the handle starts a connector preview.
   - Dropping on another Area opens a compact connector popover or uses the default relation.
   - While dragging a connector, blank-canvas Area creation is disabled so misses do not create accidental Areas.

2. Toolbar action
   - Area toolbar includes a connector icon.
   - Clicking opens a relationship picker for the selected Area.
   - User chooses target Area, relationship, and visual mode.

3. Command palette
   - Keep and refine `Link selected Area`.
   - Add searchable aliases such as `connect`, `arrow`, `relationship`, `schema`, `foreign key`.

### Connector Editing

Selecting a connector should:

- Increase the connector hit target without making the visible stroke heavy.
- Show endpoint handles.
- Show a small label chip if the connector has a label or relationship.
- Expose a compact editor with:
  - Relationship kind
  - Label
  - Direction
  - Visual mode
  - Delete

Recommended keyboard behavior:

- `Delete` removes selected connector.
- `Escape` deselects connector.
- `Enter` opens connector editor.

### Simple Visual Mode

This is the default for less technical users.

Simple mode should use plain-language choices:

- `Relates to`
- `Leads to`
- `Blocks`
- `Answers`
- `Contains`
- `References`

Visual treatment:

- Muted line behind Areas.
- Optional arrowhead.
- Small label chip only when selected/hovered or when the user set an explicit label.
- No crow's-foot symbols, no dense endpoint notation.

### Developer Semantic Mode

Developer mode maps to the existing `AreaLinkKind` concepts and expands them only if needed:

- `relates-to`
- `depends-on`
- `implements`
- `blocks`
- `answers`
- `references`
- Future: `contains`, `tests`, `documents`, `duplicates`, `supersedes`

Visual treatment:

- Directional arrow for directed relationships.
- Dashed line for loose/reference relationships.
- Solid line for dependency/implementation relationships.
- Label uses the relationship name only when selected/hovered unless the user explicitly pins it.

### Schema Connector Mode

Schema mode is for database and entity-relationship sketches, not a full database designer.

Expose a simplified set:

- `references`
- `one-to-one`
- `one-to-many`
- `many-to-many`
- `optional`
- `required`

Recommended UX:

- The connector editor has a `Schema` toggle or visual mode option.
- When enabled, show fields:
  - `From cardinality`: `one`, `many`
  - `To cardinality`: `one`, `many`
  - `Optionality`: `optional`, `required`, `mixed`
  - `Label`: optional, for example `user_id`
- Use subtle endpoint marks rather than a full crow's-foot notation in MVP.
- Provide a plain-language explanation preview such as `Many orders reference one user`.

## Data Model

Extend the current `AreaLink` model without breaking existing pages:

```ts
type AreaLinkEndpoint = {
  areaId: string
  anchor?: 'auto' | 'top' | 'right' | 'bottom' | 'left' | 'center'
}

type AreaLinkVisualMode = 'simple' | 'semantic' | 'schema'

type AreaLinkVisual = {
  mode: AreaLinkVisualMode
  direction?: 'none' | 'forward' | 'backward' | 'both'
  route?: 'auto' | 'straight' | 'orthogonal'
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  labelVisibility?: 'auto' | 'always' | 'selected'
}

type AreaLinkSchema = {
  fromCardinality?: 'one' | 'many'
  toCardinality?: 'one' | 'many'
  optionality?: 'optional' | 'required' | 'mixed'
  fieldLabel?: string
}

type AreaLink = {
  id: string
  fromAreaId: string
  toAreaId: string
  kind: AreaLinkKind
  label?: string
  from?: AreaLinkEndpoint
  to?: AreaLinkEndpoint
  visual?: AreaLinkVisual
  schema?: AreaLinkSchema
  createdAt: string
  updatedAt: string
}
```

Compatibility:

- Existing `fromAreaId` and `toAreaId` remain canonical for MVP compatibility.
- New `from`/`to` endpoint objects are optional and can be derived from the old fields.
- Existing links default to:
  - `visual.mode = 'semantic'`
  - `visual.direction = 'forward'`
  - `visual.route = 'auto'`
  - `visual.labelVisibility = 'auto'`

## Visual Routing

MVP routing should be intentionally modest.

Recommended rules:

- Use straight lines when two Areas are not overlapping and the line has low clutter.
- Use orthogonal elbow routes for schema mode.
- Route from nearest sensible side by default.
- Avoid routing through the middle of the source or target Area.
- Maintain an invisible wider hit target around each connector for selection.
- Keep connector rendering behind Areas.

Do not attempt a full graph layout engine in this spec. The research argues for reducing crossings and occlusion, but Cascadery's strength is user-authored spatial layout. Provide tools that make good layout easier rather than taking over layout.

## Clutter Management

To prevent connector "hairballs":

- Connector labels are auto-hidden except on hover/selection unless pinned.
- Low-emphasis lines stay muted by default.
- Selected or hovered Area highlights only directly connected links.
- Add a future `Hide unrelated connectors` command once dense boards become common.
- In schema mode, prefer orthogonal routes with small endpoint marks over heavy symbols.
- Avoid making every Area show connector handles all the time.

## Agent, MCP, and Export Behavior

Connectors must remain semantic:

- MCP page resources include connector kind, label, endpoints, visual mode, and schema details.
- Agent suggestions can create connector patches but must be reviewable before application.
- Markdown export lists connector relationships in a `Relationships` section.
- JSON Canvas export maps basic connectors where the target format supports edges and preserves Cascadery-specific fields in metadata.
- Cascadery JSON remains the lossless source of truth.

## Accessibility

- Connector relationships must be available as text in dialogs, exports, and MCP resources.
- Connector hit targets should be keyboard selectable through a future "links list" or inspector.
- Connector editing dialogs must follow modal focus behavior and close on Escape.
- Do not rely on color alone to express relationship kind; use labels, line style, and endpoint marks.

## Implementation Strategy

Recommended phases:

1. Data and rendering foundation
   - Add optional visual/schema fields to `AreaLink`.
   - Preserve backwards compatibility in parsing, serialization, collaboration, and server storage.
   - Refactor link line rendering into a small helper module that computes endpoints, route, arrowhead, label, and hit target data.

2. Selection and editing
   - Make connectors selectable.
   - Add a compact connector editor.
   - Add delete/edit behavior.

3. Creation improvements
   - Add Area connector handle and toolbar action.
   - Refine command palette flow.
   - Prevent accidental blank-Area creation while connector dragging.

4. Schema mode
   - Add schema visual mode fields and simplified cardinality controls.
   - Render subtle endpoint marks.

## Acceptance Criteria

- Existing links continue to load and render.
- New links can store optional endpoint, visual, and schema metadata.
- Users can create a connector through a visible Area affordance, not only command palette.
- Users can select, edit, and delete a connector.
- Simple mode is understandable without database or graph terminology.
- Schema mode supports basic cardinality/optionality without overwhelming the default UI.
- Connector labels and relationship kinds are visible on hover/selection and available in text form.
- Connector rendering avoids covering Area content or blocking Area interactions.
- Connector data persists through page JSON, server storage, collaboration, MCP resources, and exports.
- Tests cover link parsing, migration defaults, endpoint calculation, selection behavior, connector editor UI, and export/MCP serialization.

## Suggested Test Coverage

- `areaMetadata.test.ts` or new `areaConnectors.test.ts` for visual/schema defaults and compatibility.
- `pagePersistence.test.ts` for optional connector fields.
- `collaborativePage.test.ts` and server storage tests for connector round trips.
- UI/source tests for connector handles, selection hit targets, editor fields, and schema mode.
- Export tests for Markdown/JSON Canvas relationship output.
- MCP tests for connector metadata in page resources and patch suggestions.

## Non-Goals

- Full automatic graph layout.
- Full ERD/database modeling.
- Live database introspection.
- Arbitrary freehand drawing.
- Edge bundling.
- Multi-page relationship maps.
- Rich diagramming stencil library.

## Open Questions

- Should connector handles appear on all four sides or only as one toolbar action in MVP?
- Should simple mode use `Leads to` as the default relationship or preserve `relates-to`?
- Should schema mode add new Area kinds such as `table`, `field`, and `entity`, or remain connector-only for the first pass?
- Should connector labels be pin-able from the first implementation or only auto-visible on hover/selection?
- Should `/connect`, `/blocks`, or `/references` slash commands be introduced after the visible UI lands?
