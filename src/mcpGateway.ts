import {
  extractAgentDecisions,
  extractAgentOpenQuestions,
  getAgentArea,
  getAgentPage,
  listAgentPages,
  searchAgentAreas,
  summarizeAgentPage,
  suggestDecisionLog,
  type AgentClient,
  type AgentPatch,
} from './agentInterface.ts'
import type { PageAppState } from './pagePersistence.ts'

export const MCP_JSON_RPC_VERSION = '2.0'

export type McpJsonRpcRequest = {
  jsonrpc: typeof MCP_JSON_RPC_VERSION
  id?: string | number | null
  method: string
  params?: unknown
}

export type McpJsonRpcResponse = {
  jsonrpc: typeof MCP_JSON_RPC_VERSION
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export type McpGatewayContext = {
  createAiDecisionLogPatch?: (
    state: PageAppState,
    client: AgentClient
  ) => Promise<AgentPatch>
  getPage: (pageId: string) => Promise<PageAppState | null>
  listPages: () => Promise<PageAppState[]>
}

const MCP_AGENT_CLIENT: AgentClient = {
  id: 'no-auth-mcp',
  displayName: 'No-auth MCP client',
  scopes: ['page:read', 'page:search', 'page:suggest'],
}

const toolDefinitions = [
  {
    name: 'list_pages',
    description: 'List Cascadery pages visible to the no-auth MCP endpoint.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_page',
    description: 'Get one Cascadery page as structured JSON.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'get_area',
    description: 'Get one Cascadery Area by stable id.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'areaId'],
      properties: {
        pageId: {
          type: 'string',
        },
        areaId: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'search_areas',
    description: 'Search Area ids and text within one Cascadery page.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'query'],
      properties: {
        pageId: {
          type: 'string',
        },
        query: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'summarize_page',
    description: 'Summarize page structure and extracted decision markers.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'extract_decisions',
    description: 'Extract lines prefixed with Decision: from text Areas.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'extract_open_questions',
    description:
      'Extract lines prefixed with Open question: or Question: from text Areas.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'suggest_decision_log',
    description: 'Return a deterministic decision-log patch without applying it.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'ai_suggest_decision_log',
    description: 'Use the configured GLM provider to return a decision-log patch.',
    inputSchema: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: {
          type: 'string',
        },
      },
    },
  },
]

export const handleMcpJsonRpcRequest = async (
  request: McpJsonRpcRequest,
  context: McpGatewayContext
): Promise<McpJsonRpcResponse> => {
  const id = request.id ?? null

  if (request.jsonrpc !== MCP_JSON_RPC_VERSION) {
    return errorResponse(id, -32600, 'Invalid JSON-RPC version.')
  }

  if (request.method === 'initialize') {
    return resultResponse(id, {
      protocolVersion: '2025-06-18',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'cascadery',
        version: 1,
      },
      auth: 'none',
      rateLimited: true,
    })
  }

  if (request.method === 'tools/list') {
    return resultResponse(id, {
      tools: toolDefinitions,
    })
  }

  if (request.method === 'tools/call') {
    return callTool(id, request.params, context)
  }

  return errorResponse(id, -32601, 'Method not found.')
}

const callTool = async (
  id: string | number | null,
  params: unknown,
  context: McpGatewayContext
) => {
  if (!isRecord(params) || typeof params.name !== 'string') {
    return errorResponse(id, -32602, 'Tool call params are invalid.')
  }

  const args = isRecord(params.arguments) ? params.arguments : {}

  if (params.name === 'list_pages') {
    return resultResponse(
      id,
      listAgentPages(await context.listPages(), MCP_AGENT_CLIENT)
    )
  }

  if (params.name === 'get_page') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, getAgentPage(state, MCP_AGENT_CLIENT))
  }

  if (params.name === 'get_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    const result = getAgentArea(
      state,
      typeof args.areaId === 'string' ? args.areaId : '',
      MCP_AGENT_CLIENT
    )

    if (!result.area) return areaNotFoundResponse(id)

    return resultResponse(id, result)
  }

  if (params.name === 'search_areas') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      searchAgentAreas(
        state,
        typeof args.query === 'string' ? args.query : '',
        MCP_AGENT_CLIENT
      )
    )
  }

  if (params.name === 'summarize_page') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, summarizeAgentPage(state, MCP_AGENT_CLIENT))
  }

  if (params.name === 'extract_decisions') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, extractAgentDecisions(state, MCP_AGENT_CLIENT))
  }

  if (params.name === 'extract_open_questions') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      extractAgentOpenQuestions(state, MCP_AGENT_CLIENT)
    )
  }

  if (params.name === 'suggest_decision_log') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      suggestDecisionLog(state, MCP_AGENT_CLIENT)
    )
  }

  if (params.name === 'ai_suggest_decision_log') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)
    if (!context.createAiDecisionLogPatch) {
      return errorResponse(id, -32010, 'GLM provider is not configured.')
    }

    return resultResponse(
      id,
      await context.createAiDecisionLogPatch(state, MCP_AGENT_CLIENT)
    )
  }

  return errorResponse(id, -32601, 'Tool not found.')
}

const getPageFromArgs = async (
  args: Record<string, unknown>,
  context: McpGatewayContext
) => {
  if (typeof args.pageId !== 'string' || !args.pageId.trim()) {
    return null
  }

  return context.getPage(args.pageId)
}

const resultResponse = (
  id: string | number | null,
  result: unknown
): McpJsonRpcResponse => ({
  jsonrpc: MCP_JSON_RPC_VERSION,
  id,
  result,
})

const errorResponse = (
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): McpJsonRpcResponse => ({
  jsonrpc: MCP_JSON_RPC_VERSION,
  id,
  error: {
    code,
    message,
    ...(data === undefined ? {} : { data }),
  },
})

const pageNotFoundResponse = (id: string | number | null) =>
  errorResponse(id, -32004, 'Page not found.')

const areaNotFoundResponse = (id: string | number | null) =>
  errorResponse(id, -32005, 'Area not found.')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
