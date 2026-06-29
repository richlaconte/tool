import type { AgentClient, AgentPatch } from '../../../src/agentInterface'
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
import { getStoredCollaborativePageState } from '../../../src/server/collaborativeStorage'
import { createDefaultPageState, type PageAppState } from '../../../src/pagePersistence'
import {
  listMcpAgentActions,
  recordMcpAgentAction,
} from '../../../src/server/mcpAgentActions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const rateLimiter = createFixedWindowRateLimiter(
  getRateLimitConfigFromEnv()
)

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

  const rateLimit = rateLimiter.check(getClientRateLimitKey(request))

  if (!rateLimit.ok) {
    return Response.json(
      createJsonRpcError(null, -32029, 'MCP rate limit exceeded.'),
      {
        headers: {
          'Retry-After': `${rateLimit.retryAfterSeconds}`,
          'X-RateLimit-Limit': `${rateLimit.limit}`,
          'X-RateLimit-Remaining': `${rateLimit.remaining}`,
          'X-RateLimit-Reset': `${Math.ceil(rateLimit.resetAt / 1000)}`,
        },
        status: 429,
      }
    )
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

  const database = createDatabase()
  const glmConfig = getGlmProviderConfigFromEnv()
  const response = await handleMcpJsonRpcRequest(rpcRequest, {
    createAiDecisionLogPatch: glmConfig
      ? (state, client) =>
          createGlmDecisionLogPatch(state, client, glmConfig)
      : undefined,
    createActionId: () => `mcp_action_${crypto.randomUUID()}`,
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
  })

  return Response.json(response, {
    headers: {
      'X-RateLimit-Limit': `${rateLimit.limit}`,
      'X-RateLimit-Remaining': `${rateLimit.remaining}`,
      'X-RateLimit-Reset': `${Math.ceil(rateLimit.resetAt / 1000)}`,
    },
  })
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
