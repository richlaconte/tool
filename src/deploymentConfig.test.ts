import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Dockerfile builds and runs the custom Next collaboration server', async () => {
  const dockerfile = await readProjectFile('Dockerfile')

  assert.match(dockerfile, /FROM node:24\.18\.0-bookworm-slim AS base/)
  assert.match(dockerfile, /corepack enable/)
  assert.match(dockerfile, /pnpm install --frozen-lockfile/)
  assert.match(dockerfile, /pnpm build/)
  assert.match(dockerfile, /pnpm prune --prod/)
  assert.match(dockerfile, /TOOL_DATABASE_PATH="\/data\/tool\.sqlite"/)
  assert.match(
    dockerfile,
    /TOOL_YJS_DATABASE_PATH="\/data\/collaboration\.sqlite"/
  )
  assert.match(dockerfile, /CMD \["node", "dist\/server\.js"\]/)
})

test('Fly configuration keeps the collaborative SQLite app on one persistent machine', async () => {
  const flyConfig = await readProjectFile('fly.toml')

  assert.match(flyConfig, /app = "richlaconte-tool"/)
  assert.match(flyConfig, /primary_region = "iad"/)
  assert.match(flyConfig, /internal_port = 3000/)
  assert.match(flyConfig, /force_https = true/)
  assert.match(flyConfig, /auto_stop_machines = "off"/)
  assert.match(flyConfig, /min_machines_running = 1/)
  assert.match(flyConfig, /source = "tool_data"/)
  assert.match(flyConfig, /destination = "\/data"/)
  assert.match(flyConfig, /TOOL_DATABASE_PATH = "\/data\/tool\.sqlite"/)
  assert.match(
    flyConfig,
    /TOOL_YJS_DATABASE_PATH = "\/data\/collaboration\.sqlite"/
  )
  assert.match(
    flyConfig,
    /TOOL_ALLOWED_ORIGINS = "https:\/\/richlaconte-tool\.fly\.dev"/
  )
  assert.match(flyConfig, /path = "\/api\/health"/)
})

test('environment documentation includes the page session secret', async () => {
  const envExample = await readProjectFile('.env.example')
  const deploymentDocs = await readProjectFile('docs/deployment.md')

  assert.match(envExample, /TOOL_PAGE_SESSION_SECRET=/)
  assert.match(deploymentDocs, /TOOL_PAGE_SESSION_SECRET/)
  assert.match(deploymentDocs, /fly secrets set TOOL_PAGE_SESSION_SECRET=/)
})

test('GitHub Actions verifies and deploys pushes to main', async () => {
  const workflow = await readProjectFile('.github/workflows/deploy.yml')

  assert.match(workflow, /branches:\n\s+- main/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.ok(
    workflow.indexOf('pnpm/action-setup@v4') <
      workflow.indexOf('actions/setup-node@v4')
  )
  assert.match(workflow, /version: 9\.15\.0/)
  assert.match(workflow, /run_install: false/)
  assert.match(workflow, /node-version-file: \.nvmrc/)
  assert.match(workflow, /pnpm install --frozen-lockfile/)
  assert.match(workflow, /pnpm test/)
  assert.match(workflow, /pnpm lint/)
  assert.match(workflow, /pnpm build/)
  assert.match(workflow, /superfly\/flyctl-actions\/setup-flyctl@master/)
  assert.match(workflow, /flyctl deploy --remote-only --ha=false/)
  assert.match(workflow, /FLY_API_TOKEN: \$\{\{ secrets\.FLY_API_TOKEN \}\}/)
})

test('health route gives Fly a lightweight readiness endpoint', async () => {
  const route = await readProjectFile('app/api/health/route.ts')

  assert.match(route, /export const dynamic = 'force-dynamic'/)
  assert.match(route, /export const GET/)
  assert.match(route, /Response\.json/)
  assert.match(route, /ok: true/)
})
