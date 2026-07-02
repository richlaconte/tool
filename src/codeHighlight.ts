export type CodeTokenKind =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'plain'

export type CodeToken = {
  text: string
  kind: CodeTokenKind
}

type LanguageFamily = 'js' | 'css' | 'json' | 'html' | 'bash'

const LANGUAGE_FAMILIES: Record<string, LanguageFamily> = {
  js: 'js',
  jsx: 'js',
  ts: 'js',
  tsx: 'js',
  javascript: 'js',
  typescript: 'js',
  css: 'css',
  json: 'json',
  html: 'html',
  xml: 'html',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
}

const JS_KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'yield',
])

const JSON_KEYWORDS = new Set(['true', 'false', 'null'])

const BASH_KEYWORDS = new Set([
  'case',
  'do',
  'done',
  'echo',
  'elif',
  'else',
  'esac',
  'exit',
  'export',
  'fi',
  'for',
  'function',
  'if',
  'in',
  'local',
  'return',
  'then',
  'while',
])

const WORD_PATTERN = /^[A-Za-z_$][\w$]*/
const NUMBER_PATTERN = /^\d[\d_]*(\.\d+)?/

export const highlightCode = (
  code: string,
  language: string
): CodeToken[] => {
  const family = LANGUAGE_FAMILIES[language.trim().toLowerCase()]

  if (!family || code.length === 0) {
    return code.length === 0
      ? []
      : [{ text: code, kind: 'plain' }]
  }

  const tokens: CodeToken[] = []
  let plainText = ''
  let index = 0

  const flushPlainText = () => {
    if (plainText.length === 0) return

    tokens.push({ text: plainText, kind: 'plain' })
    plainText = ''
  }

  const push = (text: string, kind: CodeTokenKind) => {
    flushPlainText()
    tokens.push({ text, kind })
    index += text.length
  }

  const readUntil = (
    closing: string,
    options: { escapes: boolean }
  ) => {
    let end = index + closing.length

    while (end < code.length) {
      if (options.escapes && code[end] === '\\') {
        end += 2
        continue
      }

      if (code.startsWith(closing, end)) {
        return code.slice(index, end + closing.length)
      }

      end += 1
    }

    return code.slice(index)
  }

  const readLine = () => {
    const lineEnd = code.indexOf('\n', index)

    return lineEnd === -1
      ? code.slice(index)
      : code.slice(index, lineEnd)
  }

  while (index < code.length) {
    const character = code[index]

    if (
      (family === 'js' || family === 'css') &&
      code.startsWith('/*', index)
    ) {
      push(readUntil('*/', { escapes: false }), 'comment')
      continue
    }

    if (family === 'js' && code.startsWith('//', index)) {
      push(readLine(), 'comment')
      continue
    }

    if (family === 'bash' && character === '#') {
      push(readLine(), 'comment')
      continue
    }

    if (family === 'html' && code.startsWith('<!--', index)) {
      push(readUntil('-->', { escapes: false }), 'comment')
      continue
    }

    if (
      character === '"' ||
      character === "'" ||
      (family === 'js' && character === '`')
    ) {
      push(readUntil(character, { escapes: true }), 'string')
      continue
    }

    if (family === 'html' && character === '<') {
      const tagMatch = /^<\/?[A-Za-z][\w-]*/.exec(
        code.slice(index)
      )

      if (tagMatch) {
        push(tagMatch[0], 'keyword')
        continue
      }
    }

    if (/\d/.test(character)) {
      const previous = index > 0 ? code[index - 1] : ''

      if (!/[\w$]/.test(previous)) {
        const numberMatch = NUMBER_PATTERN.exec(
          code.slice(index)
        )

        if (numberMatch) {
          push(numberMatch[0], 'number')
          continue
        }
      }
    }

    const wordMatch = WORD_PATTERN.exec(code.slice(index))

    if (wordMatch) {
      const word = wordMatch[0]
      const keywords =
        family === 'js'
          ? JS_KEYWORDS
          : family === 'json'
            ? JSON_KEYWORDS
            : family === 'bash'
              ? BASH_KEYWORDS
              : null

      if (keywords?.has(word)) {
        push(word, 'keyword')
      } else {
        plainText += word
        index += word.length
      }

      continue
    }

    plainText += character
    index += 1
  }

  flushPlainText()

  return tokens
}
