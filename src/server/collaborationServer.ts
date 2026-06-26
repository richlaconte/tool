import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

import { SQLite } from '@hocuspocus/extension-sqlite'
import { Server as HocuspocusServer } from '@hocuspocus/server'

export type CollaborationContext = {
  accessMode: 'edit'
  clientId: string
  pageId: string
  readOnly: false
}

export type CollaborationServerOptions = {
  allowedOrigins?: string[]
  databasePath?: string
}

export type CollaborationServer = {
  handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void
}

type HeaderRecord = Record<
  string,
  string | string[] | undefined
>

type CollaborationRequestContext = {
  clientId?: string
  documentName?: string
}

export const getCollaborationContextFromHeaders = (
  headers: HeaderRecord | Headers,
  options: Pick<CollaborationServerOptions, 'allowedOrigins'> = {},
  requestContext: CollaborationRequestContext = {}
): CollaborationContext | null => {
  const origin = getHeader(headers, 'origin')
  if (
    options.allowedOrigins?.length &&
    (!origin || !options.allowedOrigins.includes(origin))
  ) {
    return null
  }

  const pageId = getPageIdFromCollaborationDocumentName(
    requestContext.documentName ?? ''
  )
  if (!pageId) return null

  return {
    accessMode: 'edit',
    clientId: requestContext.clientId ?? 'anonymous-client',
    pageId,
    readOnly: false,
  }
}

export const createCollaborationServer = ({
  allowedOrigins = getAllowedOriginsFromEnv(),
  databasePath = process.env.TOOL_YJS_DATABASE_PATH ??
    process.env.TOOL_DATABASE_PATH ??
    './.data/collaboration.sqlite',
}: CollaborationServerOptions = {}): CollaborationServer => {
  const hocuspocusServer = new HocuspocusServer<CollaborationContext>({
    extensions: [
      new SQLite({
        database: databasePath,
      }),
    ],
    quiet: true,
    timeout: 30_000,
    websocketOptions: {
      maxPayload: 1024 * 1024,
    },
    async onAuthenticate(data) {
      const context = getCollaborationContextFromHeaders(
        headersToRecord(data.requestHeaders),
        {
          allowedOrigins,
        },
        {
          clientId: `client_${data.socketId}`,
          documentName: data.documentName,
        }
      )

      if (!context) {
        throw new Error('Collaboration connection not allowed.')
      }

      data.connectionConfig.readOnly = false

      return context
    },
  })

  return {
    handleUpgrade(request, socket, head) {
      hocuspocusServer.httpServer.emit(
        'upgrade',
        request,
        socket,
        head
      )
    },
  }
}

const getHeader = (headers: HeaderRecord | Headers, name: string) => {
  const possibleHeaders = headers as unknown as {
    get?: (headerName: string) => string | null
  }

  if (typeof possibleHeaders.get === 'function') {
    return possibleHeaders.get(name) ?? undefined
  }

  const headerRecord = headers as HeaderRecord
  const recordValue =
    headerRecord[name.toLowerCase()] ?? headerRecord[name]

  return Array.isArray(recordValue) ? recordValue[0] : recordValue
}

const headersToRecord = (
  headers: Headers | IncomingHttpHeaders
): HeaderRecord | Headers => headers

export const getPageIdFromCollaborationDocumentName = (
  documentName: string
) => {
  const prefix = 'page:'
  if (!documentName.startsWith(prefix)) return null

  const pageId = documentName.slice(prefix.length).trim()
  return pageId ? pageId : null
}

const getAllowedOriginsFromEnv = () =>
  (process.env.TOOL_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
