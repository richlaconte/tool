export type MarkdownInlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: MarkdownInlineNode[] }
  | { type: 'italic'; children: MarkdownInlineNode[] }
  | { type: 'code'; text: string }
  | {
      type: 'link'
      href: string
      children: MarkdownInlineNode[]
    }

export type MarkdownListItem = {
  children: MarkdownInlineNode[]
  nestedItems: MarkdownInlineNode[][]
}

export type MarkdownBlock =
  | {
      type: 'heading'
      level: 1 | 2 | 3
      children: MarkdownInlineNode[]
    }
  | { type: 'paragraph'; lines: MarkdownInlineNode[][] }
  | {
      type: 'list'
      ordered: boolean
      items: MarkdownListItem[]
    }
  | { type: 'codeBlock'; language: string; code: string }

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:']

export const isSafeLinkHref = (href: string) => {
  const trimmed = href.trim()

  if (trimmed.length === 0) return false

  try {
    return SAFE_LINK_PROTOCOLS.includes(
      new URL(trimmed).protocol.toLowerCase()
    )
  } catch {
    return false
  }
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/
const UNORDERED_ITEM_PATTERN = /^(\s*)[-*]\s+(.*)$/
const ORDERED_ITEM_PATTERN = /^(\s*)\d+\.\s+(.*)$/
const FENCE_PATTERN = /^\s{0,3}```(.*)$/

type ListLineMatch = {
  indent: number
  ordered: boolean
  content: string
}

const matchListLine = (line: string): ListLineMatch | null => {
  const unordered = UNORDERED_ITEM_PATTERN.exec(line)

  if (unordered) {
    return {
      indent: unordered[1].length,
      ordered: false,
      content: unordered[2],
    }
  }

  const ordered = ORDERED_ITEM_PATTERN.exec(line)

  if (ordered) {
    return {
      indent: ordered[1].length,
      ordered: true,
      content: ordered[2],
    }
  }

  return null
}

export const parseMarkdown = (text: string): MarkdownBlock[] => {
  const lines = text.split('\n')
  const blocks: MarkdownBlock[] = []
  let paragraphLines: MarkdownInlineNode[][] = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return

    blocks.push({ type: 'paragraph', lines: paragraphLines })
    paragraphLines = []
  }

  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const fence = FENCE_PATTERN.exec(line)

    if (fence) {
      flushParagraph()

      const language = fence[1].trim().toLowerCase()
      const codeLines: string[] = []

      index += 1

      while (
        index < lines.length &&
        !FENCE_PATTERN.test(lines[index])
      ) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) index += 1

      blocks.push({
        type: 'codeBlock',
        language,
        code: codeLines.join('\n'),
      })
      continue
    }

    if (line.trim().length === 0) {
      flushParagraph()
      index += 1
      continue
    }

    const heading = HEADING_PATTERN.exec(line)

    if (heading) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: parseInlineMarkdown(heading[2]),
      })
      index += 1
      continue
    }

    const listLine = matchListLine(line)

    if (listLine) {
      flushParagraph()

      const ordered = listLine.ordered
      const items: MarkdownListItem[] = []

      while (index < lines.length) {
        const currentMatch = matchListLine(lines[index])

        if (!currentMatch) break

        if (currentMatch.indent >= 2 && items.length > 0) {
          items[items.length - 1].nestedItems.push(
            parseInlineMarkdown(currentMatch.content)
          )
          index += 1
          continue
        }

        if (currentMatch.ordered !== ordered) break

        items.push({
          children: parseInlineMarkdown(currentMatch.content),
          nestedItems: [],
        })
        index += 1
      }

      blocks.push({ type: 'list', ordered, items })
      continue
    }

    paragraphLines.push(parseInlineMarkdown(line))
    index += 1
  }

  flushParagraph()

  return blocks
}

const LINK_PATTERN = /^\[([^\]]*)\]\(([^)]*)\)/

export const parseInlineMarkdown = (
  text: string
): MarkdownInlineNode[] => {
  const nodes: MarkdownInlineNode[] = []
  let plainText = ''
  let index = 0

  const flushPlainText = () => {
    if (plainText.length === 0) return

    nodes.push({ type: 'text', text: plainText })
    plainText = ''
  }

  while (index < text.length) {
    const character = text[index]

    if (character === '`') {
      const closing = text.indexOf('`', index + 1)

      if (closing > index + 1) {
        flushPlainText()
        nodes.push({
          type: 'code',
          text: text.slice(index + 1, closing),
        })
        index = closing + 1
        continue
      }
    }

    if (character === '[') {
      const linkMatch = LINK_PATTERN.exec(text.slice(index))

      if (linkMatch) {
        const [raw, label, href] = linkMatch

        if (isSafeLinkHref(href)) {
          flushPlainText()
          nodes.push({
            type: 'link',
            href: href.trim(),
            children: parseInlineMarkdown(label),
          })
        } else {
          plainText += raw
        }

        index += raw.length
        continue
      }
    }

    if (text.startsWith('**', index)) {
      let closing = text.indexOf('**', index + 2)

      if (closing > index + 2 && text[closing + 2] === '*') {
        closing += 1
      }

      if (closing > index + 2) {
        flushPlainText()
        nodes.push({
          type: 'bold',
          children: parseInlineMarkdown(
            text.slice(index + 2, closing)
          ),
        })
        index = closing + 2
        continue
      }
    }

    if (character === '*') {
      const closing = text.indexOf('*', index + 1)

      if (
        closing > index + 1 &&
        text[closing - 1] !== '*' &&
        text[closing + 1] !== '*'
      ) {
        flushPlainText()
        nodes.push({
          type: 'italic',
          children: parseInlineMarkdown(
            text.slice(index + 1, closing)
          ),
        })
        index = closing + 1
        continue
      }
    }

    plainText += character
    index += 1
  }

  flushPlainText()

  return nodes
}

export const getInlineNodeText = (
  nodes: MarkdownInlineNode[]
): string =>
  nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') {
        return node.text
      }

      return getInlineNodeText(node.children)
    })
    .join('')

export const hasMarkdownSyntax = (text: string) =>
  parseMarkdown(text).some(
    (block) =>
      block.type !== 'paragraph' ||
      block.lines.some((line) =>
        line.some((node) => node.type !== 'text')
      )
  )
