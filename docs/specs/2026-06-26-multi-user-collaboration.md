# Next.js and WebSocket Multi-User Collaboration Spec

## Status

Expanded on 2026-06-26 after research. This spec supersedes the earlier high-level collaboration note. The current implementation is still a Vite client using `BroadcastChannel`; that is useful for same-browser tab sync only and does not satisfy this spec.

Updated on 2026-06-26 for the MVP access decision: authentication and edit/view authorization are not required yet. The first server-backed implementation treats every `/p/[pageId]` URL as an editable collaboration room. Share-token validation, signed sessions, and view-only links are future work.

## Goal

Migrate the editor to a Next.js app with a real server-backed collaboration layer so multiple users on different browsers and machines can edit the same page and see each other's cursors/selections. For the MVP, anyone with the page URL can edit.

## Current State

- App shell: Vite + React.
- Persistence: local JSON in browser storage plus import/export.
- Sharing: local edit/view links with tokens stored in page state.
- Collaboration: `BroadcastChannel` state sync and presence between same-origin tabs.
- Limitation: no server, no durable room state, no cross-machine collaboration, no server-side permission enforcement.

## Research Basis

Product and UX:

- Figma's multiplayer writeup argues that live cursors, selections, avatars, and access controls make collaboration feel like a natural extension of single-player editing. It also calls out property-level conflict resolution, small message sizes, and careful undo semantics as core challenges.
- Fluent 2 avatar guidance supports avatars/presence badges for identifying active collaborators, with text/tooltips for accessibility.
- Nielsen Norman Group's visibility-of-system-status heuristic supports visible connection, saving, syncing, and reconnecting states.
- WAI-ARIA keyboard practices apply because collaboration must not steal focus, break keyboard editing, or create unreachable controls.

Technical:

- Next.js route handlers support normal HTTP methods, but Next.js itself does not expose a stable native WebSocket upgrade API. A custom server is therefore valid when the framework router cannot meet this requirement.
- Vercel added public-beta WebSocket support for Functions in June 2026, including a Next.js workaround via `experimental_upgradeWebSocket()`, but Vercel's docs still advise external storage for rooms, presence, and pub/sub state.
- MDN notes that the browser `WebSocket` API is widely available but does not provide automatic backpressure, so the app must throttle high-frequency messages and enforce server payload limits.
- Yjs shared types are designed to sync and persist collaborative state. `y-websocket` and Hocuspocus both use WebSockets to distribute document updates and awareness information.
- Hocuspocus is a Yjs WebSocket backend with authentication hooks, read-only mode, persistence hooks/extensions, and awareness support. It is the best fit here because it avoids hand-rolling CRDT sync while still allowing app-specific authorization later.
- Hocuspocus persistence docs warn to persist the Yjs binary format, not reconstruct documents from JSON on each load, because reconstructing can duplicate content and break merge history.
- OWASP WebSocket guidance recommends origin validation, authorization during handshake and message processing, payload limits, idle timeouts/heartbeat, rate limiting, security logging, TLS, and tests for unauthorized origins and oversized messages.

Sources:

- https://www.figma.com/blog/multiplayer-editing-in-figma/
- https://fluent2.microsoft.design/components/web/react/core/avatar/usage
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- https://nextjs.org/docs/pages/guides/custom-server
- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://vercel.com/docs/functions/websockets
- https://vercel.com/docs/frameworks/backend
- https://vercel.com/changelog/websocket-support-is-now-in-public-beta
- https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- https://docs.yjs.dev/getting-started/working-with-shared-types
- https://docs.yjs.dev/ecosystem/connection-provider/y-websocket
- https://tiptap.dev/docs/hocuspocus/getting-started/overview
- https://tiptap.dev/docs/hocuspocus/server/examples
- https://tiptap.dev/docs/hocuspocus/guides/authentication
- https://tiptap.dev/docs/hocuspocus/guides/persistence
- https://tiptap.dev/docs/hocuspocus/server/extensions/sqlite
- https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
- https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_WebSockets

## Recommended Approach

Use Next.js for the app shell and a Hocuspocus/Yjs WebSocket server for collaboration.

Primary implementation target:

- A custom Node server that runs Next.js and Hocuspocus in one process.
- A durable SQLite store for local/self-hosted MVP persistence.
- Yjs for collaborative page state and text editing.
- Hocuspocus awareness for cursor, selection, user name, and color presence.
- Anonymous edit access by page URL for the first implementation.

This is the simplest robust path because it provides real WebSocket rooms, CRDT text merging, awareness, and persistence hooks without inventing a custom collaboration protocol. Hocuspocus still leaves room to add read-only enforcement when access control becomes a requirement.

Deployment note:

- For local development and self-hosting, use the custom Node server.
- For Vercel deployment, add a later adapter using Vercel's WebSocket beta and `experimental_upgradeWebSocket()`. Because the API is currently experimental and Vercel recommends external state for rooms/presence/pub-sub, do not make Vercel beta support a blocker for the first server-backed implementation.

## Alternatives Considered

### Option A: Custom JSON WebSocket Protocol

Pros:

- Small initial dependency footprint.
- Can reuse the current `PageOperation` reducer quickly.
- Easy to inspect in tests.

Cons:

- Hard to make simultaneous text edits correct.
- Requires custom reconnect, replay, compaction, conflict, and awareness logic.
- Will drift toward a custom CRDT over time.

Decision: reject as the primary path. Keep current operation helpers for non-text transforms and tests, but do not build collaboration around raw JSON operations.

### Option B: `y-websocket`

Pros:

- Official Yjs provider.
- Distributes Yjs updates and awareness.
- Supports cross-tab communication as a bonus.

Cons:

- Authentication, read-only behavior, and persistence are less ergonomic for this app's share-link model.
- More custom server work is required.

Decision: acceptable fallback, but Hocuspocus is a better fit.

### Option C: Hocuspocus/Yjs

Pros:

- WebSocket backend built on Yjs.
- Auth hook can validate share links.
- Read-only mode can prevent viewer writes.
- Persistence hooks/extensions handle Yjs binary state.
- Awareness is built for cursors and selections.
- Works with structured app state, not only rich-text editors.

Cons:

- Adds CRDT concepts and dependencies.
- Requires mapping current JSON page state into shared Yjs types.
- Requires a Node/server runtime decision.

Decision: recommended.

## Product Requirements

### MVP Access Model

- Any user who can open `/p/[pageId]` can join and edit that page.
- The server validates WebSocket origin when configured, enforces payload limits, and persists room state.
- The app does not require accounts, login, signed page sessions, or share-token authorization yet.
- Share links may remain in the UI as convenience links, but they are not security boundaries in the MVP.
- Future access control should add edit/view links, signed short-lived sessions, and server-enforced read-only connections.

### Presence

- Show the local user in the presence row with initials, color, and tooltip.
- Show remote users only while connected and fresh.
- Remote cursor appears on the canvas with a short name label.
- Remote selected Area appears as a subtle colored ring with the user's name.
- Presence must not block pointer events on the canvas or Areas.
- Users can edit their display name in Settings.
- User name, color, and client id persist locally.
- Presence colors must be stable per client and readable against the page.

### Editing

- Users can create, edit, move, resize, duplicate, delete, nest, style, and upload image Areas.
- Text edits inside the same Area merge without lost updates.
- Style edits merge per CSS property when different users edit different properties.
- Moving/resizing uses last committed position/size, with optimistic local feedback.
- Deleting a parent Area deletes its descendants.
- Image uploads use HTTP upload and asset metadata sync, not base64 WebSocket messages.

### Connection UX

- Connection states: `Connecting`, `Connected`, `Reconnecting`, `Offline`, and `Sync error`.
- Reconnecting should keep the editor usable for edit users when possible.
- Remote presence fades or disappears when stale.
- The app must not show scary full-screen errors for routine reconnects.
- If the server rejects a connection, show a concise non-editable state.

### Future Access Control UX

- Share dialog still exposes `Can edit` and `Can view` links.
- View-only mode should feel clean, not like a disabled edit interface.
- Presence should be visible to view-only users unless a future setting disables it.
- Regenerating a share link invalidates old sessions for that link mode on reconnect.

## Architecture

```
Browser client
  Next.js page route /p/[pageId]
  React editor client component
  useCollaborativePage()
  HocuspocusProvider + Y.Doc + Awareness
      |
      | wss://host/collaboration?pageId=...
      v
Custom Node server
  Next request handler
  Hocuspocus WebSocket handler
  Origin checks and room context
  Yjs binary persistence
  Asset upload/download routes
      |
      v
SQLite + asset files
  pages
  share_links
  y_documents
  assets
```

### Next.js App Shell

Use the App Router.

Routes:

- `/` redirects to a new or last-opened page.
- `/p/[pageId]` renders the editor.
- `/collaboration` is the WebSocket endpoint handled by the custom server/Hocuspocus adapter.

Future access-control and asset routes:

- `/p/[pageId]?share=edit&token=...` validates the share link and establishes an edit session.
- `/p/[pageId]?share=view&token=...` validates the share link and establishes a view session.
- `/api/pages` creates a page.
- `/api/pages/[pageId]/shares` creates/regenerates share links.
- `/api/pages/[pageId]/assets` uploads image files.
- `/api/pages/[pageId]/assets/[assetId]` serves image assets after authorization.
- `/api/page-session` resolves a share token into a signed, short-lived page session.

Client component boundary:

- Keep the editor UI as a client component.
- Move browser-only APIs behind hooks so server rendering does not touch `window`, `document`, `localStorage`, `crypto`, or `BroadcastChannel`.
- Keep pure helpers in `src/*` modules and import them from both tests and client code.

### Custom Server

Use a custom Node server because WebSocket upgrade handling is the requirement that Next's integrated router does not satisfy cleanly.

Responsibilities:

- Start Next's request handler.
- Mount Hocuspocus on the HTTP server's `upgrade` event.
- Reject WebSocket upgrades that are not for `/collaboration`.
- Validate origin.
- Resolve `pageId` from the Yjs document name.
- Configure Hocuspocus context with anonymous editable page-room metadata.
- Enforce max payload and rate limits.
- Persist Yjs documents as binary state.

Preferred dependency set:

- `next`
- `@hocuspocus/server`
- `@hocuspocus/provider`
- `@hocuspocus/provider-react` if useful
- `@hocuspocus/extension-sqlite`
- `better-sqlite3`
- `yjs`
- `crossws` if mounting Hocuspocus manually on the same server

### WebSocket Runtime Choice

First pass:

- Run one Node process with the custom Next server and Hocuspocus.
- Persist state in SQLite so server restarts recover pages.
- Keep one deployment unit.

Future scalable pass:

- Replace SQLite with Postgres/S3-compatible document storage.
- Add Redis pub/sub for multi-instance room coordination.
- Add sticky routing or provider-specific room affinity if needed.
- Consider Vercel WebSocket beta only after persistent room state and reconnect behavior are tested outside memory.

## Data Model

### Server Tables

`pages`

```ts
type PageRecord = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
```

`share_links`

```ts
type ShareLinkRecord = {
  id: string
  pageId: string
  mode: 'edit' | 'view'
  tokenHash: string
  createdAt: string
  updatedAt: string
  revokedAt: string | null
}
```

`y_documents`

```ts
type YDocumentRecord = {
  name: string // page:${pageId}
  data: Uint8Array
  updatedAt: string
}
```

`assets`

```ts
type AssetRecord = {
  id: string
  pageId: string
  kind: 'image'
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  width: number
  height: number
  storageKey: string
  createdAt: string
}
```

Raw share tokens must never be stored. Store only hashes.

### Yjs Document Shape

Document name:

```ts
const documentName = `page:${pageId}`
```

Shared roots:

```ts
type CollaborativePageDoc = {
  page: Y.Map<unknown>
  areas: Y.Map<Y.Map<unknown>>
  assets: Y.Map<Y.Map<unknown>>
}
```

`page` map:

```ts
{
  id: string
  title: string
  createdAt: string
  updatedAt: string
  settings: Y.Map<unknown>
}
```

`settings` map:

```ts
{
  background: string
  snapGrid: Y.Map<unknown>
  theme: Y.Map<unknown>
}
```

`areas` map entries:

```ts
type CollaborativeArea = {
  id: string
  type: 'text' | 'image'
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
  styles: Y.Map<string>
  createdAt: string
  updatedAt: string

  // text only
  text?: Y.Text

  // image only
  assetId?: string
  alt?: string
}
```

`assets` map entries:

```ts
type CollaborativeAsset = {
  id: string
  kind: 'image'
  mimeType: string
  width: number
  height: number
  storageKey: string
  createdAt: string
}
```

### Why Yjs Binary Is Source of Truth

The server should persist the Yjs binary update/state as the collaborative source of truth. JSON export remains a derived portability format. Do not rebuild a Yjs document from JSON every time a user connects; that can create duplicate content and break CRDT history. JSON import should be a deliberate conversion transaction into a fresh or explicitly replaced Yjs document.

## Awareness Model

Use Hocuspocus/Yjs awareness for transient user state.

```ts
type AwarenessState = {
  clientId: string
  userName: string
  color: string
  accessMode: 'edit' | 'view'
  cursor: { x: number; y: number } | null
  selectedAreaId: string | null
  viewport: {
    x: number
    y: number
    width: number
    height: number
    zoom: number
  } | null
}
```

Rules:

- Throttle cursor updates to animation-frame cadence or about 30 updates per second maximum.
- Send cursor coordinates in page/canvas coordinates, not viewport coordinates.
- Clear cursor on blur or when the pointer leaves the canvas.
- Clear selection if the selected Area is deleted.
- Do not persist awareness in the page document.

## Client State and Mutations

Add a `useCollaborativePage(pageId, accessMode)` hook.

Returns:

```ts
type CollaborativePageHook = {
  page: PageState
  areas: AreaState[]
  assets: AssetState[]
  remotePresences: PresenceState[]
  connectionStatus:
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'offline'
    | 'view-only'
    | 'error'
  canEdit: boolean
  createArea(input: CreateAreaInput): string | null
  updateArea(id: string, patch: AreaPatch): void
  updateAreaText(id: string, nextText: string): void
  deleteArea(id: string): void
  updatePageSettings(patch: PageSettingsPatch): void
  uploadImage(file: File): Promise<AssetState>
  setPresence(presence: Partial<AwarenessState>): void
}
```

Mutation rules:

- If `canEdit` is false, mutation methods no-op and optionally show a small read-only hint.
- Area position/size/style changes update Yjs shared maps in a transaction.
- Text changes update the Area's `Y.Text`, not a plain string field.
- CSS slash command commits update the `styles` Y.Map per property.
- Image upload first uploads binary via HTTP, then inserts/updates asset metadata in Yjs.
- Local UI state such as selected Area, command palette, dialogs, drag state, and temporary slash-command highlights remains local React state.

### Textarea Binding

The editor currently uses native textareas. Keep that model for now.

Implementation expectation:

- Convert each Area `Y.Text` to a string for rendering.
- On textarea change, compute the minimal diff between previous and next text and apply `delete`/`insert` to `Y.Text` in a Yjs transaction.
- Preserve caret position locally.
- Avoid replacing the entire `Y.Text` on every keystroke unless tests prove remote cursor/caret behavior remains acceptable.

## Future Authorization and Sessions

Authentication, signed page sessions, and edit/view permission enforcement are not required for the current MVP. Add this section when page URLs should become permissioned rather than openly editable.

### Share Link Validation

Existing URLs can keep the visible shape:

```txt
/p/page_abc?share=edit&token=raw-token
/p/page_abc?share=view&token=raw-token
```

On first load:

1. Next server validates `pageId`, `share`, and `token`.
2. Server hashes the raw token and compares it to `share_links.tokenHash`.
3. If valid, server issues a signed, short-lived, HTTP-only page session cookie.
4. Client connects the WebSocket without putting the permanent raw token in the WebSocket URL.
5. WebSocket authentication reads the session cookie and resolves access mode.

Session cookie:

```ts
type PageSession = {
  pageId: string
  accessMode: 'edit' | 'view'
  clientId: string
  expiresAt: number
}
```

Cookie requirements:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- short lifetime, for example 12 hours
- signed with a server secret

### WebSocket Authorization

Hocuspocus `onAuthenticate` should:

- validate the page session,
- validate page existence,
- validate share link is not revoked,
- set contextual data for hooks,
- set `connection.readOnly = true` for view sessions.

If auth fails, reject the connection.

### Revocation

- Regenerating a share link marks the old token hash revoked.
- New connections using the old link are rejected.
- Existing connections should be rechecked periodically or on server-side share update. If immediate revocation is too much for the first pass, the UI must state that revocation applies on reconnect and the implementation plan should include active-session invalidation as a follow-up.

## Security Requirements

- Use `wss://` in production.
- Validate WebSocket `Origin` against allowed app origins.
- Do not log raw share tokens, session cookies, Yjs updates, page text, or image content.
- Set WebSocket max payload; reject oversized messages.
- Rate-limit connection upgrades per IP and per page.
- Rate-limit stateless/app messages if added later.
- Throttle cursor/presence updates on the client.
- Use heartbeat/ping-pong or provider equivalent for dead connection cleanup.
- Handle idle connection timeout.
- Validate uploaded image MIME, extension, dimensions, and size server-side.
- Serve assets through authorized routes once asset authorization exists.
- For future share tokens, add `Referrer-Policy` to reduce token leakage from page URLs.
- For future authorization, fail closed: invalid token, revoked link, unknown page, or malformed session should yield view-denied UI, not edit access.

## Persistence and Recovery

### Page Creation

When a page is created:

1. Insert a `pages` row.
2. Create edit and view share link records with hashed tokens.
3. Create an initial Yjs document with default page settings.
4. Store the Yjs binary state.
5. Return the edit URL.

### Saving

Use Hocuspocus persistence:

- First pass: `@hocuspocus/extension-sqlite` with an on-disk database file.
- Store Yjs documents as binary.
- Keep derived JSON export on demand, not as the live canonical store.
- Debounced persistence is acceptable, but server shutdown should flush active documents if the library exposes a safe hook.

### Import/Export

- Export JSON from the current Yjs document by converting shared maps/text into the existing `PageJsonSnapshot` shape.
- Import JSON as an explicit transaction.
- Import into an existing collaborative page should replace current content only after user confirmation in the implementation UI.
- Imported Areas/assets get stable IDs from the file unless there are collisions, in which case generate new IDs and preserve parent relationships.

### Offline and Reconnect

- If a client loses the WebSocket connection, show `Reconnecting`.
- Local edits may continue through Yjs local state for edit sessions.
- When the connection resumes, Yjs should sync pending updates.
- If access was revoked while offline, the server should reject the reconnect; the client must stop accepting edits and show a clear message.

## Conflict Rules

- Text: Yjs CRDT merge.
- Styles: property-level shared map updates. Simultaneous changes to different CSS properties merge. Simultaneous changes to the same CSS property resolve by Yjs map semantics.
- Position/size: latest accepted numeric value wins.
- Parent/child nesting: server/client shared transaction must prevent cycles. If two users reparent the same Area, the latest accepted parent wins, then cycle validation repairs to root if needed.
- Delete: deleting an Area removes its descendants in one transaction.
- Image asset metadata: create-once by asset id. Updating alt text is a normal Area update.
- Page settings: map/object field-level merge. Theme colors should be keyed by token id.

## Undo Rules

Do not implement global multiplayer undo in the first pass.

First pass:

- Keep existing local delete undo toast if it can be made safe as a local Yjs transaction.
- Text undo can use the browser textarea behavior while focused.
- Do not let undo overwrite another user's newer edits.

Future:

- Add Yjs `UndoManager` scoped to local origins for text and object edits.
- Track local client origin for each transaction.
- Test undo when another user edits the same Area after the local user's edit.

## UI Requirements

Presence row:

- Keep compact presence in the top-right/top chrome.
- Local avatar first, remote avatars after.
- Avatar tooltip includes display name and access mode.
- Use text initials and color ring.

Remote cursor:

- Small pointer shape with label.
- Hide label at high density if it overlaps too much, but keep tooltip/avatar identity.
- `pointer-events: none`.

Remote selection:

- Colored 2px ring outside the Area bounds.
- Label placed above the ring when there is room.
- Use absolute page coordinates, including nested Area offsets.
- `pointer-events: none`.

Connection status:

- Display near presence row.
- Use calm text, not destructive colors for routine reconnecting.
- Show error only for auth failure or persistent sync failure.

Settings:

- Display name input.
- Color swatch/color input for local presence color.
- Optional future toggle: `Show my cursor to others`.

View-only:

- Hide editing toolbar actions.
- Keep command palette options that are safe: Help, Settings, Page styles in read mode, Share only if link allows it.
- Disable slash commands and text editing.

## Migration Requirements

### File and Runtime Migration

- Replace Vite scripts with Next/custom server scripts.
- Preserve TypeScript strictness and existing tests.
- Move `src/main.tsx` entry into a Next client page.
- Add `app/layout.tsx`, `app/page.tsx`, and `app/p/[pageId]/page.tsx`.
- Keep editor components in `src/components`.
- Split `src/App.tsx` if needed, but avoid broad redesign.
- Remove Vite-only files only after Next build/test passes.

Expected scripts:

```json
{
  "dev": "tsx server.ts",
  "build": "next build && tsc -p tsconfig.server.json",
  "start": "NODE_ENV=production node dist/server.js",
  "lint": "next lint or eslint .",
  "test": "node --test src/*.test.ts"
}
```

Exact build script may change during implementation, but it must start one process that serves both Next and WebSockets.

### Local Data Migration

On first server-backed run:

- If local browser storage contains an unsaved page, offer an import path or automatic local-only import.
- Do not silently upload local data without a clear user action.
- Existing JSON import/export remains the safety valve.

## Testing Requirements

### Unit Tests

- Yjs conversion from empty/default page state.
- Yjs conversion from existing `PageJsonSnapshot`.
- Yjs to JSON export round trip.
- Area create/update/delete/nest transactions.
- Text diff application to `Y.Text`.
- Style property merge.
- Delete parent removes descendants.
- Anonymous collaboration context resolves page documents.
- WebSocket origin validation rejects disallowed origins.
- Asset validation.

### Server Tests

- WebSocket rejects invalid origin.
- WebSocket rejects malformed document names.
- Anonymous page-room clients can mutate document.
- Oversized WebSocket message is rejected.
- Hocuspocus persistence reloads document after server restart.

### Future Access Control Tests

- View access prevents mutation methods.
- Share token hashing and validation.
- Session signing and expiration.
- WebSocket rejects invalid token/session.
- View-only session connects but is read-only.
- Revoked link fails on reconnect.

### Integration Tests

Use Playwright with two browser contexts:

- Browser A creates page, Browser B opens the same page URL, both see same initial state.
- A types text while B types in the same Area; final text converges.
- A moves/resizes Area; B sees update.
- A applies slash-command style; B sees style.
- Remote cursors and selection rings show and disappear when a user leaves.
- Server restart preserves page content.

Future access-control integration tests:

- B is view-only; B sees updates but cannot type, move, resize, or style.
- Link regeneration invalidates old link.

### Manual Smoke

- Run dev server.
- Open two browsers, not just two tabs.
- Open the same `/p/[pageId]` URL in both browsers.
- Confirm cross-machine access on the same network if firewall allows.
- Confirm production build starts server and WebSocket endpoint.

## Acceptance Criteria

- App runs as a Next.js app, not Vite.
- A server process is required for normal development and serves both the app and WebSocket collaboration.
- Two separate browser sessions on the same page can edit text, styles, positions, sizes, nesting, images, and settings.
- Two separate machines can collaborate when pointed at the same running server.
- Remote cursors update smoothly without blocking local typing.
- Remote selections identify who is working where.
- User names and colors persist across reloads.
- Reconnect restores document state and presence.
- Server restart preserves page content through durable persistence.
- WebSocket origin validation rejects disallowed origins when configured.
- Tests cover collaboration state, anonymous page-room access, persistence, and two-client behavior.

## Non-Goals for First Implementation

- Account system.
- Organization/workspace permissions.
- Authentication and edit/view share enforcement.
- Commenting.
- Version history UI.
- Production horizontal scaling.
- Immediate active-session revocation after link regeneration.
- Global multiplayer undo.
- Rich text editing.
- Vercel beta WebSocket deployment.

## Open Questions

- Should the first server-backed implementation auto-create a new page on `/`, or should it keep one default local page until the user chooses Share?
- Should anonymous collaborators be allowed to rename themselves per page, or should the saved name apply globally across all pages?
- Future: should view-only users see all edit-user cursors by default, or should presence visibility become a page setting?
- Future: should link sessions expire after 12 hours, 7 days, or only when the share link is regenerated?
- Should server persistence use only Hocuspocus SQLite for the MVP, or should page/share metadata also use a small SQLite repository in the same database from day one?

## Implementation Notes

- Start with the migration and server skeleton before touching collaboration behavior.
- Preserve the current pure helpers where possible; they are useful for tests and conversion.
- Keep the existing `BroadcastChannel` tests only as legacy tests until replaced by WebSocket/Yjs tests.
- Avoid putting permanent share tokens in WebSocket query strings. Browser WebSockets cannot send arbitrary headers, so use HTTP session establishment plus cookies or a short-lived ticket.
- Keep high-frequency presence updates out of the persisted Yjs document.
- Use the existing JSON schema as the external import/export contract, not as the live collaborative storage format.
