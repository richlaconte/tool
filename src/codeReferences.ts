export type CodeReferenceHost = 'github' | 'gitlab'

export type ParsedCodeReference = {
  host: CodeReferenceHost
  owner: string
  repo: string
  ref: string
  path: string
  startLine: number
  endLine: number
  isImmutableRef: boolean
}

export type ResolvedCodeSnippetLine = {
  number: number
  text: string
}

export type ResolvedCodeSnippet = {
  url: string
  path: string
  startLine: number
  requestedStartLine: number
  requestedEndLine: number
  language: string
  fetchedAt: string
  truncated: boolean
  isImmutableRef: boolean
  lines: ResolvedCodeSnippetLine[]
}

const FULL_SHA_PATTERN = /^[a-f0-9]{40}$/i
const LINE_HASH_PATTERN = /^L(?<start>\d+)(?:-L?(?<end>\d+))?$/

export const parseCodeReference = (
  target: string
): ParsedCodeReference | null => {
  let url: URL

  try {
    url = new URL(target.trim())
  } catch {
    return null
  }

  const lineRange = parseLineRange(url.hash)
  if (!lineRange) return null

  if (url.hostname === 'github.com') {
    return parseGitHubReference(url, lineRange)
  }

  if (url.hostname === 'gitlab.com') {
    return parseGitLabReference(url, lineRange)
  }

  return null
}

export const getRawContentUrl = (parsed: ParsedCodeReference) => {
  const encodedPath = encodePath(parsed.path)
  const encodedRef = encodeURIComponent(parsed.ref)

  if (parsed.host === 'github') {
    return `https://raw.githubusercontent.com/${encodePath(parsed.owner)}/${encodeURIComponent(parsed.repo)}/${encodedRef}/${encodedPath}`
  }

  return `https://gitlab.com/${encodePath(parsed.owner)}/${encodeURIComponent(parsed.repo)}/-/raw/${encodedRef}/${encodedPath}`
}

export const getLanguageFromPath = (path: string) => {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const filename = path.split('/').pop()?.toLowerCase() ?? ''

  if (extension === 'tsx') return 'tsx'
  if (extension === 'ts') return 'ts'
  if (extension === 'jsx') return 'jsx'
  if (extension === 'js' || extension === 'mjs' || extension === 'cjs') {
    return 'js'
  }
  if (extension === 'css' || extension === 'scss') return 'css'
  if (extension === 'json' || filename === 'package-lock.json') return 'json'
  if (extension === 'html' || extension === 'xml') return 'html'
  if (extension === 'sh' || extension === 'zsh' || extension === 'bash') {
    return 'bash'
  }
  if (extension === 'md' || extension === 'markdown') return 'markdown'

  return extension || 'text'
}

export const formatSnippetHeader = (snippet: ResolvedCodeSnippet) => {
  const lineLabel =
    snippet.requestedStartLine === snippet.requestedEndLine
      ? `${snippet.requestedStartLine}`
      : `${snippet.requestedStartLine}-${snippet.requestedEndLine}`

  return `${snippet.path}:${lineLabel}`
}

const parseGitHubReference = (
  url: URL,
  lineRange: Pick<ParsedCodeReference, 'startLine' | 'endLine'>
): ParsedCodeReference | null => {
  const parts = url.pathname.split('/').filter(Boolean)
  const blobIndex = parts.indexOf('blob')

  if (parts.length < 5 || blobIndex !== 2) return null

  const owner = parts[0]
  const repo = parts[1]
  const ref = parts[3]
  const path = parts.slice(4).join('/')

  if (!owner || !repo || !ref || !path) return null

  return {
    host: 'github',
    owner,
    repo,
    ref,
    path,
    ...lineRange,
    isImmutableRef: FULL_SHA_PATTERN.test(ref),
  }
}

const parseGitLabReference = (
  url: URL,
  lineRange: Pick<ParsedCodeReference, 'startLine' | 'endLine'>
): ParsedCodeReference | null => {
  const parts = url.pathname.split('/').filter(Boolean)
  const dashIndex = parts.indexOf('-')

  if (dashIndex < 2 || parts[dashIndex + 1] !== 'blob') return null

  const ownerAndRepo = parts.slice(0, dashIndex)
  const repo = ownerAndRepo.at(-1)
  const owner = ownerAndRepo.slice(0, -1).join('/')
  const ref = parts[dashIndex + 2]
  const path = parts.slice(dashIndex + 3).join('/')

  if (!owner || !repo || !ref || !path) return null

  return {
    host: 'gitlab',
    owner,
    repo,
    ref,
    path,
    ...lineRange,
    isImmutableRef: FULL_SHA_PATTERN.test(ref),
  }
}

const parseLineRange = (
  hash: string
): Pick<ParsedCodeReference, 'startLine' | 'endLine'> | null => {
  const match = LINE_HASH_PATTERN.exec(hash.replace(/^#/, ''))
  if (!match?.groups) return null

  const startLine = Number.parseInt(match.groups.start, 10)
  const endLine = Number.parseInt(match.groups.end ?? match.groups.start, 10)

  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return null
  if (startLine < 1 || endLine < startLine) return null

  return {
    startLine,
    endLine,
  }
}

const encodePath = (path: string) =>
  path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
