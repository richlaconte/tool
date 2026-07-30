// Local collaboration smoke runner: boots the production build with an
// isolated database (mirroring the Playwright web-server setup), runs the
// environment-agnostic smoke script against it, and always tears the
// server down. Requires `pnpm build` first.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const serverEntry = path.join(root, 'dist', 'server.js')
const port = Number(process.env.SMOKE_LOCAL_PORT ?? 3399)
const baseUrl = `http://localhost:${port}`
const dataDir = path.join(root, 'e2e', '.smoke-data')

if (!existsSync(serverEntry)) {
  console.error('dist/server.js not found. Run `pnpm build` first.')
  process.exit(1)
}

// Wipe before boot, not after: the server opens its SQLite files at
// startup, so deleting them while it runs would orphan its connections.
rmSync(dataDir, { force: true, recursive: true })
mkdirSync(dataDir, { recursive: true })

const server = spawn(process.execPath, [serverEntry], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    TOOL_DATABASE_PATH: path.join(dataDir, 'tool.sqlite'),
    TOOL_YJS_DATABASE_PATH: path.join(dataDir, 'collaboration.sqlite'),
    TOOL_PAGE_SESSION_SECRET: 'smoke-only-session-secret-not-for-production',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})

server.stdout.on('data', (chunk) => process.stdout.write(chunk))

const stopServer = () => {
  if (!server.killed) server.kill('SIGINT')
}

process.on('SIGINT', () => {
  stopServer()
  process.exit(130)
})

const waitForHealth = async () => {
  const startedAt = Date.now()

  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // Not up yet.
    }

    if (Date.now() - startedAt > 60_000) {
      throw new Error('server did not become healthy within 60s')
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

try {
  await waitForHealth()

  const smoke = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      path.join(root, 'scripts', 'collaboration-smoke.ts'),
    ],
    {
      cwd: root,
      env: { ...process.env, SMOKE_BASE_URL: baseUrl },
      stdio: 'inherit',
    }
  )

  const exitCode = await new Promise((resolve) => {
    smoke.on('exit', (code) => resolve(code ?? 1))
  })

  process.exitCode = exitCode
} finally {
  stopServer()
}
