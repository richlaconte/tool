import { createHash } from 'node:crypto'

import {
  getLanguageFromPath,
  getRawContentUrl,
  parseCodeReference,
  type ResolvedCodeSnippet,
} from '../codeReferences.ts'
import type { ToolDatabase } from './database.ts'

export type CodeSnippetResult =
  | {
      ok: true
      snippet: ResolvedCodeSnippet
      fromCache: boolean
    }
  | {
      ok: false
      error: 'invalid-code-reference' | 'fetch-failed'
    }

type CodeSnippetRow = {
  payloadJson: string
  fetchedAt: string
  status: 'success' | 'error'
}

const BRANCH_TTL_MS = 15 * 60 * 1000
const ERROR_TTL_MS = 5 * 60 * 1000
const CONTEXT_LINES = 2
const MAX_SNIPPET_LINES = 40
const MAX_SNIPPET_JSON_BYTES = 8 * 1024
const MAX_SNIPPET_LINE_TEXT_LENGTH = 160

export const resolveCodeSnippet = async (
  database: ToolDatabase,
  url: string,
  {
    fetchText = fetchRawText,
    now = new Date().toISOString(),
  }: {
    fetchText?: (rawUrl: string) => Promise<string>
    now?: string
  } = {}
): Promise<CodeSnippetResult> => {
  const parsed = parseCodeReference(url)

  if (!parsed) {
    return {
      ok: false,
      error: 'invalid-code-reference',
    }
  }

  const cacheKey = hashUrl(url)
  const cached = readCachedSnippet(database, cacheKey)
  const cachedResult = getUsableCachedResult(cached, {
    isImmutableRef: parsed.isImmutableRef,
    now,
  })

  if (cachedResult) return cachedResult

  try {
    const text = await fetchText(getRawContentUrl(parsed))
    const snippet = createSnippetFromText(url, text, now)

    database
      .prepare(
        `insert or replace into code_snippets
          (url_hash, payload_json, fetched_at, status)
         values (?, ?, ?, 'success')`
      )
      .run(cacheKey, JSON.stringify(snippet), now)

    return {
      ok: true,
      snippet,
      fromCache: false,
    }
  } catch {
    database
      .prepare(
        `insert or replace into code_snippets
          (url_hash, payload_json, fetched_at, status)
         values (?, ?, ?, 'error')`
      )
      .run(cacheKey, JSON.stringify({ error: 'fetch-failed' }), now)

    return {
      ok: false,
      error: 'fetch-failed',
    }
  }
}

export const createSnippetFromText = (
  url: string,
  text: string,
  fetchedAt = new Date().toISOString()
): ResolvedCodeSnippet => {
  const parsed = parseCodeReference(url)
  if (!parsed) throw new Error('Invalid code reference.')

  const allLines = text.split(/\r?\n/)
  const startLine = Math.max(1, parsed.startLine - CONTEXT_LINES)
  const requestedEndWithContext = Math.min(
    allLines.length,
    parsed.endLine + CONTEXT_LINES
  )
  const cappedEndLine = Math.min(
    requestedEndWithContext,
    startLine + MAX_SNIPPET_LINES - 1
  )
  let truncated =
    cappedEndLine < requestedEndWithContext ||
    parsed.endLine - parsed.startLine + 1 > MAX_SNIPPET_LINES
  let lines = allLines
    .slice(startLine - 1, cappedEndLine)
    .map((line, index) => ({
      number: startLine + index,
      text: trimSnippetLine(line),
    }))

  if (lines.some((line) => line.text.length < allLines[line.number - 1].length)) {
    truncated = true
  }

  while (
    lines.length > 0 &&
    JSON.stringify(lines).length > MAX_SNIPPET_JSON_BYTES
  ) {
    lines = lines.slice(0, -1)
    truncated = true
  }

  return {
    url,
    path: parsed.path,
    startLine,
    requestedStartLine: parsed.startLine,
    requestedEndLine: parsed.endLine,
    language: getLanguageFromPath(parsed.path),
    fetchedAt,
    truncated,
    isImmutableRef: parsed.isImmutableRef,
    lines,
  }
}

const readCachedSnippet = (
  database: ToolDatabase,
  cacheKey: string
): CodeSnippetRow | null =>
  (database
    .prepare(
      `select payload_json as payloadJson,
              fetched_at as fetchedAt,
              status
       from code_snippets
       where url_hash = ?
       limit 1`
    )
    .get(cacheKey) as CodeSnippetRow | undefined) ?? null

const getUsableCachedResult = (
  cached: CodeSnippetRow | null,
  {
    isImmutableRef,
    now,
  }: {
    isImmutableRef: boolean
    now: string
  }
): CodeSnippetResult | null => {
  if (!cached) return null

  const age = Date.parse(now) - Date.parse(cached.fetchedAt)
  const ttl =
    cached.status === 'error'
      ? ERROR_TTL_MS
      : isImmutableRef
        ? Number.POSITIVE_INFINITY
        : BRANCH_TTL_MS

  if (age > ttl) return null

  if (cached.status === 'error') {
    return {
      ok: false,
      error: 'fetch-failed',
    }
  }

  return {
    ok: true,
    snippet: JSON.parse(cached.payloadJson) as ResolvedCodeSnippet,
    fromCache: true,
  }
}

const fetchRawText = async (rawUrl: string) => {
  const response = await fetch(rawUrl, {
    headers: {
      Accept: 'text/plain',
    },
  })

  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`)
  }

  return response.text()
}

const hashUrl = (url: string) =>
  createHash('sha256').update(url).digest('hex')

const trimSnippetLine = (line: string) => {
  if (line.length <= MAX_SNIPPET_LINE_TEXT_LENGTH) return line

  return `${line.slice(0, MAX_SNIPPET_LINE_TEXT_LENGTH - 3)}...`
}
