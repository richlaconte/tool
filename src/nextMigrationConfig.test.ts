import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

type PackageJson = {
  engines?: Record<string, string>
  packageManager?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const readPackageJson = async () =>
  JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  ) as PackageJson

test('package scripts run the Next custom server stack', async () => {
  const pkg = await readPackageJson()

  assert.equal(pkg.scripts?.dev, 'tsx server.ts')
  assert.match(pkg.scripts?.build ?? '', /next build/)
  assert.equal(pkg.scripts?.start, 'NODE_ENV=production node dist/server.js')
})

test('package includes Next and collaboration runtime dependencies', async () => {
  const pkg = await readPackageJson()

  assert.ok(pkg.dependencies?.next)
  assert.ok(pkg.dependencies?.yjs)
  assert.ok(pkg.dependencies?.['@hocuspocus/server'])
  assert.ok(pkg.dependencies?.['@hocuspocus/provider'])
  assert.ok(pkg.dependencies?.['@hocuspocus/extension-sqlite'])
  assert.ok(pkg.dependencies?.['better-sqlite3'])
  assert.ok(pkg.devDependencies?.tsx)
})

test('project pins the Node LTS runtime for native dependencies', async () => {
  const pkg = await readPackageJson()
  const nvmrc = await readFile(
    new URL('../.nvmrc', import.meta.url),
    'utf8'
  )

  assert.equal(nvmrc.trim(), 'v24.18.0')
  assert.equal(pkg.engines?.node, '>=24.11.0 <25')
})

test('project pins the package manager used by Docker and CI', async () => {
  const pkg = await readPackageJson()

  assert.equal(pkg.packageManager, 'pnpm@9.15.0')
  assert.equal(pkg.scripts?.test, 'node --test src/*.test.ts')
})
