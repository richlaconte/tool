import type { ReactNode } from 'react'

import { highlightCode } from '../codeHighlight'
import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownInlineNode,
} from '../markdownContent'

type MarkdownContentProps = {
  text: string
}

const MarkdownContent = ({ text }: MarkdownContentProps) => (
  <div className="area-markdown">
    {parseMarkdown(text).map((block, index) => (
      <MarkdownBlockContent block={block} key={index} />
    ))}
  </div>
)

const MarkdownBlockContent = ({
  block,
}: {
  block: MarkdownBlock
}) => {
  if (block.type === 'heading') {
    const HeadingTag = (['h1', 'h2', 'h3'] as const)[
      block.level - 1
    ]

    return (
      <HeadingTag className="md-heading">
        {renderInlineNodes(block.children)}
      </HeadingTag>
    )
  }

  if (block.type === 'codeBlock') {
    return (
      <pre className="md-code-block">
        <code>
          {highlightCode(block.code, block.language).map(
            (token, index) =>
              token.kind === 'plain' ? (
                token.text
              ) : (
                <span
                  className={`md-token-${token.kind}`}
                  key={index}
                >
                  {token.text}
                </span>
              )
          )}
        </code>
      </pre>
    )
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul'

    return (
      <ListTag className="md-list">
        {block.items.map((item, index) => (
          <li key={index}>
            {renderInlineNodes(item.children)}
            {item.nestedItems.length > 0 && (
              <ul className="md-list">
                {item.nestedItems.map((nested, nestedIndex) => (
                  <li key={nestedIndex}>
                    {renderInlineNodes(nested)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ListTag>
    )
  }

  return (
    <p className="md-paragraph">
      {block.lines.map((line, index) => (
        <span key={index}>
          {index > 0 && <br />}
          {renderInlineNodes(line)}
        </span>
      ))}
    </p>
  )
}

const renderInlineNodes = (
  nodes: MarkdownInlineNode[]
): ReactNode =>
  nodes.map((node, index) => {
    if (node.type === 'text') return node.text

    if (node.type === 'code') {
      return (
        <code className="md-inline-code" key={index}>
          {node.text}
        </code>
      )
    }

    if (node.type === 'bold') {
      return (
        <strong key={index}>
          {renderInlineNodes(node.children)}
        </strong>
      )
    }

    if (node.type === 'italic') {
      return (
        <em key={index}>{renderInlineNodes(node.children)}</em>
      )
    }

    return (
      <a
        className="md-link"
        href={node.href}
        key={index}
        rel="noreferrer noopener"
        target="_blank"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {renderInlineNodes(node.children)}
      </a>
    )
  })

export default MarkdownContent
