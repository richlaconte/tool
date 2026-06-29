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

Set the production origin and review the security defaults. `TOOL_ALLOWED_ORIGINS`
should match the deployed app URL exactly. The remaining values have secure
defaults, but keeping them explicit makes future tuning less mysterious:

```sh
fly secrets set \
  TOOL_ALLOWED_ORIGINS="https://richlaconte-tool.fly.dev" \
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

- The production URL is `https://richlaconte-tool.fly.dev`.
- If you rename the Fly app, update `app` and `TOOL_ALLOWED_ORIGINS` in
  `fly.toml`.
- The deployment intentionally runs one always-on machine because SQLite files
  live on the attached Fly Volume at `/data`.
- Security logs are structured JSON written to standard output. They include
  reason codes and redacted client ids, but not page text, cookies, share
  tokens, image bytes, or Yjs update payloads.
- MCP remains environment-gated, per-page gated, rate-limited, and no-auth; do
  not expose broader remote write access until protected authorization exists.
