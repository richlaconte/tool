import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getInlineNodeText,
  isSafeLinkHref,
  parseInlineMarkdown,
  parseMarkdown,
} from './markdownContent.ts'

test('plain text parses to a single paragraph', () => {
  const blocks = parseMarkdown('hello world')

  assert.deepEqual(blocks, [
    {
      type: 'paragraph',
      lines: [[{ type: 'text', text: 'hello world' }]],
    },
  ])
})

test('single newlines stay hard breaks inside one paragraph', () => {
  const blocks = parseMarkdown('line one\nline two')

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'paragraph')

  if (blocks[0].type === 'paragraph') {
    assert.equal(blocks[0].lines.length, 2)
  }
})

test('blank lines split paragraphs', () => {
  const blocks = parseMarkdown('first\n\nsecond')

  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].type, 'paragraph')
  assert.equal(blocks[1].type, 'paragraph')
})

test('headings parse levels one through three only', () => {
  const blocks = parseMarkdown('# One\n## Two\n### Three\n#### Four')

  assert.deepEqual(
    blocks.map((block) => block.type),
    ['heading', 'heading', 'heading', 'paragraph']
  )

  if (blocks[0].type === 'heading') {
    assert.equal(blocks[0].level, 1)
    assert.equal(getInlineNodeText(blocks[0].children), 'One')
  }

  if (blocks[2].type === 'heading') {
    assert.equal(blocks[2].level, 3)
  }
})

test('a heading requires a space after the hashes', () => {
  const blocks = parseMarkdown('#nospace')

  assert.equal(blocks[0].type, 'paragraph')
})

test('unordered lists parse with dash and asterisk markers', () => {
  const blocks = parseMarkdown('- first\n* second')

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'list')

  if (blocks[0].type === 'list') {
    assert.equal(blocks[0].ordered, false)
    assert.equal(blocks[0].items.length, 2)
  }
})

test('ordered lists parse from numeric markers', () => {
  const blocks = parseMarkdown('1. first\n2. second')

  assert.equal(blocks[0].type, 'list')

  if (blocks[0].type === 'list') {
    assert.equal(blocks[0].ordered, true)
    assert.equal(
      getInlineNodeText(blocks[0].items[1].children),
      'second'
    )
  }
})

test('indented items nest one level under the previous item', () => {
  const blocks = parseMarkdown('- parent\n  - child\n- sibling')

  assert.equal(blocks[0].type, 'list')

  if (blocks[0].type === 'list') {
    assert.equal(blocks[0].items.length, 2)
    assert.equal(blocks[0].items[0].nestedItems.length, 1)
    assert.equal(
      getInlineNodeText(blocks[0].items[0].nestedItems[0]),
      'child'
    )
  }
})

test('fenced code blocks capture language and verbatim content', () => {
  const blocks = parseMarkdown(
    '```ts\nconst x = 1\n**not bold**\n```'
  )

  assert.deepEqual(blocks, [
    {
      type: 'codeBlock',
      language: 'ts',
      code: 'const x = 1\n**not bold**',
    },
  ])
})

test('an unterminated fence runs to the end of the text', () => {
  const blocks = parseMarkdown('```\ncode line')

  assert.deepEqual(blocks, [
    { type: 'codeBlock', language: '', code: 'code line' },
  ])
})

test('bold, italic, and inline code parse', () => {
  const nodes = parseInlineMarkdown('a **b** *c* `d`')

  assert.deepEqual(
    nodes.map((node) => node.type),
    ['text', 'bold', 'text', 'italic', 'text', 'code']
  )
})

test('bold can contain italic', () => {
  const nodes = parseInlineMarkdown('**bold *both***')

  assert.equal(nodes[0].type, 'bold')

  if (nodes[0].type === 'bold') {
    assert.deepEqual(
      nodes[0].children.map((node) => node.type),
      ['text', 'italic']
    )
  }
})

test('unbalanced markers stay literal text', () => {
  assert.deepEqual(parseInlineMarkdown('**open'), [
    { type: 'text', text: '**open' },
  ])
  assert.deepEqual(parseInlineMarkdown('a * b'), [
    { type: 'text', text: 'a * b' },
  ])
  assert.deepEqual(parseInlineMarkdown('tick ` alone'), [
    { type: 'text', text: 'tick ` alone' },
  ])
})

test('safe links parse into link nodes', () => {
  const nodes = parseInlineMarkdown(
    '[docs](https://example.com/path)'
  )

  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].type, 'link')

  if (nodes[0].type === 'link') {
    assert.equal(nodes[0].href, 'https://example.com/path')
    assert.equal(getInlineNodeText(nodes[0].children), 'docs')
  }
})

test('unsafe link schemes render as literal text', () => {
  const cases = [
    '[x](javascript:alert(1))',
    '[x](data:text/html,hi)',
    '[x](vbscript:evil)',
    '[x](//protocol-relative.example)',
    '[x](relative/path)',
  ]

  for (const raw of cases) {
    assert.deepEqual(
      parseInlineMarkdown(raw),
      [{ type: 'text', text: raw }],
      raw
    )
  }
})

test('isSafeLinkHref allows only http, https, and mailto', () => {
  assert.equal(isSafeLinkHref('https://example.com'), true)
  assert.equal(isSafeLinkHref('http://example.com'), true)
  assert.equal(isSafeLinkHref('mailto:dev@example.com'), true)
  assert.equal(isSafeLinkHref('javascript:alert(1)'), false)
  assert.equal(isSafeLinkHref('JAVASCRIPT:alert(1)'), false)
  assert.equal(isSafeLinkHref('file:///etc/passwd'), false)
  assert.equal(isSafeLinkHref(''), false)
})

test('html renders as literal text, never markup', () => {
  const blocks = parseMarkdown('<script>alert(1)</script>')

  assert.deepEqual(blocks, [
    {
      type: 'paragraph',
      lines: [
        [{ type: 'text', text: '<script>alert(1)</script>' }],
      ],
    },
  ])
})

test('img onerror payloads stay literal text', () => {
  const blocks = parseMarkdown('<img src=x onerror=alert(1)>')

  assert.equal(blocks[0].type, 'paragraph')

  if (blocks[0].type === 'paragraph') {
    assert.deepEqual(blocks[0].lines[0], [
      { type: 'text', text: '<img src=x onerror=alert(1)>' },
    ])
  }
})

test('mixed documents parse block types in order', () => {
  const blocks = parseMarkdown(
    '# Title\n\nintro text\n\n- a\n- b\n\n```js\n1\n```\nafter'
  )

  assert.deepEqual(
    blocks.map((block) => block.type),
    ['heading', 'paragraph', 'list', 'codeBlock', 'paragraph']
  )
})

test('slash command text parses as plain paragraph text', () => {
  const blocks = parseMarkdown('/border: 1px solid red')

  assert.equal(blocks[0].type, 'paragraph')

  if (blocks[0].type === 'paragraph') {
    assert.deepEqual(blocks[0].lines[0], [
      { type: 'text', text: '/border: 1px solid red' },
    ])
  }
})
