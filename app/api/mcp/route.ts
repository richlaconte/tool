import type { AgentClient, AgentPatch } from '../../../src/agentInterface'
import type { AgentScope } from '../../../src/agentInterface'
import {
  handleMcpJsonRpcRequest,
  MCP_JSON_RPC_VERSION,
  type McpJsonRpcRequest,
} from '../../../src/mcpGateway'
import { createDatabase } from '../../../src/server/database'
import {
  createGlmDecisionLogText,
  getGlmProviderConfigFromEnv,
} from '../../../src/server/glmProvider'
import {
  getPageRecord,
  listPages,
  type PageRecord,
} from '../../../src/server/pageRepository'
import {
  createFixedWindowRateLimiter,
  getRateLimitConfigFromEnv,
} from '../../../src/server/rateLimit'
import {
  getStoredCollaborativePageState,
  saveStoredCollaborativePageState,
} from '../../../src/server/collaborativeStorage'
import { createDefaultPageState, type PageAppState } from '../../../src/pagePersistence'
import {
  listMcpAgentActions,
  recordMcpAgentAction,
} from '../../../src/server/mcpAgentActions'
import { validateMcpToken } from '../../../src/server/mcpTokens'
import { createConsoleSecurityLogger } from '../../../src/server/securityLog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const scopedRateLimiters = createScopedMcpRateLimiters()
const journalRateLimiter = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60_000,
})
const securityLogger = createConsoleSecurityLogger()

export const GET = () =>
  Response.json({
    ok: process.env.TOOL_MCP_ENABLED === 'true',
    service: 'cascadery-mcp',
    enabled: process.env.TOOL_MCP_ENABLED === 'true',
    rateLimited: true,
  })

export const POST = async (request: Request) => {
  if (process.env.TOOL_MCP_ENABLED !== 'true') {
    return Response.json(
      createJsonRpcError(null, -32000, 'MCP endpoint is disabled.'),
      {
        status: 404,
      }
    )
  }

  const database = createDatabase()
  const clientRateLimitKey = getClientRateLimitKey(request)
  const authorization = authorizeMcpRequest(request, database)

  if (!authorization.ok) {
    securityLogger({
      type: 'mcp-auth-denied',
      pageId: authorization.pageId,
      reason: authorization.reason,
      tokenId: authorization.tokenId,
    })

    return createUnauthorizedResponse(authorization.reason)
  }

  let rpcRequest: McpJsonRpcRequest

  try {
    rpcRequest = (await request.json()) as McpJsonRpcRequest
  } catch {
    return Response.json(
      createJsonRpcError(null, -32700, 'Request body must be JSON.'),
      {
        status: 400,
      }
    )
  }

  const glmConfig = getGlmProviderConfigFromEnv()
  const rateLimitKey = authorization.client?.id ?? clientRateLimitKey
  const response = await handleMcpJsonRpcRequest(rpcRequest, {
    authorizedPageId: authorization.pageId,
    checkToolRateLimit: (scope) => {
      const bucket = getRateLimitBucket(scope)
      const result = scopedRateLimiters[bucket].check(
        `${rateLimitKey}:${bucket}`
      )

      if (result.ok) return { ok: true }

      return {
        ok: false,
        retryAfterSeconds: result.retryAfterSeconds,
      }
    },
    checkJournalRateLimit: (pageId) => {
      const result = journalRateLimiter.check(
        `${clientRateLimitKey}:${pageId}`
      )

      if (result.ok) return { ok: true }

      securityLogger({
        type: 'mcp-agent-journal-rate-limit',
        pageId,
        reason: 'journal-append-rate-limit',
        retryAfterSeconds: result.retryAfterSeconds,
      })

      return {
        ok: false,
        retryAfterSeconds: result.retryAfterSeconds,
      }
    },
    createAiDecisionLogPatch: glmConfig
      ? (state, client) =>
          createGlmDecisionLogPatch(state, client, glmConfig)
      : undefined,
    createActionId: () => `mcp_action_${crypto.randomUUID()}`,
    createJournalId: () => `journal_${crypto.randomUUID()}`,
    client: authorization.client,
    getPage: async (pageId) => getPageState(database, pageId),
    listAgentActions: async (pageId) =>
      listMcpAgentActions(database, pageId),
    listPages: async () =>
      listPages(database).map((pageRecord) =>
        getStoredCollaborativePageState(database, pageRecord.id)
          ? (getStoredCollaborativePageState(
              database,
              pageRecord.id
            ) as PageAppState)
          : createEmptyPageState(pageRecord)
      ),
    recordAgentAction: async (record) => {
      recordMcpAgentAction(database, record)
      console.info(
        'cascadery.mcp.agent_action',
        JSON.stringify(record)
      )
    },
    logSecurityEvent: securityLogger,
    savePageState: async (state) => {
      saveStoredCollaborativePageState(database, {
        ...state,
        page: {
          ...state.page,
          settings: {
            ...state.page.settings,
            shareLinks: null,
          },
        },
      })
    },
  })

  return Response.json(response)
}

const getPageState = (
  database: ReturnType<typeof createDatabase>,
  pageId: string
) => {
  const pageRecord = getPageRecord(database, pageId)

  if (!pageRecord) return null

  const storedState = getStoredCollaborativePageState(database, pageId)

  return storedState
    ? (storedState as PageAppState)
    : createEmptyPageState(pageRecord)
}

const createEmptyPageState = (pageRecord: PageRecord): PageAppState => ({
  page: {
    ...createDefaultPageState({
      id: pageRecord.id,
      now: pageRecord.createdAt,
    }),
    title: pageRecord.title,
    updatedAt: pageRecord.updatedAt,
  },
  areas: [],
  assets: [],
})

const createGlmDecisionLogPatch = async (
  state: PageAppState,
  client: AgentClient,
  glmConfig: NonNullable<ReturnType<typeof getGlmProviderConfigFromEnv>>
): Promise<AgentPatch> => {
  const text = await createGlmDecisionLogText(
    {
      pageTitle: state.page.title,
      areas: state.areas
        .filter((area) => area.type !== 'image')
        .map((area) => ({
          id: area.id,
          text: area.text,
        })),
    },
    glmConfig
  )
  const maxY = state.areas.reduce(
    (currentMax, area) => Math.max(currentMax, area.y + area.height),
    80
  )

  return {
    schemaVersion: 1,
    id: `agent_patch_glm_${crypto.randomUUID()}`,
    pageId: state.page.id,
    source: {
      kind: 'mcp-agent',
      clientId: client.id,
      displayName: 'GLM',
    },
    operations: [
      {
        op: 'createArea',
        tempId: `agent_glm_decision_log_${Date.now()}`,
        area: {
          type: 'text',
          text,
          x: 120,
          y: maxY + 80,
          width: 420,
          height: 180,
          styles: {
            border: '1px solid #2563eb',
          },
        },
      },
    ],
    createdAt: new Date().toISOString(),
  }
}

const getClientRateLimitKey = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown-client'

const authorizeMcpRequest = (
  request: Request,
  database: ReturnType<typeof createDatabase>
):
  | {
      ok: true
      client?: AgentClient
      pageId?: string
    }
  | {
      ok: false
      pageId?: string
      reason: string
      tokenId?: string
    } => {
  const bearerToken = readBearerToken(request)

  if (!bearerToken) {
    if (
      process.env.TOOL_MCP_ALLOW_ANONYMOUS === 'true' &&
      isLoopbackRequest(request)
    ) {
      return { ok: true }
    }

    return {
      ok: false,
      reason: 'missing-token',
    }
  }

  const validation = validateMcpToken(database, bearerToken)

  if (!validation.ok) {
    return {
      ok: false,
      pageId: validation.pageId,
      reason: validation.reason,
      tokenId: validation.tokenId,
    }
  }

  return {
    ok: true,
    client: validation.client,
    pageId: validation.token.pageId,
  }
}

const readBearerToken = (request: Request) => {
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())

  return match?.[1] ?? null
}

const createUnauthorizedResponse = (reason: string) =>
  Response.json(createJsonRpcError(null, -32001, 'MCP authorization failed.'), {
    headers: {
      'WWW-Authenticate': `Bearer realm="cascadery-mcp", error="invalid_token", error_description="${reason}", resource_metadata="/api/mcp/.well-known"`,
    },
    status: 401,
  })

const isLoopbackRequest = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const host = request.headers.get('host') ?? new URL(request.url).host
  const hostname = host.split(':')[0]

  return [forwardedFor, realIp, hostname].some((value) =>
    value ? isLoopbackAddress(value.trim()) : false
  )
}

const isLoopbackAddress = (value: string) =>
  value === 'localhost' ||
  value === '127.0.0.1' ||
  value === '::1' ||
  value.startsWith('127.')

type McpRateLimitBucket = 'read' | 'suggest' | 'write'

export function createScopedMcpRateLimiters() {
  return {
    read: createFixedWindowRateLimiter(
      getScopedRateLimitConfigFromEnv('READ')
    ),
    suggest: createFixedWindowRateLimiter(
      getScopedRateLimitConfigFromEnv('SUGGEST')
    ),
    write: createFixedWindowRateLimiter(
      getScopedRateLimitConfigFromEnv('WRITE')
    ),
  }
}

const getRateLimitBucket = (scope: AgentScope): McpRateLimitBucket => {
  if (scope === 'page:write') return 'write'
  if (scope === 'page:suggest') return 'suggest'

  return 'read'
}

function getScopedRateLimitConfigFromEnv(
  scope: 'READ' | 'SUGGEST' | 'WRITE'
) {
  return getRateLimitConfigFromEnv({
    TOOL_MCP_RATE_LIMIT_MAX:
      process.env[`TOOL_MCP_${scope}_RATE_LIMIT_MAX`] ??
      process.env.TOOL_MCP_RATE_LIMIT_MAX,
    TOOL_MCP_RATE_LIMIT_WINDOW_MS:
      process.env[`TOOL_MCP_${scope}_RATE_LIMIT_WINDOW_MS`] ??
      process.env.TOOL_MCP_RATE_LIMIT_WINDOW_MS,
  })
}

const createJsonRpcError = (
  id: string | number | null,
  code: number,
  message: string
) => ({
  jsonrpc: MCP_JSON_RPC_VERSION,
  id,
  error: {
    code,
    message,
  },
})
