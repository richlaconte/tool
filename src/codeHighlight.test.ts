import assert from 'node:assert/strict'
import test from 'node:test'

import {
  highlightCode,
  type CodeToken,
} from './codeHighlight.ts'

const joinTokens = (tokens: CodeToken[]) =>
  tokens.map((token) => token.text).join('')

const kindsOf = (tokens: CodeToken[], kind: string) =>
  tokens
    .filter((token) => token.kind === kind)
    .map((token) => token.text)

test('token text always reassembles the input exactly', () => {
  const samples: Array<[string, string]> = [
    ['ts', "const x = 'a' // note\nreturn x"],
    ['css', '.a { color: #fff; /* c */ margin: 4px; }'],
    ['json', '{"a": true, "b": [1, 2.5, null]}'],
    ['html', '<div class="x"><!-- hi --></div>'],
    ['bash', '# setup\nexport FOO="bar"\necho $FOO'],
    ['unknown-lang', 'anything at all'],
  ]

  for (const [language, code] of samples) {
    assert.equal(
      joinTokens(highlightCode(code, language)),
      code,
      language
    )
  }
})

test('typescript keywords, strings, comments, and numbers tokenize', () => {
  const tokens = highlightCode(
    "const total = 42 // sum\nreturn `ok ${'yes'}`",
    'ts'
  )

  assert.deepEqual(kindsOf(tokens, 'keyword'), [
    'const',
    'return',
  ])
  assert.deepEqual(kindsOf(tokens, 'number'), ['42'])
  assert.deepEqual(kindsOf(tokens, 'comment'), ['// sum'])
  assert.equal(kindsOf(tokens, 'string').length, 1)
})

test('identifiers containing keyword substrings stay plain', () => {
  const tokens = highlightCode('constellation = 1', 'js')

  assert.deepEqual(kindsOf(tokens, 'keyword'), [])
})

test('numbers inside identifiers stay plain', () => {
  const tokens = highlightCode('base64 = 9', 'js')

  assert.deepEqual(kindsOf(tokens, 'number'), ['9'])
})

test('escaped quotes stay inside one string token', () => {
  const tokens = highlightCode("'it\\'s fine' + 1", 'js')

  assert.deepEqual(kindsOf(tokens, 'string'), ["'it\\'s fine'"])
})

test('css block comments and strings tokenize', () => {
  const tokens = highlightCode(
    '/* theme */ .a { content: "x"; width: 10px; }',
    'css'
  )

  assert.deepEqual(kindsOf(tokens, 'comment'), ['/* theme */'])
  assert.deepEqual(kindsOf(tokens, 'string'), ['"x"'])
  assert.deepEqual(kindsOf(tokens, 'number'), ['10'])
})

test('json literals tokenize as keywords', () => {
  const tokens = highlightCode(
    '{"ok": true, "missing": null}',
    'json'
  )

  assert.deepEqual(kindsOf(tokens, 'keyword'), ['true', 'null'])
})

test('html tags and comments tokenize', () => {
  const tokens = highlightCode(
    '<section id="a"><!-- note --></section>',
    'html'
  )

  assert.deepEqual(kindsOf(tokens, 'keyword'), [
    '<section',
    '</section',
  ])
  assert.deepEqual(kindsOf(tokens, 'comment'), ['<!-- note -->'])
  assert.deepEqual(kindsOf(tokens, 'string'), ['"a"'])
})

test('bash comments and keywords tokenize', () => {
  const tokens = highlightCode(
    '# install\nif true; then\n  echo done\nfi',
    'bash'
  )

  assert.deepEqual(kindsOf(tokens, 'comment'), ['# install'])
  assert.ok(kindsOf(tokens, 'keyword').includes('if'))
  assert.ok(kindsOf(tokens, 'keyword').includes('echo'))
  assert.ok(kindsOf(tokens, 'keyword').includes('fi'))
})

test('unknown languages pass through as one plain token', () => {
  assert.deepEqual(highlightCode('let x = 1', 'python'), [
    { text: 'let x = 1', kind: 'plain' },
  ])
})

test('language names normalize case and aliases', () => {
  assert.deepEqual(
    kindsOf(highlightCode('const a = 1', 'TypeScript'), 'keyword'),
    ['const']
  )
  assert.deepEqual(
    kindsOf(highlightCode('echo hi', 'sh'), 'keyword'),
    ['echo']
  )
})

test('empty code produces no tokens', () => {
  assert.deepEqual(highlightCode('', 'ts'), [])
})

test('an unterminated string runs to the end without looping', () => {
  const code = "const a = 'open"
  const tokens = highlightCode(code, 'ts')

  assert.equal(joinTokens(tokens), code)
})
