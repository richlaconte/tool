# Next WebSocket Collaboration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the editor from Vite-only local collaboration to a Next.js app served by a custom Node/Hocuspocus WebSocket server with SQLite-backed page persistence and anonymous editable page rooms.

**Architecture:** Keep the existing React editor UI and pure helpers, move the app shell to Next.js, and run Next plus Hocuspocus in a single Node process. Use Yjs shared types for page/area/asset state and Hocuspocus awareness for cursors/selections. Authentication, signed sessions, and edit/view enforcement are future work; the MVP treats every `/p/[pageId]` URL as editable.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Yjs, Hocuspocus, SQLite via `better-sqlite3`, Node custom server, Node test runner, Playwright smoke tests.

---

## Chunk 1: Next App Shell and Custom Server

### Task 1: Dependency and Script Migration

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.app.json`
- Create: `tsconfig.server.json`
- Create: `next.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Write the failing config test**

Create `src/nextMigrationConfig.test.ts` that reads `package.json` and asserts:

```ts
assert.equal(pkg.scripts.dev, 'tsx server.ts')
assert.match(pkg.scripts.build, /next build/)
assert.ok(pkg.dependencies.next)
assert.ok(pkg.dependencies.yjs)
assert.ok(pkg.dependencies['@hocuspocus/server'])
```

- [ ] **Step 2: Run the config test and verify it fails**

Run: `PATH="/Users/richardlaconte/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --test src/nextMigrationConfig.test.ts`

Expected: fail because scripts/dependencies are still Vite-only.

- [ ] **Step 3: Install dependencies and update scripts**

Install:

```bash
pnpm add next yjs @hocuspocus/server @hocuspocus/provider @hocuspocus/extension-sqlite better-sqlite3 cookie
pnpm add -D tsx @types/better-sqlite3
```

Update scripts to:

```json
{
  "dev": "tsx server.ts",
  "build": "next build && tsc -p tsconfig.server.json",
  "start": "NODE_ENV=production node dist/server.js",
  "lint": "eslint .",
  "preview": "next start"
}
```

- [ ] **Step 4: Run the config test and verify it passes**

Run: same `node --test src/nextMigrationConfig.test.ts`.

### Task 2: Next Routes and Custom Server Skeleton

**Files:**
- Create: `server.ts`
- Create: `src/server/collaborationServer.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/p/[pageId]/page.tsx`
- Create: `app/globals.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx` or remove after replacement

- [ ] **Step 1: Write failing source tests**

Create `src/nextServerShape.test.ts` asserting:

```ts
assert.match(await fs.readFile('server.ts', 'utf8'), /next\(/)
assert.match(await fs.readFile('server.ts', 'utf8'), /upgrade/)
assert.match(await fs.readFile('app/p/[pageId]/page.tsx', 'utf8'), /EditorApp/)
```

- [ ] **Step 2: Verify source tests fail**

Run: `node --test src/nextServerShape.test.ts`.

- [ ] **Step 3: Implement server and pages**

Create a custom HTTP server that:

- prepares Next,
- delegates normal requests to Next,
- delegates `/collaboration` upgrades to `createCollaborationServer()`,
- listens on `PORT || 3000`.

Create a client editor wrapper so the existing app renders at `/p/[pageId]`.

- [ ] **Step 4: Verify tests and build**

Run:

```bash
node --test src/nextServerShape.test.ts
pnpm build
```

Expected: test passes and build succeeds.

## Chunk 2: Server Persistence and Anonymous Page Creation

### Task 3: SQLite Repository

**Files:**
- Create: `src/server/database.ts`
- Create: `src/server/pageRepository.ts`
- Test: `src/serverPersistence.test.ts`

- [ ] **Step 1: Write failing repository tests**

Cover:

- creating a page stores metadata,
- optional share-link helpers store only token hashes if they remain in the codebase,
- anonymous page creation does not require session cookies.

- [ ] **Step 2: Verify tests fail**

Run: `node --test src/serverPersistence.test.ts`.

- [ ] **Step 3: Implement minimal repository code**

Use `better-sqlite3` for page metadata. Keep any share/session helpers out of the live request and WebSocket path until access control becomes a product requirement.

- [ ] **Step 4: Verify repository tests pass**

Run: `node --test src/serverPersistence.test.ts`.

### Task 4: HTTP Routes for Pages and Assets

**Files:**
- Create: `app/api/pages/route.ts`
- Create: `app/api/pages/[pageId]/assets/route.ts`
- Create: `app/api/pages/[pageId]/assets/[assetId]/route.ts`
- Test: `src/serverRoutes.test.ts`

Future access-control files:
- Create: `app/api/pages/[pageId]/shares/route.ts`
- Create: `app/api/page-session/route.ts`

- [ ] **Step 1: Write failing route tests for pure handlers**

Extract handler logic into testable functions if Next route handlers are awkward under `node --test`.

- [ ] **Step 2: Implement routes**

Routes should create pages, upload image assets, and serve assets. Share-link regeneration and short-lived page sessions are future work.

- [ ] **Step 3: Verify route tests pass**

Run: `node --test src/serverRoutes.test.ts`.

## Chunk 3: Yjs Document Model and Hocuspocus

### Task 5: Yjs Page Conversion

**Files:**
- Create: `src/collaborativePage.ts`
- Test: `src/collaborativePage.test.ts`

- [ ] **Step 1: Write failing Yjs conversion tests**

Cover:

- default page to Yjs document,
- JSON snapshot to Yjs document,
- Yjs document back to JSON-compatible state,
- text Area uses `Y.Text`,
- styles use a shared map,
- deleting a parent deletes descendants.

- [ ] **Step 2: Verify tests fail**

Run: `node --test src/collaborativePage.test.ts`.

- [ ] **Step 3: Implement conversion and mutation helpers**

Add helpers for page settings, areas, assets, text diff application, and transaction origins.

- [ ] **Step 4: Verify tests pass**

Run: `node --test src/collaborativePage.test.ts`.

### Task 6: Hocuspocus Server Wiring

**Files:**
- Modify: `src/server/collaborationServer.ts`
- Test: `src/collaborationServer.test.ts`

- [ ] **Step 1: Write failing anonymous room tests**

Cover:

- invalid origin rejected,
- malformed document name rejected,
- anonymous connection receives page context.

- [ ] **Step 2: Implement Hocuspocus configuration**

Configure `onAuthenticate` for origin checks and page-room context, plus SQLite document persistence and upgrade handling. Read-only mode is future access-control work.

- [ ] **Step 3: Verify server tests pass**

Run: `node --test src/collaborationServer.test.ts`.

## Chunk 4: Editor Client Collaboration

### Task 7: `useCollaborativePage` Hook

**Files:**
- Create: `src/useCollaborativePage.ts`
- Modify: `src/App.tsx`
- Remove or legacy-gate: `BroadcastChannel` flow in `src/App.tsx`
- Test: `src/useCollaborativePage.test.ts`

- [ ] **Step 1: Write failing hook/source tests**

Cover:

- hook creates Hocuspocus provider,
- exposes connection status,
- blocks mutations in view mode,
- maps awareness to remote presence,
- updates Yjs maps for area/style/settings changes.

- [ ] **Step 2: Implement the hook**

Keep UI local state in React; keep collaborative document state in Yjs.

- [ ] **Step 3: Wire App to the hook**

Replace direct `useState` source-of-truth for page/areas/assets with hook values and mutation methods.

- [ ] **Step 4: Verify tests pass**

Run: `node --test src/useCollaborativePage.test.ts src/*.test.ts`.

### Task 8: UI and View-Only Behavior

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/components/Area.tsx`
- Test: existing UI source tests plus new collaboration UI tests

- [ ] **Step 1: Write failing tests**

Cover:

- view-only hides editing toolbar actions,
- slash commands do not mutate in view-only mode,
- remote presence overlay is `pointer-events: none`,
- connection states render.

- [ ] **Step 2: Implement UI behavior**

Preserve existing design while changing the data source.

- [ ] **Step 3: Verify tests pass**

Run: `node --test src/*.test.ts`.

## Chunk 5: End-to-End Verification

### Task 9: Browser Smoke

**Files:**
- Optional Create: `tests/collaboration-smoke.mjs`

- [ ] **Step 1: Build**

Run:

```bash
pnpm build
```

- [ ] **Step 2: Start dev server**

Run:

```bash
pnpm dev
```

- [ ] **Step 3: Playwright two-context smoke**

Open two browser contexts against the same page:

- edit link can type and move an Area,
- second browser context opens the same page URL without shared cookies and sees the update,
- cursors/selections appear,
- server restart preserves page content.

- [ ] **Step 4: Final verification**

Run:

```bash
node --test src/*.test.ts
pnpm build
pnpm lint
```

Expected: all pass.
