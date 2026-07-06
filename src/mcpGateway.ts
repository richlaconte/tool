// MCP gateway for Cascadery pages.
//
// Protocol currency (2026-07-28 revision): the gateway is stateless per
// request — clients on the 2026-07-28 revision can call any method without
// an `initialize` round-trip, optionally routing via the `Mcp-Method` and
// `Mcp-Name` HTTP headers. `2025-06-18` initialize flows keep working during
// a documented transition window. The deprecated protocol features (roots,
// sampling, MCP logging) were never implemented by this gateway, so the
// 2026-07-28 deprecations cost nothing here.
import {
  getAreaMetadata,
  isAreaStatus,
  setAreaMetadata,
  type AreaStatus,
} from './areaMetadata.ts'
import {
  applyAgentPatch,
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
  updateAgentAreaStatusPatch,
  updateAgentAreaStylesPatch,
  MAX_IMPORT_OPERATIONS,
  type AgentClient,
  type AgentPatch,
  type AgentScope,
} from './agentInterface.ts'
import {
  createJournalEntry,
  pruneJournalEntries,
} from './agentJournal.ts'
import { parseCodeReference, type ResolvedCodeSnippet } from './codeReferences.ts'
import {
  MCP_APP_HTML_MIME_TYPE,
  renderMcpAppHtml,
} from './mcpAppTemplate.ts'
import { createAgentHandoffBrief } from './agentHandoff.ts'
import { compileSddBundle } from './sddExport.ts'
import { buildSddImportPatch } from './sddImport.ts'
import {
  exportPageAsJsonCanvas,
  exportPageAsMarkdown,
  JSON_CANVAS_MIME_TYPE,
  MARKDOWN_MIME_TYPE,
} from './pageExports.ts'
import type { PageAppState } from './pagePersistence.ts'

export const MCP_JSON_RPC_VERSION = '2.0'

// 2026-07-28 is the stateless-core release-candidate revision; 2025-06-18
// stays supported as the documented transition window for slower agent hosts.
export const MCP_PROTOCOL_VERSION_2026 = '2026-07-28'
export const MCP_PROTOCOL_VERSION_2025 = '2025-06-18'
export const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSION_2026,
  MCP_PROTOCOL_VERSION_2025,
] as const

// Pages are live-collaborative, so read caches must stay short. Token
// revocation is re-checked on every request, so a cached window can never
// outlive a revoked token by more than this TTL — err low (5s).
export const MCP_READ_CACHE_TTL_MS = 5_000
export const MCP_READ_CACHE_SCOPE = 'private'

// Supported version requested → echo it back; unknown or missing → answer
// with the newest revision this gateway speaks (MCP negotiation rule).
export const negotiateMcpProtocolVersion = (requested: unknown): string =>
  typeof requested === 'string' &&
  (SUPPORTED_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_PROTOCOL_VERSION_2026

export type McpRoutingHeaders = {
  method: string | null
  toolName: string | null
}

export const readMcpRoutingHeaders = (
  getHeader: (name: string) => string | null
): McpRoutingHeaders => ({
  method: normalizeHeaderValue(getHeader('mcp-method') ?? getHeader('Mcp-Method')),
  toolName: normalizeHeaderValue(getHeader('mcp-name') ?? getHeader('Mcp-Name')),
})

export type ResolveMcpRequestResult =
  | { ok: true; request: McpJsonRpcRequest }
  | { ok: false; error: string }

// Merge the 2026-07-28 routing headers with the JSON body. Header-routed
// requests may omit `method` (and `params.name` for tools/call) from the
// body; when both are present they must agree.
export const resolveMcpRequest = (
  body: unknown,
  headers: McpRoutingHeaders
): ResolveMcpRequestResult => {
  const bodyRecord = isRecord(body) ? body : {}

  if (
    bodyRecord.jsonrpc !== undefined &&
    bodyRecord.jsonrpc !== MCP_JSON_RPC_VERSION
  ) {
    return {
      ok: false,
      error: 'Invalid JSON-RPC version.',
    }
  }

  const bodyMethod =
    typeof bodyRecord.method === 'string' ? bodyRecord.method : null

  if (headers.method && bodyMethod && headers.method !== bodyMethod) {
    return {
      ok: false,
      error: 'Mcp-Method header does not match the request body method.',
    }
  }

  const method = bodyMethod ?? headers.method

  if (!method) {
    return {
      ok: false,
      error: 'Request must carry a method in the body or Mcp-Method header.',
    }
  }

  const params = isRecord(bodyRecord.params) ? bodyRecord.params : undefined

  if (method === 'tools/call' && headers.toolName) {
    const bodyToolName =
      params && typeof params.name === 'string' ? params.name : null

    if (bodyToolName && bodyToolName !== headers.toolName) {
      return {
        ok: false,
        error: 'Mcp-Name header does not match the request body tool name.',
      }
    }

    return {
      ok: true,
      request: {
        jsonrpc: MCP_JSON_RPC_VERSION,
        id: readRequestId(bodyRecord.id),
        method,
        params: {
          ...(params ?? {}),
          name: bodyToolName ?? headers.toolName,
        },
      },
    }
  }

  return {
    ok: true,
    request: {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: readRequestId(bodyRecord.id),
      method,
      ...(bodyRecord.params === undefined ? {} : { params: bodyRecord.params }),
    },
  }
}

const normalizeHeaderValue = (value: string | null) => {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

const readRequestId = (value: unknown): string | number | null =>
  typeof value === 'string' || typeof value === 'number' ? value : null

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

export type McpGatewaySecurityEvent = {
  type: 'mcp-auth-denied'
  clientId?: string
  pageId?: string
  reason: string
  retryAfterSeconds?: number
  scope?: AgentScope
  tokenId?: string
  toolName?: string
}

type McpResourceDefinition = {
  uri: string
  name: string
  description: string
  mimeType: string
}

export type McpTaskStatus = 'working' | 'completed' | 'failed' | 'cancelled'

export type McpGatewayTaskRecord = {
  id: string
  pageId: string
  tokenId: string | null
  toolName: string
  status: McpTaskStatus
  createdAt: string
  updatedAt: string
  result: unknown
  error: string | null
}

export type McpGatewayTaskStore = {
  create: (task: {
    pageId: string
    tokenId: string | null
    toolName: string
  }) => Promise<McpGatewayTaskRecord>
  get: (taskId: string) => Promise<McpGatewayTaskRecord | null>
  cancel: (taskId: string) => Promise<McpGatewayTaskRecord | null>
  complete: (taskId: string, result: unknown) => Promise<void>
  fail: (taskId: string, message: string) => Promise<void>
  listForPage: (pageId: string) => Promise<McpGatewayTaskRecord[]>
}

export type McpGatewayContext = {
  authorizedPageId?: string
  checkToolRateLimit?: (
    scope: AgentScope
  ) =>
    | { ok: true }
    | { ok: false; retryAfterSeconds: number }
  checkJournalRateLimit?: (
    pageId: string
  ) =>
    | { ok: true }
    | { ok: false; retryAfterSeconds: number }
  createAiDecisionLogPatch?: (
    state: PageAppState,
    client: AgentClient
  ) => Promise<AgentPatch>
  createActionId?: () => string
  createJournalId?: () => string
  client?: AgentClient
  getPage: (pageId: string) => Promise<PageAppState | null>
  listAgentActions?: (pageId: string) => Promise<McpAgentActionRecord[]>
  listPages: () => Promise<PageAppState[]>
  logSecurityEvent?: (event: McpGatewaySecurityEvent) => void
  now?: () => string
  recordAgentAction?: (record: McpAgentActionRecord) => Promise<void>
  // Tasks extension: when present, provider-backed tools return task
  // handles and tasks/get / tasks/cancel drive the lifecycle.
  taskStore?: McpGatewayTaskStore
  // Fail-closed check for polled tasks: false when the minting token has
  // been revoked or expired since the task was created.
  isTokenActive?: (tokenId: string) => Promise<boolean>
  resolveEvidence?: (
    target: string
  ) => Promise<ResolvedCodeSnippet | null>
  savePageState?: (state: PageAppState) => Promise<void>
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
    minimumScope: 'page:read',
    description: 'List Cascadery pages visible to the no-auth MCP endpoint.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_page',
    minimumScope: 'page:read',
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
    minimumScope: 'page:read',
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
    minimumScope: 'page:search',
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
    minimumScope: 'page:read',
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
    minimumScope: 'page:read',
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
    minimumScope: 'page:read',
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
    minimumScope: 'page:suggest',
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
    minimumScope: 'page:suggest',
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
    minimumScope: 'page:suggest',
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
    minimumScope: 'page:suggest',
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
    minimumScope: 'page:suggest',
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
    minimumScope: 'page:suggest',
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
    minimumScope: 'page:write',
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
    minimumScope: 'page:write',
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
    minimumScope: 'page:write',
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
    name: 'append_journal_entry',
    minimumScope: 'page:suggest',
    description:
      'Append a visible progress note to the page agent journal without changing canvas content.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'text'],
      properties: {
        pageId: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
        taskAreaId: {
          type: ['string', 'null'],
        },
      },
    },
  },
  {
    name: 'update_area_status',
    minimumScope: 'page:write',
    description:
      'Return or auto-apply a status-only Area metadata patch for task progress.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'areaId', 'status'],
      properties: {
        pageId: {
          type: 'string',
        },
        areaId: {
          type: 'string',
        },
        status: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'claim_task',
    minimumScope: 'page:write',
    description:
      'Assign an unclaimed task Area to the calling agent and mark it in progress.',
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
    name: 'move_area',
    minimumScope: 'page:write',
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
    minimumScope: 'page:write',
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
    minimumScope: 'page:write',
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
    minimumScope: 'page:write',
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
  {
    name: 'export_sdd',
    minimumScope: 'page:read',
    description:
      'Compile the page into spec.md, plan.md, and tasks.md Markdown for spec-driven development.',
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
    name: 'import_sdd',
    minimumScope: 'page:suggest',
    description:
      'Turn spec/plan/tasks Markdown into a reviewable patch that lays it out as Areas. Never applies directly.',
    inputSchema: {
      type: 'object',
      required: ['pageId', 'markdown'],
      properties: {
        pageId: {
          type: 'string',
        },
        markdown: {
          type: 'string',
        },
      },
    },
  },
]

// Read-class tools whose successful responses carry cache metadata for
// 2026-07-28 clients. Suggest and write tools intentionally carry none —
// their results must never be replayed from a cache.
const READ_CACHE_TOOL_NAMES = new Set([
  'list_pages',
  'get_page',
  'get_area',
  'search_areas',
  'summarize_page',
  'extract_decisions',
  'extract_open_questions',
  'export_sdd',
])

// Apps extension: one declared template — the page outline and pending
// proposal review, rendered from the `app` page resource. The view is
// read-only state plus existing review actions; it adds no mutation paths.
export const MCP_APP_TEMPLATE_DESCRIPTOR = {
  name: 'cascadery-page-outline',
  description:
    'Page outline and pending agent proposals for one Cascadery page.',
  resourceUri: `${CASCADERY_RESOURCE_PREFIX}/{pageId}/app`,
  mimeType: 'text/html',
  sandbox: 'iframe',
} as const

const withReadCacheMetadata = (
  params: unknown,
  response: McpJsonRpcResponse
): McpJsonRpcResponse => {
  if (
    response.error ||
    !isRecord(response.result) ||
    !isRecord(params) ||
    typeof params.name !== 'string' ||
    !READ_CACHE_TOOL_NAMES.has(params.name)
  ) {
    return response
  }

  return {
    ...response,
    result: {
      ...response.result,
      _meta: {
        ...(isRecord(response.result._meta) ? response.result._meta : {}),
        cache: {
          ttlMs: MCP_READ_CACHE_TTL_MS,
          cacheScope: MCP_READ_CACHE_SCOPE,
        },
      },
    },
  }
}

export const handleMcpJsonRpcRequest = async (
  request: McpJsonRpcRequest,
  context: McpGatewayContext
): Promise<McpJsonRpcResponse> => {
  const id = request.id ?? null

  if (request.jsonrpc !== MCP_JSON_RPC_VERSION) {
    return errorResponse(id, -32600, 'Invalid JSON-RPC version.')
  }

  if (request.method === 'initialize') {
    const protocolVersion = negotiateMcpProtocolVersion(
      isRecord(request.params) ? request.params.protocolVersion : undefined
    )

    return resultResponse(id, {
      protocolVersion,
      capabilities: {
        tools: {},
        resources: {},
      },
      ...(protocolVersion === MCP_PROTOCOL_VERSION_2026
        ? {
            extensions: {
              tasks: {},
              apps: {
                templates: [MCP_APP_TEMPLATE_DESCRIPTOR],
              },
            },
          }
        : {}),
      serverInfo: {
        name: 'cascadery',
        version: 1,
      },
      auth: 'none',
      rateLimited: true,
    })
  }

  if (request.method === 'tasks/get') {
    return getTask(id, request.params, context)
  }

  if (request.method === 'tasks/cancel') {
    return cancelTask(id, request.params, context)
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
    const response = withReadCacheMetadata(
      request.params,
      await callTool(id, request.params, context)
    )
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
  const toolDefinition = getToolDefinition(params.name)

  if (!toolDefinition) {
    return errorResponse(id, -32601, 'Tool not found.')
  }

  const authorization = authorizeMcpAccess({
    args,
    context,
    pageId: typeof args.pageId === 'string' ? args.pageId : undefined,
    scope: toolDefinition.minimumScope,
    toolName: params.name,
  })

  if (!authorization.ok) {
    return authorization.response(id)
  }

  const client = getMcpClient(context)

  if (params.name === 'list_pages') {
    return resultResponse(
      id,
      listAgentPages(
        filterVisiblePages(await context.listPages(), context),
        client
      )
    )
  }

  if (params.name === 'get_page') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      await withResolvedEvidence(getAgentPage(state, client), context)
    )
  }

  if (params.name === 'get_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    const result = getAgentArea(
      state,
      typeof args.areaId === 'string' ? args.areaId : '',
      client
    )

    if (!result.area) return areaNotFoundResponse(id)

    return resultResponse(
      id,
      result.area
        ? {
            ...result,
            area: await withResolvedEvidenceForArea(
              result.area,
              context
            ),
          }
        : result
    )
  }

  if (params.name === 'search_areas') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      searchAgentAreas(
        state,
        typeof args.query === 'string' ? args.query : '',
        client
      )
    )
  }

  if (params.name === 'summarize_page') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, summarizeAgentPage(state, client))
  }

  if (params.name === 'extract_decisions') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, extractAgentDecisions(state, client))
  }

  if (params.name === 'extract_open_questions') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      extractAgentOpenQuestions(state, client)
    )
  }

  if (params.name === 'suggest_areas') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, suggestAreas(state, client))
  }

  if (params.name === 'suggest_area_updates') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, suggestAreaUpdates(state, client))
  }

  if (params.name === 'suggest_board_organization') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      suggestBoardOrganization(state, client)
    )
  }

  if (params.name === 'suggest_decision_log') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      suggestDecisionLog(state, client)
    )
  }

  if (params.name === 'suggest_implementation_map') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      suggestImplementationMap(state, client)
    )
  }

  if (params.name === 'ai_suggest_decision_log') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)
    if (!context.createAiDecisionLogPatch) {
      return errorResponse(id, -32010, 'GLM provider is not configured.')
    }

    // Tasks extension: provider-backed latency returns a task handle when a
    // task store is configured. Fast tools keep returning results directly.
    if (context.taskStore) {
      const task = await context.taskStore.create({
        pageId: state.page.id,
        tokenId: context.client?.id ?? null,
        toolName: params.name,
      })

      void runAiDecisionLogTask(state, client, context, task.id)

      return resultResponse(id, {
        schemaVersion: 1,
        task: {
          taskId: task.id,
          status: task.status,
          createdAt: task.createdAt,
          pollIntervalMs: 1000,
        },
      })
    }

    return resultResponse(
      id,
      await context.createAiDecisionLogPatch(state, client)
    )
  }

  if (params.name === 'create_area') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(
      id,
      createDryRunPatchResult(
        state,
        createAgentAreaPatch(state, client, {
          text: typeof args.text === 'string' ? args.text : '',
          x: readNumber(args.x),
          y: readNumber(args.y),
          width: readNumber(args.width),
          height: readNumber(args.height),
          parentId: readNullableString(args.parentId),
          styles: readStyles(args.styles),
        }),
        context
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
          client,
          typeof args.areaId === 'string' ? args.areaId : '',
          readAreaPatch(args)
        ),
        context
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
          client,
          typeof args.areaId === 'string' ? args.areaId : '',
          readStyles(args.styles)
        ),
        context
      )
    )
  }

  if (params.name === 'append_journal_entry') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    const rateLimit = context.checkJournalRateLimit?.(state.page.id) ?? {
      ok: true as const,
    }

    if (!rateLimit.ok) {
      return errorResponse(
        id,
        -32029,
        'Agent journal rate limit exceeded.',
        {
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }
      )
    }

    const result = createJournalEntry({
      actorKind: 'agent',
      actorName: client.displayName,
      createId: context.createJournalId,
      knownAreaIds: state.areas.map((area) => area.id),
      now: context.now?.() ?? new Date().toISOString(),
      taskAreaId: readNullableString(args.taskAreaId),
      text: typeof args.text === 'string' ? args.text : '',
    })

    if (!result.ok) {
      return errorResponse(id, -32602, result.error)
    }

    if (!context.savePageState) {
      return errorResponse(id, -32012, 'Page journal writes are not configured.')
    }

    await context.savePageState({
      ...state,
      journal: pruneJournalEntries([
        ...(state.journal ?? []),
        result.entry,
      ]),
    })

    return resultResponse(id, {
      schemaVersion: 1,
      appended: true,
      entry: result.entry,
      warnings: result.warnings,
    })
  }

  if (params.name === 'update_area_status') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    const status = typeof args.status === 'string' ? args.status : ''
    if (!isAreaStatus(status)) {
      return errorResponse(id, -32602, 'Area status is invalid.')
    }

    const patch = updateAgentAreaStatusPatch(
      state,
      client,
      typeof args.areaId === 'string' ? args.areaId : '',
      status as AreaStatus,
      {
        createPatchId: () =>
          `agent_patch_status_${context.createActionId?.() ?? Date.now()}`,
        now: context.now?.() ?? new Date().toISOString(),
      }
    )

    if (!state.page.settings.mcp.autoAcceptStatusUpdates) {
      return resultResponse(id, createDryRunPatchResult(state, patch, context))
    }

    if (!context.savePageState) {
      return errorResponse(id, -32012, 'Page status writes are not configured.')
    }

    const result = await applyAutoAcceptedStatusPatch(state, patch, context)
    if (!result.ok) return errorResponse(id, -32602, result.errors.join(' '))

    await context.savePageState(result.state)

    return resultResponse(id, {
      schemaVersion: 1,
      applied: true,
      auditRecord: result.auditRecord,
      patch,
    })
  }

  if (params.name === 'claim_task') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    if (!context.savePageState) {
      return errorResponse(id, -32012, 'Page task writes are not configured.')
    }

    const areaId = typeof args.areaId === 'string' ? args.areaId : ''
    const area = state.areas.find((candidate) => candidate.id === areaId)

    if (!area) {
      return errorResponse(id, -32602, 'Task Area was not found.')
    }

    const metadata = getAreaMetadata(area)
    if (metadata.kind !== 'task') {
      return errorResponse(id, -32602, 'Area is not a task.')
    }

    if (metadata.assignee) {
      return errorResponse(
        id,
        -32031,
        `Task is already claimed by ${metadata.assignee.name}.`,
        {
          assignee: metadata.assignee,
        }
      )
    }

    const now = context.now?.() ?? new Date().toISOString()
    const assignee = {
      kind: 'agent' as const,
      name: client.displayName,
    }
    const nextAreas = state.areas.map((candidate) =>
      candidate.id === area.id
        ? {
            ...setAreaMetadata(candidate, {
              assignee,
              status: 'in-progress',
            }),
            updatedAt: now,
          }
        : candidate
    )
    const journalResult = createJournalEntry({
      actorKind: 'agent',
      actorName: client.displayName,
      createId: context.createJournalId,
      knownAreaIds: state.areas.map((candidate) => candidate.id),
      now,
      taskAreaId: area.id,
      text: `${client.displayName} claimed "${getAreaJournalLabel(area)}".`,
    })
    const nextState: PageAppState = {
      ...state,
      areas: nextAreas,
      journal: journalResult.ok
        ? pruneJournalEntries([
            ...(state.journal ?? []),
            journalResult.entry,
          ])
        : state.journal,
    }

    await context.savePageState(nextState)

    return resultResponse(id, {
      schemaVersion: 1,
      claimed: true,
      areaId: area.id,
      assignee,
      status: 'in-progress',
      warnings: journalResult.ok ? journalResult.warnings : [],
    })
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
          client,
          typeof args.areaId === 'string' ? args.areaId : '',
          readNumber(args.x),
          readNumber(args.y)
        ),
        context
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
          client,
          typeof args.areaId === 'string' ? args.areaId : '',
          readNullableString(args.parentId)
        ),
        context
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
          client,
          typeof args.areaId === 'string' ? args.areaId : ''
        ),
        context
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
      createDryRunPatchResult(state, args.patch as AgentPatch, context)
    )
  }

  if (params.name === 'export_sdd') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    return resultResponse(id, {
      schemaVersion: 1,
      pageId: state.page.id,
      bundle: compileSddBundle(state),
    })
  }

  if (params.name === 'import_sdd') {
    const state = await getPageFromArgs(args, context)
    if (!state) return pageNotFoundResponse(id)

    const { patch, warnings, createCount, updateCount } =
      buildSddImportPatch(
        state,
        client,
        typeof args.markdown === 'string' ? args.markdown : ''
      )

    if (!patch) {
      return resultResponse(id, {
        schemaVersion: 1,
        dryRun: true,
        applied: false,
        applyAllowed: false,
        patch: null,
        warnings,
        createCount,
        updateCount,
      })
    }

    return resultResponse(id, {
      ...createDryRunPatchResult(state, patch, context, {
        maxOperations: MAX_IMPORT_OPERATIONS,
      }),
      warnings,
      createCount,
      updateCount,
    })
  }
  return errorResponse(id, -32601, 'Tool not found.')
}

const runAiDecisionLogTask = async (
  state: PageAppState,
  client: AgentClient,
  context: McpGatewayContext,
  taskId: string
) => {
  try {
    const patch = await context.createAiDecisionLogPatch?.(state, client)

    if (patch) {
      await context.taskStore?.complete(taskId, patch)
    } else {
      await context.taskStore?.fail(taskId, 'GLM provider is not configured.')
    }
  } catch (error) {
    await context.taskStore?.fail(
      taskId,
      error instanceof Error ? error.message : 'Task failed.'
    )
  }
}

const getTask = async (
  id: string | number | null,
  params: unknown,
  context: McpGatewayContext
): Promise<McpJsonRpcResponse> => {
  if (!context.taskStore) {
    return errorResponse(id, -32601, 'Tasks are not enabled.')
  }

  if (!isRecord(params) || typeof params.taskId !== 'string') {
    return errorResponse(id, -32602, 'Task params are invalid.')
  }

  const task = await context.taskStore.get(params.taskId)

  if (!task) return errorResponse(id, -32040, 'Task not found.')

  const authorization = authorizeMcpAccess({
    context,
    pageId: task.pageId,
    scope: 'page:read',
    toolName: 'tasks/get',
  })

  if (!authorization.ok) {
    return authorization.response(id)
  }

  // Fail closed: a revoked or expired minting token kills its tasks on the
  // next poll instead of leaking the pending result.
  if (
    task.tokenId &&
    context.isTokenActive &&
    !(await context.isTokenActive(task.tokenId))
  ) {
    await context.taskStore.fail(task.id, 'MCP token is no longer active.')
    logMcpDenial(context, {
      clientId: getMcpClient(context).id,
      pageId: task.pageId,
      reason: 'task-token-inactive',
      tokenId: task.tokenId,
      toolName: 'tasks/get',
    })

    return errorResponse(id, -32003, 'MCP token is no longer active.')
  }

  return resultResponse(id, {
    schemaVersion: 1,
    task: toTaskView(task),
  })
}

const cancelTask = async (
  id: string | number | null,
  params: unknown,
  context: McpGatewayContext
): Promise<McpJsonRpcResponse> => {
  if (!context.taskStore) {
    return errorResponse(id, -32601, 'Tasks are not enabled.')
  }

  if (!isRecord(params) || typeof params.taskId !== 'string') {
    return errorResponse(id, -32602, 'Task params are invalid.')
  }

  const task = await context.taskStore.get(params.taskId)

  if (!task) return errorResponse(id, -32040, 'Task not found.')

  const authorization = authorizeMcpAccess({
    context,
    pageId: task.pageId,
    scope: 'page:suggest',
    toolName: 'tasks/cancel',
  })

  if (!authorization.ok) {
    return authorization.response(id)
  }

  const cancelled = (await context.taskStore.cancel(task.id)) ?? task

  return resultResponse(id, {
    schemaVersion: 1,
    task: toTaskView(cancelled),
  })
}

const toTaskView = (task: McpGatewayTaskRecord) => ({
  taskId: task.id,
  toolName: task.toolName,
  status: task.status,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  ...(task.status === 'completed' ? { result: task.result } : {}),
  ...(task.error === null ? {} : { error: task.error }),
})

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
  const client = getMcpClient(context)

  await context.recordAgentAction({
    id: context.createActionId?.() ?? createDefaultMcpActionId(),
    pageId,
    toolName: params.name,
    clientId: client.id,
    clientDisplayName: client.displayName,
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

const withResolvedEvidence = async (
  pageResource: ReturnType<typeof getAgentPage>,
  context: McpGatewayContext
) => ({
  ...pageResource,
  areas: await Promise.all(
    pageResource.areas.map((area) =>
      withResolvedEvidenceForArea(area, context)
    )
  ),
})

const withResolvedEvidenceForArea = async (
  area: ReturnType<typeof getAgentPage>['areas'][number],
  context: McpGatewayContext
) => {
  if (!context.resolveEvidence) return area

  const evidence = area.metadata?.evidence ?? []
  const parseableEvidence = evidence
    .filter((reference) => parseCodeReference(reference.target))
    .slice(0, 5)
  const resolvedEvidence = (
    await Promise.all(
      parseableEvidence.map(async (reference) => {
        const snippet = await context.resolveEvidence?.(reference.target)

        return snippet
          ? {
              referenceId: reference.id,
              snippet,
            }
          : null
      })
    )
  ).filter(
    (
      reference
    ): reference is {
      referenceId: string
      snippet: ResolvedCodeSnippet
    } => reference !== null
  )

  return resolvedEvidence.length > 0
    ? {
        ...area,
        resolvedEvidence,
      }
    : area
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

  const client = getMcpClient(context)
  const listAuthorization = authorizeMcpAccess({
    context,
    scope: 'page:read',
    toolName: 'resources/list',
  })

  if (!listAuthorization.ok) {
    return listAuthorization.response(id)
  }

  if (params.uri === CASCADERY_RESOURCE_PREFIX) {
    return resourceResponse(
      id,
      params.uri,
      listAgentPages(
        filterVisiblePages(await context.listPages(), context),
        client
      )
    )
  }

  const parsedResource = parsePageResourceUri(params.uri)

  if (!parsedResource) {
    return resourceNotFoundResponse(id)
  }

  const resourceAuthorization = authorizeMcpAccess({
    context,
    pageId: parsedResource.pageId,
    scope: 'page:read',
    toolName: 'resources/read',
  })

  if (!resourceAuthorization.ok) {
    return resourceAuthorization.response(id)
  }

  const state = await context.getPage(parsedResource.pageId)

  if (!state || !isPageMcpEnabled(state)) return pageNotFoundResponse(id)

  const pageResource = getAgentPage(state, client)

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

  if (parsedResource.kind === 'markdown') {
    return resourceResponse(
      id,
      params.uri,
      exportPageAsMarkdown(state),
      MARKDOWN_MIME_TYPE
    )
  }

  if (parsedResource.kind === 'handoff') {
    return resourceResponse(
      id,
      params.uri,
      createAgentHandoffBrief(state).markdown,
      MARKDOWN_MIME_TYPE
    )
  }

  if (parsedResource.kind === 'json-canvas') {
    return resourceResponse(
      id,
      params.uri,
      exportPageAsJsonCanvas(state),
      JSON_CANVAS_MIME_TYPE
    )
  }

  if (parsedResource.kind === 'app') {
    return resourceResponse(
      id,
      params.uri,
      renderMcpAppHtml(state, {
        tasks: context.taskStore
          ? await context.taskStore.listForPage(state.page.id)
          : [],
      }),
      MCP_APP_HTML_MIME_TYPE
    )
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
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/markdown`,
      name: `${state.page.title} Markdown export`,
      description: 'Markdown handoff for this Cascadery page.',
      mimeType: MARKDOWN_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/handoff`,
      name: `${state.page.title} agent handoff`,
      description: 'Structured agent handoff brief for this Cascadery page.',
      mimeType: MARKDOWN_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/json-canvas`,
      name: `${state.page.title} JSON Canvas export`,
      description: 'JSON Canvas export for this Cascadery page.',
      mimeType: JSON_CANVAS_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/agent-actions`,
      name: `${state.page.title} agent actions`,
      description: 'Agent action records for this Cascadery page.',
      mimeType: JSON_MIME_TYPE,
    },
    {
      uri: `${CASCADERY_RESOURCE_PREFIX}/${state.page.id}/app`,
      name: `${state.page.title} MCP App view`,
      description:
        'Self-contained outline and proposal-review view for MCP App hosts.',
      mimeType: MCP_APP_HTML_MIME_TYPE,
    },
  ]),
]

const parsePageResourceUri = (uri: string):
  | {
      pageId: string
      kind:
        | 'page'
        | 'areas'
        | 'assets'
        | 'markdown'
        | 'handoff'
        | 'json-canvas'
        | 'agent-actions'
        | 'app'
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

  if (
    suffix !== 'areas' &&
    suffix !== 'assets' &&
    suffix !== 'markdown' &&
    suffix !== 'handoff' &&
    suffix !== 'json-canvas' &&
    suffix !== 'agent-actions' &&
    suffix !== 'app'
  ) {
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
  payload: unknown,
  mimeType = JSON_MIME_TYPE
) =>
  resultResponse(id, {
    contents: [
      {
        uri,
        mimeType,
        text:
          typeof payload === 'string'
            ? payload
            : JSON.stringify(payload),
      },
    ],
  })

const createDryRunPatchResult = (
  state: PageAppState,
  patch: AgentPatch,
  context: McpGatewayContext,
  { maxOperations }: { maxOperations?: number } = {}
) =>
  dryRunAgentPatch(state, patch, getMcpClient(context), {
    mode: 'suggest',
    ...(maxOperations ? { maxOperations } : {}),
  })

const applyAutoAcceptedStatusPatch = (
  state: PageAppState,
  patch: AgentPatch,
  context: McpGatewayContext
) => {
  const client = getMcpClient(context)
  const writeClient: AgentClient = {
    ...client,
    scopes: Array.from(new Set([...client.scopes, 'page:write'])),
  }
  const applied = applyAgentPatch(state, patch, writeClient, {
    createActionId: context.createActionId,
    now: context.now?.() ?? new Date().toISOString(),
  })

  if (!applied.ok) return applied

  const operation = patch.operations[0]
  const area =
    operation && 'areaId' in operation
      ? state.areas.find((candidate) => candidate.id === operation.areaId)
      : null
  const status =
    operation?.op === 'updateAreaMetadata'
      ? operation.patch.status
      : undefined
  const journalResult = createJournalEntry({
    actorKind: 'agent',
    actorName: client.displayName,
    createId: context.createJournalId,
    knownAreaIds: state.areas.map((candidate) => candidate.id),
    now: context.now?.() ?? new Date().toISOString(),
    taskAreaId: area?.id ?? null,
    text: `${client.displayName} marked "${getAreaJournalLabel(area)}" ${status ?? 'open'}.`,
  })

  return {
    ...applied,
    state: {
      ...applied.state,
      journal: journalResult.ok
        ? pruneJournalEntries([
            ...(applied.state.journal ?? []),
            journalResult.entry,
          ])
        : applied.state.journal,
    },
  }
}

const getAreaJournalLabel = (
  area: PageAppState['areas'][number] | null | undefined
) => {
  if (!area) return 'unknown Area'
  if (area.type === 'image') return area.alt || area.id

  return area.text.split('\n')[0]?.trim().slice(0, 80) || area.id
}

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

const getMcpClient = (context: McpGatewayContext) =>
  context.client ?? MCP_AGENT_CLIENT

const getToolDefinition = (toolName: string) =>
  toolDefinitions.find((tool) => tool.name === toolName) as
    | (typeof toolDefinitions)[number]
    | undefined

const filterVisiblePages = (
  states: PageAppState[],
  context: McpGatewayContext
) =>
  states.filter(
    (state) =>
      isPageMcpEnabled(state) &&
      (!context.authorizedPageId ||
        state.page.id === context.authorizedPageId)
  )

const authorizeMcpAccess = ({
  context,
  pageId,
  scope,
  toolName,
}: {
  args?: Record<string, unknown>
  context: McpGatewayContext
  pageId?: string
  scope: AgentScope
  toolName: string
}):
  | { ok: true }
  | {
      ok: false
      response: (id: string | number | null) => McpJsonRpcResponse
    } => {
  const client = getMcpClient(context)
  const shouldEnforceScopes = Boolean(context.client)

  if (
    context.authorizedPageId &&
    pageId &&
    pageId !== context.authorizedPageId
  ) {
    logMcpDenial(context, {
      clientId: client.id,
      pageId,
      reason: 'wrong-page',
      scope,
      tokenId: context.client?.id,
      toolName,
    })

    return {
      ok: false,
      response: (id) =>
        errorResponse(id, -32003, 'MCP token is not valid for this page.'),
    }
  }

  if (shouldEnforceScopes && !client.scopes.includes(scope)) {
    logMcpDenial(context, {
      clientId: client.id,
      pageId,
      reason: 'insufficient-scope',
      scope,
      tokenId: context.client?.id,
      toolName,
    })

    return {
      ok: false,
      response: (id) =>
        errorResponse(
          id,
          -32003,
          `MCP token is missing required scope ${scope}.`
        ),
    }
  }

  const rateLimit = context.checkToolRateLimit?.(scope) ?? {
    ok: true as const,
  }

  if (!rateLimit.ok) {
    logMcpDenial(context, {
      clientId: client.id,
      pageId,
      reason: 'rate-limit',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      scope,
      tokenId: context.client?.id,
      toolName,
    })

    return {
      ok: false,
      response: (id) =>
        errorResponse(id, -32029, 'MCP rate limit exceeded.', {
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }),
    }
  }

  return { ok: true }
}

const logMcpDenial = (
  context: McpGatewayContext,
  event: Omit<McpGatewaySecurityEvent, 'type'>
) => {
  context.logSecurityEvent?.({
    type: 'mcp-auth-denied',
    ...event,
  })
}

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
