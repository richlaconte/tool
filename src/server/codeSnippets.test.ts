import assert from 'node:assert/strict'
import test from 'node:test'

import { createInMemoryDatabase } from './database.ts'
import { resolveCodeSnippet } from './codeSnippets.ts'

const githubUrl =
  'https://github.com/cascadery/tool/blob/main/src/App.tsx#L3-L5'

test('resolves allowlisted code snippets with context lines and caching', async () => {
  const database = createInMemoryDatabase()
  let fetchCount = 0
  const fetchText = async () => {
    fetchCount += 1

    return [
      'line 1',
      'line 2',
      'const value = 3',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
    ].join('\n')
  }

  const first = await resolveCodeSnippet(database, githubUrl, {
    fetchText,
    now: '2026-07-04T12:00:00.000Z',
  })
  const second = await resolveCodeSnippet(database, githubUrl, {
    fetchText,
    now: '2026-07-04T12:05:00.000Z',
  })

  assert.deepEqual(first, {
    ok: true,
    snippet: {
      url: githubUrl,
      path: 'src/App.tsx',
      startLine: 1,
      requestedStartLine: 3,
      requestedEndLine: 5,
      language: 'tsx',
      fetchedAt: '2026-07-04T12:00:00.000Z',
      truncated: false,
      isImmutableRef: false,
      lines: [
        { number: 1, text: 'line 1' },
        { number: 2, text: 'line 2' },
        { number: 3, text: 'const value = 3' },
        { number: 4, text: 'line 4' },
        { number: 5, text: 'line 5' },
        { number: 6, text: 'line 6' },
        { number: 7, text: 'line 7' },
      ],
    },
    fromCache: false,
  })
  assert.equal(second.ok, true)
  assert.equal(second.fromCache, true)
  assert.equal(fetchCount, 1)
})

test('rejects non-code-reference URLs and caches failed fetches briefly', async () => {
  const database = createInMemoryDatabase()
  let fetchCount = 0

  assert.deepEqual(
    await resolveCodeSnippet(database, 'https://example.com/not-code#L1', {
      fetchText: async () => 'nope',
    }),
    {
      ok: false,
      error: 'invalid-code-reference',
    }
  )

  const failingFetch = async () => {
    fetchCount += 1
    throw new Error('not found')
  }

  const first = await resolveCodeSnippet(database, githubUrl, {
    fetchText: failingFetch,
    now: '2026-07-04T12:00:00.000Z',
  })
  const second = await resolveCodeSnippet(database, githubUrl, {
    fetchText: failingFetch,
    now: '2026-07-04T12:01:00.000Z',
  })

  assert.deepEqual(first, {
    ok: false,
    error: 'fetch-failed',
  })
  assert.deepEqual(second, {
    ok: false,
    error: 'fetch-failed',
  })
  assert.equal(fetchCount, 1)
})

test('caps snippet line count and payload size', async () => {
  const database = createInMemoryDatabase()
  const longUrl =
    'https://github.com/cascadery/tool/blob/main/src/App.tsx#L1-L100'
  const result = await resolveCodeSnippet(database, longUrl, {
    fetchText: async () =>
      Array.from({ length: 120 }, (_, index) =>
        `${index + 1} ${'x'.repeat(300)}`
      ).join('\n'),
  })

  assert.equal(result.ok, true)
  assert.equal(result.ok ? result.snippet.lines.length : 0, 40)
  assert.equal(result.ok ? result.snippet.truncated : false, true)
  assert.ok(
    JSON.stringify(result.ok ? result.snippet.lines : []).length <= 8300
  )
})
