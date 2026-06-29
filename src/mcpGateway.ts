import {
  createAgentAreaPatch,
  deleteAgentAreaPatch,
  dryRunAgentPatch,
  extractAgentDecisions,
  extractAgentOpenQuestions,
  getAgentArea,
  getAgentPage,
  listAgentPages,
  moveAgentAreaPatch,
  nestAgentAreaPatch,
  searchAgentAreas,
  summarizeAgentPage,
  suggestAreaUpdates,
  suggestAreas,
  suggestBoardOrganization,
  suggestDecisionLog,
  suggestImplementationMap,
  updateAgentAreaPatch,
  updateAgentAreaStylesPatch,
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

export type McpAgentActionRecord = {
  id: string
  pageId: string | null
  toolName: string
  clientId: string
  clientDisplayName: string
  operationCount: number
  createdAt: string
  result: 'success' | 'error'
  errorCode?: number
}

type McpResourceDefinition = {
  uri: string
  name: string
  description: string
  mimeType: string
}

export type McpGatewayContext = {
  createAiDecisionLogPatch?: (
    state: PageAppState,
    client: AgentClient
  ) => Promise<AgentPatch>
  createActionId?: () => string
  getPage: (pageId: string) => Promise<PageAppState | null>
  listAgentActions?: (pageId: string) => Promise<McpAgentActionRecord[]>
  listPages: () => Promise<PageAppState[]>
  now?: () => string
  recordAgentAction?: (record: McpAgentActionRecord) => Promise<void>
}

const MCP_AGENT_CLIENT: AgentClient = {
  id: 'no-auth-mcp',
  displayName: 'No-auth MCP client',
  scopes: ['page:read', 'page:search', 'page:suggest'],
}

const CASCADERY_RESOURCE_PREFIX = 'cascadery://pages'
const JSON_MIME_TYPE = 'application/json'

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
    name: 'suggest_areas',
    description: 'Return a patch proposing useful new Areas without applying it.',
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
    name: 'suggest_area_updates',
    description: 'Return a patch proposing Area style updates without applying it.',
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
    name: 'suggest_board_organization',
    description:
      'Return a patch proposing a readable board arrangement without applying it.',
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
    name: 'suggest_implementation_map',
    description:
      'Return a patch proposing an implementation map without applying it.',
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
  {
    name: 'create_area',
    description: 'Return a dry-run patch for creating a text Area.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'text', 'x', 'y', 'width', 'height'],
      properties: {
        pageId: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
        width: {
          type: 'number',
        },
        height: {
          type: 'number',
        },
        parentId: {
          type: ['string', 'null'],
        },
        styles: {
          type: 'object',
        },
      },
    },
  },
  {
    name: 'update_area',
    description: 'Return a dry-run patch for updating Area text or geometry.',
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
        text: {
          type: 'string',
        },
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
        width: {
          type: 'number',
        },
        height: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'update_area_styles',
    description: 'Return a dry-run patch for updating Area CSS styles.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'areaId', 'styles'],
      properties: {
        pageId: {
          type: 'string',
        },
        areaId: {
          type: 'string',
        },
        styles: {
          type: 'object',
        },
      },
    },
  },
  {
    name: 'move_area',
    description: 'Return a dry-run patch for moving an Area.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'areaId', 'x', 'y'],
      properties: {
        pageId: {
          type: 'string',
        },
        areaId: {
          type: 'string',
        },
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'nest_area',
    description: 'Return a dry-run patch for nesting or unnesting an Area.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'areaId', 'parentId'],
      properties: {
        pageId: {
          type: 'string',
        },
        areaId: {
          type: 'string',
        },
        parentId: {
          type: ['string', 'null'],
        },
      },
    },
  },
  {
    name: 'delete_area',
    description: 'Return a dry-run patch for deleting an Area.',
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
    name: 'apply_patch',
    description:
      'Dry-run validate an agent patch. Direct apply is not enabled on the no-auth endpoint.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'patch'],
      properties: {
        pageId: {
          type: 'string',
        },
        patch: {
          type: 'object',
        },
        dryRun: {
          type: 'boolean',
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
        resources: {},
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

  if (request.method === 'resources/list') {
    return resultResponse(id, {
      resources: createResourceDefinitions(
        (await context.listPages()).filter(isPageMcpEnabled)
      ),
    })
  }

  if (request.method === 'resources/read') {
    return readResource(id, request.params, context)
  }

  if (request.method === 'tools/call') {
    const response = await callTool(id, request.params, context)
    await recordMcpToolAction(request.params, response, context)

    return response
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
      listAgentPages(
        (await context.listPages()).filter(isPageMcpEnabled),
        MCP_AGENT_CLIENT
      )
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

  if (params.name === 'suggest_areas') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, suggestAreas(state, MCP_AGENT_CLIENT))
  }

  if (params.name === 'suggest_area_updates') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, suggestAreaUpdates(state, MCP_AGENT_CLIENT))
  }

  if (params.name === 'suggest_board_organization') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      suggestBoardOrganization(state, MCP_AGENT_CLIENT)
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

  if (params.name === 'suggest_implementation_map') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      suggestImplementationMap(state, MCP_AGENT_CLIENT)
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

  if (params.name === 'create_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        createAgentAreaPatch(state, MCP_AGENT_CLIENT, {
          text: typeof args.text === 'string' ? args.text : '',
          x: readNumber(args.x),
          y: readNumber(args.y),
          width: readNumber(args.width),
          height: readNumber(args.height),
          parentId: readNullableString(args.parentId),
          styles: readStyles(args.styles),
        })
      )
    )
  }

  if (params.name === 'update_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        updateAgentAreaPatch(
          state,
          MCP_AGENT_CLIENT,
          typeof args.areaId === 'string' ? args.areaId : '',
          readAreaPatch(args)
        )
      )
    )
  }

  if (params.name === 'update_area_styles') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        updateAgentAreaStylesPatch(
          state,
          MCP_AGENT_CLIENT,
          typeof args.areaId === 'string' ? args.areaId : '',
          readStyles(args.styles)
        )
      )
    )
  }

  if (params.name === 'move_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        moveAgentAreaPatch(
          state,
          MCP_AGENT_CLIENT,
          typeof args.areaId === 'string' ? args.areaId : '',
          readNumber(args.x),
          readNumber(args.y)
        )
      )
    )
  }

  if (params.name === 'nest_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        nestAgentAreaPatch(
          state,
          MCP_AGENT_CLIENT,
          typeof args.areaId === 'string' ? args.areaId : '',
          readNullableString(args.parentId)
        )
      )
    )
  }

  if (params.name === 'delete_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        deleteAgentAreaPatch(
          state,
          MCP_AGENT_CLIENT,
          typeof args.areaId === 'string' ? args.areaId : ''
        )
      )
    )
  }

  if (params.name === 'apply_patch') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)
    if (args.dryRun === false) {
      return errorResponse(
        id,
        -32011,
        'Patch application is not enabled for the no-auth MCP endpoint.'
      )
    }

    return resultResponse(
      id,
      createDryRunPatchResult(state, args.patch as AgentPatch)
    )
  }

  return errorResponse(id, -32601, 'Tool not found.')
}

const recordMcpToolAction = async (
  params: unknown,
  response: McpJsonRpcResponse,
  context: McpGatewayContext
) => {
  if (
    !context.recordAgentAction ||
    !isRecord(params) ||
    typeof params.name !== 'string'
  ) {
    return
  }

  const args = isRecord(params.arguments) ? params.arguments : {}
  const pageId = typeof args.pageId === 'string' ? args.pageId : null

  await context.recordAgentAction({
    id: context.createActionId?.() ?? createDefaultMcpActionId(),
    pageId,
    toolName: params.name,
    clientId: MCP_AGENT_CLIENT.id,
    clientDisplayName: MCP_AGENT_CLIENT.displayName,
    operationCount: getMcpToolOperationCount(response.result),
    createdAt: context.now?.() ?? new Date().toISOString(),
    result: response.error ? 'error' : 'success',
    ...(response.error ? { errorCode: response.error.code } : {}),
  })
}

const getMcpToolOperationCount = (result: unknown) => {
  if (
    isRecord(result) &&
    Array.isArray(result.operations)
  ) {
    return result.operations.length
  }

  if (
    isRecord(result) &&
    isRecord(result.patch) &&
    Array.isArray(result.patch.operations)
  ) {
    return result.patch.operations.length
  }

  return 0
}

const createDefaultMcpActionId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `mcp_action_${crypto.randomUUID()}`
  }

  return `mcp_action_${Date.now()}`
}

const readResource = async (
  id: string | number | null,
  params: unknown,
  context: McpGatewayContext
) => {
  if (!isRecord(params) || typeof params.uri !== 'string') {
    return errorResponse(id, -32602, 'Resource read params are invalid.')
  }

  if (params.uri === CASCADERY_RESOURCE_PREFIX) {
    return resourceResponse(
      id,
      params.uri,
      listAgentPages(
        (await context.listPages()).filter(isPageMcpEnabled),
        MCP_AGENT_CLIENT
      )
    )
  }

  const parsedResource = parsePageResourceUri(params.uri)

  if (!parsedResource) {
    return resourceNotFoundResponse(id)
  }

  const state = await context.getPage(parsedResource.pageId)

  if (!state || !isPageMcpEnabled(state)) return pageNotFoundResponse(id)

  const pageResource = getAgentPage(state, MCP_AGENT_CLIENT)

  if (parsedResource.kind === 'page') {
    return resourceResponse(id, params.uri, pageResource)
  }

  if (parsedResource.kind === 'areas') {
    return resourceResponse(id, params.uri, {
      schemaVersion: 1,
      page: {
        id: state.page.id,
        title: state.page.title,
      },
      areas: pageResource.areas,
      links: pageResource.links,
      permissionMode: pageResource.permissionMode,
    })
  }

  if (parsedResource.kind === 'assets') {
    return resourceResponse(id, params.uri, {
      schemaVersion: 1,
      page: {
        id: state.page.id,
        title: state.page.title,
      },
      assets: pageResource.assets,
      permissionMode: pageResource.permissionMode,
    })
  }

  return resourceResponse(id, params.uri, {
    schemaVersion: 1,
    page: {
      id: state.page.id,
      title: state.page.title,
    },
    actions: context.listAgentActions
      ? await context.listAgentActions(state.page.id)
      : [],
    permissionMode: pageResource.permissionMode,
  })
}

const createResourceDefinitions = (
  states: PageAppState[]
): McpResourceDefinition[] => [
  {
    uri: CASCADERY_RESOURCE_PREFIX,
    name: 'Cascadery pages',
    description: 'List Cascadery pages visible to this MCP client.',
    mimeType: JSON_MIME_TYPE,
  },
  ...states.flatMap((state) => [
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}`,
      name: `${state.page.title} page`,
      description: 'Full Cascadery page context.',
      mimeType: JSON_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/areas`,
      name: `${state.page.title} Areas`,
      description: 'Text and image Areas on this Cascadery page.',
      mimeType: JSON_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/assets`,
      name: `${state.page.title} assets`,
      description: 'Asset metadata for this Cascadery page.',
      mimeType: JSON_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/agent-actions`,
      name: `${state.page.title} agent actions`,
      description: 'Agent action records for this Cascadery page.',
      mimeType: JSON_MIME_TYPE,
    },
  ]),
]

const parsePageResourceUri = (uri: string):
  | {
      pageId: string
      kind: 'page' | 'areas' | 'assets' | 'agent-actions'
    }
  | null => {
  const match = /^cascadery:\/\/pages\/([^/]+)(?:\/([^/]+))?$/.exec(uri)

  if (!match) return null

  const pageId = match[1]
  const suffix = match[2]

  if (!suffix) {
    return {
      pageId,
      kind: 'page',
    }
  }

  if (suffix !== 'areas' && suffix !== 'assets' && suffix !== 'agent-actions') {
    return null
  }

  return {
    pageId,
    kind: suffix,
  }
}

const resourceResponse = (
  id: string | number | null,
  uri: string,
  payload: unknown
) =>
  resultResponse(id, {
    contents: [
      {
        uri,
        mimeType: JSON_MIME_TYPE,
        text: JSON.stringify(payload),
      },
    ],
  })

const createDryRunPatchResult = (
  state: PageAppState,
  patch: AgentPatch
) =>
  dryRunAgentPatch(state, patch, MCP_AGENT_CLIENT, {
    mode: 'suggest',
  })

const getPageFromArgs = async (
  args: Record<string, unknown>,
  context: McpGatewayContext
) => {
  if (typeof args.pageId !== 'string' || !args.pageId.trim()) {
    return null
  }

  const state = await context.getPage(args.pageId)

  return state && isPageMcpEnabled(state) ? state : null
}

const isPageMcpEnabled = (state: PageAppState) =>
  state.page.settings.mcp.enabled

const readAreaPatch = (args: Record<string, unknown>) => {
  const patch: Record<string, string | number> = {}

  if (typeof args.text === 'string') {
    patch.text = args.text
  }

  for (const property of ['x', 'y', 'width', 'height']) {
    if (Number.isFinite(args[property])) {
      patch[property] = args[property] as number
    }
  }

  return patch
}

const readStyles = (value: unknown) => {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

const readNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN

const readNullableString = (value: unknown) =>
  typeof value === 'string' ? value : null

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

const resourceNotFoundResponse = (id: string | number | null) =>
  errorResponse(id, -32006, 'Resource not found.')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
