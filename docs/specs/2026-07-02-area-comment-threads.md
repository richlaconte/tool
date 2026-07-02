# Area Comment Threads

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 1.3). Active.

## Goal

Attach discussion threads to Areas so teams can review a map asynchronously —
the Visual RFC workflow in the product-DX spec names this as required, and it
is the only named workflow capability with no spec until now.

## Research Basis

- Figma/FigJam and Miro anchor comments to objects with resolve states; this is
  the expected async-review pattern on canvases: https://www.figma.com/figjam/
- Product-DX spec, "Visual RFC" workflow: comment threads attached to Areas
  (docs/specs/2026-06-26-cascadery-product-dx.md).
- NN/g visibility of system status — unresolved discussion must be visible
  without opening anything:
  https://www.nngroup.com/articles/visibility-system-status/

## Current State

- The collaborative doc (`src/collaborativePage.ts`) has four top-level maps:
  `page`, `areas`, `assets`, `links`. There is no comment storage anywhere.
- Page JSON (`PageJsonSnapshot`, `src/pagePersistence.ts`, schemaVersion 1) has
  optional `links`; optional fields can be added without a version bump.
- Collaborator identity comes from `CollaborationProfile` (name/color) in
  `src/collaboration.ts` — there are no accounts (identity-lite is a separate
  spec; comments must work with profile names now and gain user ids later).
- View-only enforcement: view sessions get a read-only websocket via
  `src/server/collaborationSecurity.ts`; the server cannot selectively permit
  Yjs writes to only the comments map. This constrains who can comment in v1
  (see Non-Goals).
- Deleted Areas: `deleteCollaborativeArea` removes the area map entry; there
  is a single-area undo toast in App.tsx.

## Scope

### Data model

- New top-level Yjs map `comments`: `commentId -> Y.Map` with fields:
  `id`, `areaId`, `authorName`, `authorColor`, `text` (plain text, max 2000
  chars), `createdAt` (ISO), `resolvedAt` (ISO or null), `resolvedBy`
  (name or null). Flat per-Area threads ordered by `createdAt`; no nested
  replies in v1.
- `src/collaborativePage.ts`: add `COMMENTS_MAP = 'comments'`, plus
  `addCollaborativeComment`, `resolveCollaborativeComment`,
  `deleteCollaborativeComment`, and read support in
  `getPageStateFromCollaborativeDoc` / `replaceCollaborativePageDocState` /
  `applyCollaborativePageStatePatch`, mirroring how `links` is handled.
- `src/pagePersistence.ts`: new `AreaComment` type; `PageJsonSnapshot` gains
  optional `comments?: AreaComment[]`; `serializePageState` / `parsePageJson`
  round-trip them. Older JSON without comments parses fine (schemaVersion
  stays 1).
- New pure module `src/areaComments.ts` with thread helpers:
  `getAreaThread(comments, areaId)`, `getUnresolvedCount(comments, areaId)`,
  `createComment({areaId, profile, text})` (id + timestamps),
  input validation (trim, length cap, reject empty).

### Deleted-Area behavior

- Deleting an Area does not delete its comments; they keep their `areaId` and
  become "archived" — invisible on canvas, still present in JSON export, and
  restored with the Area if the deletion is undone via the toast. Add
  `getOrphanedComments(comments, areas)` to `areaComments.ts` so a future
  cleanup command can list them.

### UI

- Areas with unresolved comments show a small count badge (top-right corner,
  visually distinct from selection chrome; style in `src/App.css`). Resolved
  threads show nothing.
- A thread panel opens from (a) clicking the badge, (b) an area-toolbar
  comment action, (c) a command palette entry "Comment on selected Area". The
  panel anchors beside the selected Area like the existing link flyout
  (`linkFlyoutLinkId` pattern in App.tsx), lists comments oldest-first, has a
  composer at the bottom, and per-thread Resolve / Reopen.
- Comment authors can delete their own comments (matched by profile name in
  v1 — acknowledge this is spoofable until identity lands; note it in the
  panel's data model comments, not the UI).
- Live updates: two collaborators with the panel open see each other's
  comments appear via normal Yjs sync — no extra transport.
- Escape closes the panel (route through `getDialogKeyboardAction` in
  `src/appKeyboardLogic.ts`).

### Exports and agents

- Page JSON export includes comments (above).
- `exportPageAsMarkdown` gains an optional trailing `## Comments` section
  grouped by Area title, off by default, controlled by an options argument
  (`{ includeComments?: boolean }`) and a distinct palette entry.
- MCP (read-only in v1): include per-Area unresolved counts in `get_page`
  area summaries, and add comments to the `get_area` payload in
  `src/agentInterface.ts` (`AgentAreaResource` gains `comments`). No agent
  comment-writing tool in v1; agents that want to raise issues keep using the
  existing suggestion/proposal flow.

## Non-Goals

- View-only visitors commenting. Blocked by the all-or-nothing read-only
  websocket (see Current State). The follow-up path is a server-side REST
  endpoint that validates a view session and writes the comment into the
  hosted doc itself — capture that as its own spec if demand appears.
- Nested replies, reactions, @mentions, notifications.
- Comment editing after posting (delete + repost covers v1).
- Agent-authored comments.

## Acceptance Criteria

- An editor can open a thread on any Area, post comments, resolve, and reopen;
  a second connected editor sees all of it live.
- Unresolved badge counts render on Areas and disappear when resolved.
- Deleting an Area hides its thread; undoing the delete restores it; export
  JSON still contains archived comments.
- Page JSON export → import round-trips comments; pre-comment JSON imports
  cleanly.
- Markdown export with comments enabled lists threads grouped by Area.
- `get_area` via MCP returns the Area's comments; `get_page` includes
  unresolved counts.
- Empty and >2000-char comments are rejected with inline feedback.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/areaComments.test.ts`: create/resolve/reopen/delete, validation caps,
  unresolved counts, orphan detection.
- `src/collaborativePage.test.ts`: extend for comments map round-trip and
  two-doc merge convergence of concurrent comments.
- `src/pagePersistence.test.ts`: extend for optional comments round-trip and
  legacy JSON without comments.
- `src/pageExports.test.ts`: extend for the Markdown comments section.

## Open Questions

- Should resolving require being the thread starter? Recommend: no — any
  editor can resolve (matches Figma) and `resolvedBy` records who.
- Badge placement when an Area also shows offscreen/link indicators — pick a
  corner and document it in `App.css` comments.
