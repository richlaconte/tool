# Deployment

This app is configured for Fly.io because it runs a custom Node server for
Next.js, WebSocket collaboration, and SQLite-backed local state.

## First-Time Fly Setup

Install and sign in to Fly:

```sh
brew install flyctl
fly auth login
```

Create the app and its persistent data volume:

```sh
fly apps create richlaconte-tool
fly volumes create tool_data --app richlaconte-tool --region iad --size 1
```

Set the page-session signing secret. This signs edit/view share sessions after
the raw share token has been exchanged, so use a long random value and keep it
stable across deploys:

```sh
fly secrets set TOOL_PAGE_SESSION_SECRET="$(openssl rand -base64 48)"
```

Set the production origins and review the security defaults.
`TOOL_ALLOWED_ORIGINS` should include every domain people will use to open the
app. The remaining values have secure defaults, but keeping them explicit makes
future tuning less mysterious:

```sh
fly secrets set \
  TOOL_ALLOWED_ORIGINS="https://cascadery.com,https://www.cascadery.com,https://richlaconte-tool.fly.dev" \
  TOOL_SECURITY_LOGS="true" \
  TOOL_COLLABORATION_MAX_PAYLOAD_BYTES="1048576" \
  TOOL_COLLABORATION_MAX_CONNECTIONS_PER_PAGE="50" \
  TOOL_COLLABORATION_MAX_CONNECTIONS_PER_CLIENT="8" \
  TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_MAX="240" \
  TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_WINDOW_MS="60000" \
  TOOL_MCP_RATE_LIMIT_MAX="60" \
  TOOL_MCP_RATE_LIMIT_WINDOW_MS="60000"
```

If enabling GLM-backed AI suggestions, set the provider secret separately:

```sh
fly secrets set GLM_API_KEY="..."
```

If enabling `/gif` search, create a GIPHY API key and set it as a runtime
secret. The key is passed to the browser as a public GIPHY integration key so
the client can call GIPHY directly:

```sh
fly secrets set GIPHY_API_KEY="..."
```

## Enabling the MCP Endpoint

The MCP endpoint (`/api/mcp`) ships disabled. Turn it on with an environment
flag and redeploy:

```sh
fly secrets set TOOL_MCP_ENABLED=true
fly deploy --ha=false
```

Scoped rate limits (`TOOL_MCP_READ_RATE_LIMIT_MAX`,
`TOOL_MCP_SUGGEST_RATE_LIMIT_MAX`, `TOOL_MCP_WRITE_RATE_LIMIT_MAX`, each with a
matching `_WINDOW_MS`) fall back to `TOOL_MCP_RATE_LIMIT_MAX` and have secure
defaults; set them only when tuning.

The endpoint is gated in three independent layers, and all three must be
satisfied before an agent can touch a page:

1. **Environment gate** — `TOOL_MCP_ENABLED=true` (above).
2. **Per-page gate** — each page defaults to `settings.mcp.enabled: false`.
   Open the page in the app and enable MCP in the page settings; there is no
   REST endpoint for this toggle.
3. **Token gate** — agents authenticate with a page-scoped bearer token minted
   from the page's MCP connections UI (or
   `POST /api/pages/{pageId}/mcp-tokens` with an edit session). Tokens carry
   explicit scopes (`page:read`, `page:search`, `page:suggest`, `page:write`)
   and can be revoked from the same UI.

Once enabled, connect MCP clients to
`https://cascadery.com/api/mcp` (or the fly.dev URL) with
`Authorization: Bearer <token>`. Discovery metadata lives at
`/api/mcp/.well-known`; it derives the public origin from the proxy's
forwarded headers, so it stays correct behind the Fly proxy.

Deploy once from your machine:

```sh
fly deploy --ha=false
```

Create a deploy token and add it to GitHub as the repository secret
`FLY_API_TOKEN`:

```sh
fly tokens create deploy -x 999999h
```

After that, pushes to `main` run tests, linting, a production build, and then
deploy the app.

## Notes

- The production URLs are `https://cascadery.com` and
  `https://richlaconte-tool.fly.dev`.
- If you rename the Fly app, update `app` and `TOOL_ALLOWED_ORIGINS` in
  `fly.toml`.
- The deployment intentionally runs one always-on machine because SQLite files
  live on the attached Fly Volume at `/data`.
- Security logs are structured JSON written to standard output. They include
  reason codes and redacted client ids, but not page text, cookies, share
  tokens, image bytes, or Yjs update payloads.
- MCP is environment-gated, per-page gated, scope-limited bearer-token
  authorized, and rate-limited; keep every layer on. Do not mint tokens with
  `page:write` for untrusted agents, and revoke tokens from the page's MCP
  connections UI when an integration is no longer needed. See
  [Enabling the MCP Endpoint](#enabling-the-mcp-endpoint).
