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
