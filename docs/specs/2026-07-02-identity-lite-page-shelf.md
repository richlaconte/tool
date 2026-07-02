# Identity-Lite and the Page Shelf

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 3.1). Active.
Pairs with Remote MCP Hardening (Tier 2.3): owner-scoped MCP token management
assumes ownership exists.

## Goal

Optional sign-in (GitHub OAuth), page ownership, and a home "shelf" listing
your pages — so users stop losing pages, owners can revoke access and delete
pages, and teams can adopt the tool. Anonymous zero-friction page creation is
preserved: auth is for *keeping* pages, not creating them.

## Research Basis

- Direction audit "Avoid" list: no workspace/account complexity before share
  enforcement and history are strong — both shipped, so minimal identity is
  now in sequence (docs/specs/2026-06-29-cascadery-product-direction-audit.md).
- The audience is developers; GitHub OAuth has near-total coverage and avoids
  building email infrastructure:
  https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- OWASP session management (cookie flags, session fixation, CSRF on the
  callback via `state`):
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

## Current State

- No accounts exist. Access = possession of a share token; visiting `/` (see
  `app/route.ts`) creates a fresh page + share links and redirects to
  `/p/<pageId>?share=edit&token=…`. The token exchange sets an HMAC-signed
  page-session cookie `tool.pageSession`
  (`src/server/shareSessions.ts`, `src/server/pageAccess.ts`,
  `PAGE_SESSION_MAX_AGE_MS` = 30 days).
- Pages table exists via `src/server/pageRepository.ts` (`PageRecord`,
  `createPageWithShareLinks`, `regenerateShareToken`, `listPages`,
  `getPageRecord`); share tokens are stored hashed.
- SQLite via `createDatabase()` (`src/server/database.ts`); custom Next server
  `server.ts` routes page-access requests before Next handles the rest.
- The client keeps a local recent-page memory only implicitly (localStorage
  page state key `tool.page.v1`) — there is no page list UI anywhere.

## Scope

### Auth (GitHub OAuth)

- New tables (migrations in `database.ts`): `users` (`id`, `github_id`
  unique, `login`, `display_name`, `avatar_url`, `created_at`) and
  `auth_sessions` (`id`, `user_id`, `token_hash`, `created_at`,
  `expires_at`). Auth session cookie `tool.authSession` is separate from the
  per-page session cookie — do not merge them; page access via share links
  must keep working with zero auth.
- New server module `src/server/auth.ts`: OAuth URL construction with random
  `state` (stored in a short-lived cookie and verified on callback), code
  exchange, user upsert, session mint/validate/destroy (hash session tokens
  like share tokens), `getUserFromRequest(request): User | null`.
- Routes: `app/api/auth/login/route.ts` (redirect to GitHub),
  `app/api/auth/callback/route.ts` (state check, exchange, set cookie,
  redirect to shelf), `app/api/auth/logout/route.ts` (destroy session).
  Request no GitHub scopes beyond the default public profile — id, login,
  and avatar come from the authenticated user endpoint.
- Env: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, documented in
  `.env.example`. When unset, all auth UI hides and the app behaves exactly
  as today (auth is an optional deployment feature; tests must cover the
  disabled mode).
- Cookies: `HttpOnly`, `Secure` (behind the existing forwarded-proto
  awareness), `SameSite=Lax`, 30-day expiry with rotation on use.

### Ownership

- `pages` gains nullable `owner_user_id` and nullable `deleted_at`.
- New pages created while signed in are owned at creation (`app/route.ts`
  passes the user through `createPageWithShareLinks`).
- **Claim flow:** on a page with `owner_user_id IS NULL`, a signed-in visitor
  holding an *edit* session sees "Claim this page" (status-bar/share dialog);
  claiming sets ownership. First writer wins; the endpoint must be atomic
  (`UPDATE … WHERE owner_user_id IS NULL`).
- Owner-only operations (server-enforced in the respective routes, not just
  hidden in UI): regenerate/revoke share links (`regenerateShareToken`
  exists; add revoke = disable without replacement), delete page (soft
  delete: set `deleted_at`, refuse new sessions/websockets, purge after 30
  days via a startup sweep), manage MCP tokens (Tier 2.3 panel becomes
  owner-only when the page has an owner; unowned pages keep edit-session
  gating for continuity).
- Unowned pages behave exactly as today — ownership only adds capability.

### Page shelf

- Route `app/shelf/page.tsx` (signed-in only; signed-out visitors get a brief
  explainer + sign-in button): lists owned pages — title, updated timestamp
  (from `PageRecord`), open link — newest first, with delete (confirmation
  naming the page title) and "New page" (same creation path as `/`).
- `/` behavior change: signed-in users landing on `/` go to the shelf;
  signed-out users keep today's instant-page-creation redirect. This
  preserves the zero-friction demo path while giving members a home.
- Header affordance on the editor: avatar menu (shelf, sign out) when signed
  in; a quiet "Sign in" entry in the command palette and share dialog when
  auth is configured.

## Non-Goals

- Workspaces, organizations, roles, member management, billing.
- Email/password or magic-link auth (GitHub only in v1).
- Transferring ownership, multi-owner pages.
- Collaborator identity in presence (presence keeps profile names; wiring
  auth identity into presence/comments is a follow-up).
- Cross-device sync of anything beyond what ownership itself provides.

## Acceptance Criteria

- With env unset: no auth UI anywhere; every current flow works unchanged.
- Sign in via GitHub round-trips with `state` verification; sessions are
  HttpOnly cookies with hashed server storage; logout invalidates.
- Pages created signed-in appear on the shelf; an anonymous page can be
  claimed once by an edit-session holder and never re-claimed.
- A non-owner with an edit session cannot revoke links, delete the page, or
  manage MCP tokens (server returns 403; UI hides the controls).
- Revoking a view link makes existing view URLs stop resolving (verify how
  existing session cookies from that link interact with `pageAccess`
  validation and test it).
- Deleting a page blocks new HTTP sessions and websocket upgrades
  immediately; the shelf no longer lists it.
- Anonymous creation via `/` still works signed-out.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/server/auth.test.ts`: state mismatch rejection, code-exchange with
  injected fetch, session mint/validate/expiry/rotation, disabled-mode
  behavior.
- `src/server/pageRepository.test.ts`: extend for ownership columns, atomic
  claim, soft delete + sweep.
- Route-level tests following the existing `src/nextPageSessionRoute.test.ts`
  pattern for 403 enforcement on owner-only operations.

## Open Questions

- Should the shelf also list "recently visited" unowned pages from local
  history? Recommend: yes, as a purely client-side localStorage list — cheap
  and solves the lost-URL problem even for anonymous users.
- Purge window for soft-deleted pages (30 days suggested) and whether owners
  can restore within it — restore UI can be a follow-up; keep the data.
