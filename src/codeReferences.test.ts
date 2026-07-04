import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getLanguageFromPath,
  getRawContentUrl,
  parseCodeReference,
} from './codeReferences.ts'

test('parses GitHub code permalinks with line ranges and immutable refs', () => {
  const parsed = parseCodeReference(
    'https://github.com/cascadery/tool/blob/0123456789abcdef0123456789abcdef01234567/src/App.tsx#L10-L20'
  )

  assert.deepEqual(parsed, {
    host: 'github',
    owner: 'cascadery',
    repo: 'tool',
    ref: '0123456789abcdef0123456789abcdef01234567',
    path: 'src/App.tsx',
    startLine: 10,
    endLine: 20,
    isImmutableRef: true,
  })
  assert.equal(
    getRawContentUrl(parsed!),
    'https://raw.githubusercontent.com/cascadery/tool/0123456789abcdef0123456789abcdef01234567/src/App.tsx'
  )
})

test('parses GitLab code permalinks with branch refs and single lines', () => {
  const parsed = parseCodeReference(
    'https://gitlab.com/group/subgroup/tool/-/blob/main/src/server.ts#L42'
  )

  assert.deepEqual(parsed, {
    host: 'gitlab',
    owner: 'group/subgroup',
    repo: 'tool',
    ref: 'main',
    path: 'src/server.ts',
    startLine: 42,
    endLine: 42,
    isImmutableRef: false,
  })
  assert.equal(
    getRawContentUrl(parsed!),
    'https://gitlab.com/group/subgroup/tool/-/raw/main/src/server.ts'
  )
})

test('rejects malformed or non-allowlisted code references', () => {
  assert.equal(parseCodeReference('https://example.com/a/b#L1'), null)
  assert.equal(
    parseCodeReference('https://github.com/a/b/pull/1/files#L1'),
    null
  )
  assert.equal(
    parseCodeReference('https://github.com/a/b/blob/main/src/a.ts'),
    null
  )
  assert.equal(
    parseCodeReference('https://github.com/a/b/blob/main/src/a.ts#L9-L4'),
    null
  )
})

test('maps paths to supported code highlight languages', () => {
  assert.equal(getLanguageFromPath('src/App.tsx'), 'tsx')
  assert.equal(getLanguageFromPath('styles/app.css'), 'css')
  assert.equal(getLanguageFromPath('package.json'), 'json')
  assert.equal(getLanguageFromPath('scripts/deploy.sh'), 'bash')
  assert.equal(getLanguageFromPath('README.md'), 'markdown')
})
