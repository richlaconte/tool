import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('home route creates a server page and redirects without authentication', async () => {
  const source = await readFile(
    new URL('../app/route.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /createDatabase/)
  assert.match(source, /createPageWithShareLinks/)
  assert.match(source, /NextResponse\.redirect/)
  assert.match(source, /request\.headers\.get\('host'\)/)
  assert.doesNotMatch(source, /createPageSessionCookie/)
  assert.doesNotMatch(source, /randomUUID/)
  assert.doesNotMatch(source, /response\.cookies\.set/)
})
