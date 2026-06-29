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
  assert.match(source, /created\.editToken/)
  assert.match(source, /searchParams\.set\('share', 'edit'\)/)
  assert.match(source, /NextResponse\.redirect/)
  assert.match(source, /request\.headers\.get\('host'\)/)
  assert.doesNotMatch(source, /createPageSessionCookie/)
  assert.doesNotMatch(source, /randomUUID/)
  assert.doesNotMatch(source, /response\.cookies\.set/)
})

test('page route passes server access mode into the editor', async () => {
  const pageSource = await readFile(
    new URL('../app/p/[pageId]/page.tsx', import.meta.url),
    'utf8'
  )
  const editorSource = await readFile(
    new URL('../app/p/[pageId]/EditorPage.tsx', import.meta.url),
    'utf8'
  )

  assert.match(pageSource, /getPageAccessModeFromRequestCookies/)
  assert.match(pageSource, /initialAccessMode/)
  assert.match(editorSource, /initialAccessMode/)
  assert.match(editorSource, /<App pageId=\{pageId\} serverAccessMode=\{initialAccessMode\}/)
})

test('custom server enforces page share access before rendering pages', async () => {
  const source = await readFile(
    new URL('../server.ts', import.meta.url),
    'utf8'
  )
  const accessSource = await readFile(
    new URL('./server/pageAccess.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /handlePageAccessRequest/)
  assert.match(accessSource, /setHeader\('Referrer-Policy', 'no-referrer'\)/)
  assert.match(accessSource, /setHeader\('Set-Cookie'/)
})
