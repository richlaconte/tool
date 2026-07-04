import assert from 'node:assert/strict'
import test from 'node:test'

import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'
import {
  handleMcpJsonRpcRequest,
  MCP_JSON_RPC_VERSION,
  type McpAgentActionRecord,
  type McpGatewayContext,
} from './mcpGateway.ts'

const now = '2026-06-26T12:00:00.000Z'

const state: PageAppState = {
  page: {
    ...createDefaultPageState({
      id: 'page-1',
      now,
    }),
    settings: {
      ...createDefaultPageState({ id: 'page-1', now }).settings,
      mcp: {
        enabled: true,
        autoAcceptStatusUpdates: false,
      },
    },
  },
  assets: [
    {
      id: 'asset-1',
      kind: 'image',
      mimeType: 'image/png',
      width: 640,
      height: 320,
      storageKey: 'data:image/png;base64,secret-binary',
      createdAt: now,
    },
  ],
  areas: [
    {
      id: 'area-1',
      parentId: null,
      x: 100,
      y: 120,
      width: 260,
      height: 120,
      text: 'Decision: expose read-only MCP before write tools.',
      metadata: {
        kind: 'decision',
        status: 'decided',
        tags: ['mcp'],
        filePath: 'src/mcpGateway.ts',
        evidence: [
          {
            id: 'evidence-1',
            kind: 'file',
            label: 'mcpGateway.ts',
            target: 'src/mcpGateway.ts',
            createdAt: now,
          },
        ],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
  ],
  links: [
    {
      id: 'link-1',
      fromAreaId: 'area-1',
      toAreaId: 'area-1',
      kind: 'references',
      label: 'self reference for test',
      createdAt: now,
      updatedAt: now,
    },
  ],
}

const context: McpGatewayContext = {
  getPage: async (pageId) => (pageId === state.page.id ? state : null),
  listPages: async () => [state],
}

const writeToolState: PageAppState = {
  ...state,
  areas: [
    ...state.areas,
    {
      id: 'area-2',
      parentId: null,
      x: 420,
      y: 120,
      width: 240,
      height: 120,
      text: 'Open question: how should write tools be reviewed?',
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
  ],
}

const writeToolContext: McpGatewayContext = {
  getPage: async (pageId) =>
    pageId === writeToolState.page.id ? writeToolState : null,
  listPages: async () => [writeToolState],
}

test('MCP gateway initializes without auth and lists low-risk tools', async () => {
  const initialized = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 1,
      method: 'initialize',
      params: {},
    },
    context
  )
  const tools = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 2,
      method: 'tools/list',
    },
    context
  )

  assert.equal(initialized.jsonrpc, MCP_JSON_RPC_VERSION)
  assert.equal(initialized.id, 1)
  assert.equal(initialized.result.serverInfo.name, 'cascadery')
  assert.equal(initialized.result.auth, 'none')
  assert.deepEqual(initialized.result.capabilities.resources, {})
  assert.deepEqual(
    tools.result.tools.map((tool: { name: string }) => tool.name),
    [
      'list_pages',
      'get_page',
      'get_area',
      'search_areas',
      'summarize_page',
      'extract_decisions',
      'extract_open_questions',
      'suggest_areas',
      'suggest_area_updates',
      'suggest_board_organization',
      'suggest_decision_log',
      'suggest_implementation_map',
      'ai_suggest_decision_log',
      'create_area',
      'update_area',
      'update_area_styles',
      'append_journal_entry',
      'update_area_status',
      'move_area',
      'nest_area',
      'delete_area',
      'apply_patch',
      'export_sdd',
      'import_sdd',
    ]
  )
  assert.deepEqual(
    tools.result.tools.map(
      (tool: { name: string; minimumScope: string }) => [
        tool.name,
        tool.minimumScope,
      ]
    ),
    [
      ['list_pages', 'page:read'],
      ['get_page', 'page:read'],
      ['get_area', 'page:read'],
      ['search_areas', 'page:search'],
      ['summarize_page', 'page:read'],
      ['extract_decisions', 'page:read'],
      ['extract_open_questions', 'page:read'],
      ['suggest_areas', 'page:suggest'],
      ['suggest_area_updates', 'page:suggest'],
      ['suggest_board_organization', 'page:suggest'],
      ['suggest_decision_log', 'page:suggest'],
      ['suggest_implementation_map', 'page:suggest'],
      ['ai_suggest_decision_log', 'page:suggest'],
      ['create_area', 'page:write'],
      ['update_area', 'page:write'],
      ['update_area_styles', 'page:write'],
      ['append_journal_entry', 'page:suggest'],
      ['update_area_status', 'page:write'],
      ['move_area', 'page:write'],
      ['nest_area', 'page:write'],
      ['delete_area', 'page:write'],
      ['apply_patch', 'page:write'],
      ['export_sdd', 'page:read'],
      ['import_sdd', 'page:suggest'],
    ]
  )
})

test('MCP gateway enforces token scopes and page audience before tools run', async () => {
  const securityEvents: unknown[] = []
  const readClient = {
    id: 'mcp-token-read',
    displayName: 'Read token',
    scopes: ['page:read'] as const,
  }
  const hardenedContext: McpGatewayContext = {
    ...context,
    authorizedPageId: 'page-1',
    client: readClient,
    logSecurityEvent: (event) => {
      securityEvents.push(event)
    },
  }

  const readable = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'read-ok',
      method: 'tools/call',
      params: {
        name: 'get_page',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    hardenedContext
  )
  const deniedByScope = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'write-denied',
      method: 'tools/call',
      params: {
        name: 'create_area',
        arguments: {
          pageId: 'page-1',
          text: 'Denied',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      },
    },
    hardenedContext
  )
  const deniedByAudience = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'wrong-page',
      method: 'tools/call',
      params: {
        name: 'get_page',
        arguments: {
          pageId: 'page-2',
        },
      },
    },
    hardenedContext
  )

  assert.equal(readable.result.page.id, 'page-1')
  assert.equal(readable.result.permissionMode.scopes[0], 'page:read')
  assert.equal(deniedByScope.error?.code, -32003)
  assert.equal(deniedByAudience.error?.code, -32003)
  assert.deepEqual(
    securityEvents.map((event) =>
      event && typeof event === 'object'
        ? {
            reason: (event as { reason?: string }).reason,
            toolName: (event as { toolName?: string }).toolName,
          }
        : event
    ),
    [
      {
        reason: 'insufficient-scope',
        toolName: 'create_area',
      },
      {
        reason: 'wrong-page',
        toolName: 'get_page',
      },
    ]
  )
})

test('MCP gateway applies per-scope rate limits independently', async () => {
  const securityEvents: unknown[] = []
  const hardenedContext: McpGatewayContext = {
    ...context,
    authorizedPageId: 'page-1',
    checkToolRateLimit: (scope) =>
      scope === 'page:write'
        ? { ok: false, retryAfterSeconds: 12 }
        : { ok: true },
    client: {
      id: 'mcp-token-write',
      displayName: 'Write token',
      scopes: ['page:read', 'page:write'],
    },
    logSecurityEvent: (event) => {
      securityEvents.push(event)
    },
  }

  const read = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'read',
      method: 'tools/call',
      params: {
        name: 'get_page',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    hardenedContext
  )
  const write = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'write',
      method: 'tools/call',
      params: {
        name: 'create_area',
        arguments: {
          pageId: 'page-1',
          text: 'Limited',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      },
    },
    hardenedContext
  )

  assert.equal(read.error, undefined)
  assert.equal(write.error?.code, -32029)
  assert.deepEqual(write.error?.data, {
    retryAfterSeconds: 12,
  })
  assert.equal((securityEvents[0] as { reason: string }).reason, 'rate-limit')
})

test('MCP resources list and read page context without leaking raw assets', async () => {
  const listed = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'resources-list',
      method: 'resources/list',
    },
    context
  )
  const resourceUris = listed.result.resources.map(
    (resource: { uri: string }) => resource.uri
  )

  assert.deepEqual(resourceUris, [
    'cascadery://pages',
    'cascadery://pages/page-1',
    'cascadery://pages/page-1/areas',
    'cascadery://pages/page-1/assets',
    'cascadery://pages/page-1/markdown',
    'cascadery://pages/page-1/handoff',
    'cascadery://pages/page-1/json-canvas',
    'cascadery://pages/page-1/agent-actions',
  ])

  const pages = await readJsonResource('cascadery://pages')
  const pageResource = await readJsonResource('cascadery://pages/page-1')
  const areas = await readJsonResource('cascadery://pages/page-1/areas')
  const assets = await readJsonResource('cascadery://pages/page-1/assets')
  const markdown = await readTextResource(
    'cascadery://pages/page-1/markdown'
  )
  const handoff = await readTextResource(
    'cascadery://pages/page-1/handoff'
  )
  const jsonCanvas = await readJsonResource(
    'cascadery://pages/page-1/json-canvas'
  )
  const actions = await readJsonResource(
    'cascadery://pages/page-1/agent-actions'
  )
  const serializedPageResource = JSON.stringify(pageResource)
  const serializedAssets = JSON.stringify(assets)

  assert.equal(pages.pages[0].id, 'page-1')
  assert.equal(pageResource.page.id, 'page-1')
  assert.equal(pageResource.areas[0].id, 'area-1')
  assert.deepEqual(pageResource.areas[0].metadata, {
    kind: 'decision',
    status: 'decided',
    tags: ['mcp'],
    filePath: 'src/mcpGateway.ts',
    evidence: [
      {
        id: 'evidence-1',
        kind: 'file',
        label: 'mcpGateway.ts',
        target: 'src/mcpGateway.ts',
        createdAt: now,
      },
    ],
  })
  assert.deepEqual(pageResource.links, state.links)
  assert.equal(areas.areas[0].text, state.areas[0].text)
  assert.deepEqual(areas.links, state.links)
  assert.equal(assets.assets[0].id, 'asset-1')
  assert.equal(assets.assets[0].storageKey, undefined)
  assert.match(markdown.text, /## Decisions/)
  assert.equal(markdown.mimeType, 'text/markdown')
  assert.match(handoff.text, /# Agent Handoff:/)
  assert.match(handoff.text, /mcpGateway\.ts/)
  assert.equal(handoff.mimeType, 'text/markdown')
  assert.equal(jsonCanvas.nodes[0].id, 'area-1')
  assert.equal(jsonCanvas.edges[0].fromNode, 'area-1')
  assert.deepEqual(actions.actions, [])
  assert.deepEqual(actions.permissionMode.scopes, [
    'page:read',
    'page:search',
    'page:suggest',
  ])
  assert.doesNotMatch(serializedPageResource, /secret-binary/)
  assert.doesNotMatch(serializedAssets, /secret-binary/)
  assert.doesNotMatch(markdown.text, /secret-binary/)
  assert.doesNotMatch(handoff.text, /secret-binary/)
  assert.doesNotMatch(JSON.stringify(jsonCanvas), /secret-binary/)
})

test('MCP get_area includes capped resolved code evidence', async () => {
  const permalink =
    'https://github.com/cascadery/tool/blob/0123456789abcdef0123456789abcdef01234567/src/mcpGateway.ts#L2-L3'
  const stateWithCodeEvidence: PageAppState = {
    ...state,
    areas: state.areas.map((area) =>
      area.id === 'area-1'
        ? {
            ...area,
            metadata: {
              ...area.metadata,
              evidence: [
                {
                  id: 'evidence-code',
                  kind: 'url',
                  label: 'mcpGateway.ts',
                  target: permalink,
                  createdAt: now,
                },
              ],
            },
          }
        : area
    ),
  }
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'resolved-evidence',
      method: 'tools/call',
      params: {
        name: 'get_area',
        arguments: {
          pageId: 'page-1',
          areaId: 'area-1',
        },
      },
    },
    {
      getPage: async () => stateWithCodeEvidence,
      listPages: async () => [stateWithCodeEvidence],
      resolveEvidence: async () => ({
        url: permalink,
        path: 'src/mcpGateway.ts',
        startLine: 2,
        requestedStartLine: 2,
        requestedEndLine: 3,
        language: 'ts',
        fetchedAt: now,
        truncated: false,
        isImmutableRef: true,
        lines: [
          { number: 2, text: 'export const gateway = true' },
          { number: 3, text: 'export const done = true' },
        ],
      }),
    }
  )

  assert.deepEqual(response.result.area.resolvedEvidence, [
    {
      referenceId: 'evidence-code',
      snippet: {
        url: permalink,
        path: 'src/mcpGateway.ts',
        startLine: 2,
        requestedStartLine: 2,
        requestedEndLine: 3,
        language: 'ts',
        fetchedAt: now,
        truncated: false,
        isImmutableRef: true,
        lines: [
          { number: 2, text: 'export const gateway = true' },
          { number: 3, text: 'export const done = true' },
        ],
      },
    },
  ])
})

test('MCP page setting hides disabled pages and blocks page tools', async () => {
  const disabledState: PageAppState = {
    ...state,
    page: {
      ...state.page,
      id: 'page-disabled',
      settings: {
        ...state.page.settings,
        mcp: {
          enabled: false,
        },
      },
    },
  }
  const disabledContext: McpGatewayContext = {
    getPage: async (pageId) =>
      pageId === disabledState.page.id ? disabledState : null,
    listPages: async () => [disabledState],
  }
  const listedPages = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'list-disabled',
      method: 'tools/call',
      params: {
        name: 'list_pages',
        arguments: {},
      },
    },
    disabledContext
  )
  const listedResources = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'resources-disabled',
      method: 'resources/list',
    },
    disabledContext
  )
  const directRead = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'read-disabled',
      method: 'resources/read',
      params: {
        uri: 'cascadery://pages/page-disabled',
      },
    },
    disabledContext
  )
  const directTool = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'tool-disabled',
      method: 'tools/call',
      params: {
        name: 'get_page',
        arguments: {
          pageId: 'page-disabled',
        },
      },
    },
    disabledContext
  )

  assert.deepEqual(listedPages.result.pages, [])
  assert.deepEqual(
    listedResources.result.resources.map(
      (resource: { uri: string }) => resource.uri
    ),
    ['cascadery://pages']
  )
  assert.equal(directRead.error.code, -32004)
  assert.equal(directTool.error.code, -32004)
})

test('MCP tool calls are recorded as sanitized agent action resources', async () => {
  const records: McpAgentActionRecord[] = []
  const actionContext: McpGatewayContext = {
    ...context,
    createActionId: () => 'mcp-action-1',
    listAgentActions: async (pageId) =>
      records.filter((record) => record.pageId === pageId),
    now: () => now,
    recordAgentAction: async (record) => {
      records.unshift(record)
    },
  }

  await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'suggest-record',
      method: 'tools/call',
      params: {
        name: 'suggest_decision_log',
        arguments: {
          pageId: 'page-1',
          query: 'secret search text',
        },
      },
    },
    actionContext
  )

  const actions = await readJsonResourceWithContext(
    'cascadery://pages/page-1/agent-actions',
    actionContext
  )
  const serializedActions = JSON.stringify(actions)

  assert.deepEqual(actions.actions, [
    {
      id: 'mcp-action-1',
      pageId: 'page-1',
      toolName: 'suggest_decision_log',
      clientId: 'no-auth-mcp',
      clientDisplayName: 'No-auth MCP client',
      operationCount: 1,
      createdAt: now,
      result: 'success',
    },
  ])
  assert.doesNotMatch(serializedActions, /secret search text/)
  assert.deepEqual(actions.permissionMode.scopes, [
    'page:read',
    'page:search',
    'page:suggest',
  ])
})

test('MCP tools can read, search, and propose patches without applying them', async () => {
  const listed = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'list',
      method: 'tools/call',
      params: {
        name: 'list_pages',
        arguments: {},
      },
    },
    context
  )
  const searched = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'search',
      method: 'tools/call',
      params: {
        name: 'search_areas',
        arguments: {
          pageId: 'page-1',
          query: 'read-only MCP',
        },
      },
    },
    context
  )
  const suggested = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'suggest',
      method: 'tools/call',
      params: {
        name: 'suggest_decision_log',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    context
  )

  assert.equal(listed.result.pages[0].id, 'page-1')
  assert.equal(searched.result.areas[0].id, 'area-1')
  assert.equal(suggested.result.operations[0].op, 'createArea')
  assert.equal(state.areas.length, 1)
})

test('MCP suggest-only tools expose patch variants without applying them', async () => {
  const toolNames = [
    'suggest_areas',
    'suggest_area_updates',
    'suggest_board_organization',
    'suggest_implementation_map',
  ]

  const results = await Promise.all(
    toolNames.map((name, index) =>
      handleMcpJsonRpcRequest(
        {
          jsonrpc: MCP_JSON_RPC_VERSION,
          id: `suggest-${index}`,
          method: 'tools/call',
          params: {
            name,
            arguments: {
              pageId: 'page-1',
            },
          },
        },
        context
      )
    )
  )

  assert.deepEqual(
    results.map((result) => result.result.operations[0].op),
    ['createArea', 'updateAreaStyles', 'moveArea', 'createArea']
  )
  assert.equal(results[0].result.pageId, 'page-1')
  assert.match(results[3].result.operations[0].area.text, /Implementation map/)
  assert.equal(state.areas.length, 1)
})

test('MCP write tools return dry-run patches without mutating the page', async () => {
  const toolCalls = [
    {
      name: 'create_area',
      arguments: {
        pageId: 'page-1',
        text: 'Implementation note: keep no-auth writes review-only.',
        x: 120,
        y: 360,
        width: 320,
        height: 140,
        styles: {
          border: '1px solid #2563eb',
        },
      },
    },
    {
      name: 'update_area',
      arguments: {
        pageId: 'page-1',
        areaId: 'area-1',
        text: 'Decision: expose write tools as dry-run patches.',
        width: 320,
      },
    },
    {
      name: 'update_area_styles',
      arguments: {
        pageId: 'page-1',
        areaId: 'area-1',
        styles: {
          background: '#f8fafc',
        },
      },
    },
    {
      name: 'move_area',
      arguments: {
        pageId: 'page-1',
        areaId: 'area-1',
        x: 140,
        y: 240,
      },
    },
    {
      name: 'nest_area',
      arguments: {
        pageId: 'page-1',
        areaId: 'area-2',
        parentId: 'area-1',
      },
    },
    {
      name: 'delete_area',
      arguments: {
        pageId: 'page-1',
        areaId: 'area-2',
      },
    },
  ]

  const results = await Promise.all(
    toolCalls.map(({ name, arguments: toolArguments }, index) =>
      handleMcpJsonRpcRequest(
        {
          jsonrpc: MCP_JSON_RPC_VERSION,
          id: `write-${index}`,
          method: 'tools/call',
          params: {
            name,
            arguments: toolArguments,
          },
        },
        writeToolContext
      )
    )
  )

  assert.deepEqual(
    results.map((result) => result.result.patch.operations[0].op),
    [
      'createArea',
      'updateArea',
      'updateAreaStyles',
      'moveArea',
      'nestArea',
      'deleteArea',
    ]
  )
  assert.deepEqual(
    results.map((result) => result.result.validation.ok),
    [true, true, true, true, true, true]
  )
  assert.deepEqual(
    results.map((result) => result.result.dryRun),
    [true, true, true, true, true, true]
  )
  assert.deepEqual(
    results.map((result) => result.result.applied),
    [false, false, false, false, false, false]
  )
  assert.deepEqual(
    results.map((result) => result.result.applyAllowed),
    [false, false, false, false, false, false]
  )
  assert.equal(writeToolState.areas.length, 2)

  const dryRunApply = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'dry-run-apply',
      method: 'tools/call',
      params: {
        name: 'apply_patch',
        arguments: {
          pageId: 'page-1',
          patch: results[0].result.patch,
          dryRun: true,
        },
      },
    },
    writeToolContext
  )
  const blockedApply = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'blocked-apply',
      method: 'tools/call',
      params: {
        name: 'apply_patch',
        arguments: {
          pageId: 'page-1',
          patch: results[0].result.patch,
          dryRun: false,
        },
      },
    },
    writeToolContext
  )

  assert.equal(dryRunApply.result.validation.ok, true)
  assert.equal(dryRunApply.result.applied, false)
  assert.equal(blockedApply.error.code, -32011)
  assert.equal(writeToolState.areas.length, 2)
})

test('MCP read-only tools retrieve one area and extract page facts', async () => {
  const area = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'area',
      method: 'tools/call',
      params: {
        name: 'get_area',
        arguments: {
          pageId: 'page-1',
          areaId: 'area-1',
        },
      },
    },
    context
  )
  const summary = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'summary',
      method: 'tools/call',
      params: {
        name: 'summarize_page',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    context
  )
  const decisions = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'decisions',
      method: 'tools/call',
      params: {
        name: 'extract_decisions',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    context
  )

  assert.equal(area.result.area.id, 'area-1')
  assert.equal(summary.result.summary.decisionCount, 1)
  assert.deepEqual(decisions.result.items, [
    {
      areaId: 'area-1',
      kind: 'decision',
      lineNumber: 1,
      text: 'expose read-only MCP before write tools.',
    },
  ])
})

test('MCP AI suggestion delegates to the configured model callback', async () => {
  const aiResult = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'ai-suggest',
      method: 'tools/call',
      params: {
        name: 'ai_suggest_decision_log',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    {
      ...context,
      createAiDecisionLogPatch: async () => ({
        schemaVersion: 1,
        id: 'patch-ai',
        pageId: 'page-1',
        source: {
          kind: 'mcp-agent',
          clientId: 'glm',
          displayName: 'GLM',
        },
        operations: [
          {
            op: 'createArea',
            tempId: 'ai-log',
            area: {
              text: 'AI proposal: keep MCP no-auth read-only for now.',
              x: 120,
              y: 220,
              width: 420,
              height: 180,
              styles: {
                border: '1px solid #2563eb',
              },
            },
          },
        ],
        createdAt: now,
      }),
    }
  )

  assert.equal(aiResult.result.id, 'patch-ai')
  assert.match(
    aiResult.result.operations[0].area.text,
    /AI proposal/
  )
})

test('MCP gateway returns structured errors for missing pages and unconfigured AI', async () => {
  const missingPage = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'missing',
      method: 'tools/call',
      params: {
        name: 'get_page',
        arguments: {
          pageId: 'missing',
        },
      },
    },
    context
  )
  const missingAi = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'missing-ai',
      method: 'tools/call',
      params: {
        name: 'ai_suggest_decision_log',
        arguments: {
          pageId: 'page-1',
        },
      },
    },
    context
  )
  const missingResourcePage = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'missing-resource-page',
      method: 'resources/read',
      params: {
        uri: 'cascadery://pages/missing',
      },
    },
    context
  )
  const unknownResource = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'unknown-resource',
      method: 'resources/read',
      params: {
        uri: 'cascadery://unknown',
      },
    },
    context
  )

  assert.equal(missingPage.error.code, -32004)
  assert.equal(missingAi.error.code, -32010)
  assert.equal(missingResourcePage.error.code, -32004)
  assert.equal(unknownResource.error.code, -32006)
})

const readJsonResource = async (uri: string) => {
  return readJsonResourceWithContext(uri, context)
}

const readTextResource = async (uri: string) => {
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: uri,
      method: 'resources/read',
      params: {
        uri,
      },
    },
    context
  )

  assert.equal(response.error, undefined)

  return response.result.contents[0] as {
    mimeType: string
    text: string
    uri: string
  }
}

const readJsonResourceWithContext = async (
  uri: string,
  resourceContext: McpGatewayContext
) => {
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: uri,
      method: 'resources/read',
      params: {
        uri,
      },
    },
    resourceContext
  )

  assert.equal(response.error, undefined)

  return JSON.parse(response.result.contents[0].text)
}

test('export_sdd compiles the page into an SDD bundle', async () => {
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'export-sdd',
      method: 'tools/call',
      params: {
        name: 'export_sdd',
        arguments: { pageId: 'page-1' },
      },
    },
    context
  )

  assert.equal(response.error, undefined)
  assert.equal(response.result.pageId, 'page-1')
  assert.match(response.result.bundle.spec, /## Decisions/)
  assert.match(response.result.bundle.combined, /# tasks\.md/)
})

test('import_sdd returns a reviewable proposal that is never applied', async () => {
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'import-sdd',
      method: 'tools/call',
      params: {
        name: 'import_sdd',
        arguments: {
          pageId: 'page-1',
          markdown: '## Decisions\n\n### Adopt SDD\n\n## Tasks\n\n- [ ] Build importer\n',
        },
      },
    },
    context
  )

  assert.equal(response.error, undefined)
  assert.equal(response.result.dryRun, true)
  assert.equal(response.result.applied, false)
  assert.equal(response.result.applyAllowed, false)
  assert.equal(response.result.createCount, 2)
  assert.equal(response.result.validation.ok, true)
  assert.equal(response.result.patch.operations.length, 2)
})

test('import_sdd reports warnings and no patch for empty markdown', async () => {
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'import-sdd-empty',
      method: 'tools/call',
      params: {
        name: 'import_sdd',
        arguments: { pageId: 'page-1', markdown: '   ' },
      },
    },
    context
  )

  assert.equal(response.error, undefined)
  assert.equal(response.result.patch, null)
  assert.ok(
    response.result.warnings.some((warning: string) =>
      warning.includes('No importable')
    )
  )
})

test('append_journal_entry validates and persists an append-only journal entry', async () => {
  let savedState: PageAppState = state
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'append-journal',
      method: 'tools/call',
      params: {
        name: 'append_journal_entry',
        arguments: {
          pageId: 'page-1',
          taskAreaId: 'missing-area',
          text: 'Investigating failing checks.',
        },
      },
    },
    {
      ...context,
      createJournalId: () => 'journal-mcp-1',
      getPage: async () => savedState,
      now: () => now,
      savePageState: async (nextState) => {
        savedState = nextState
      },
    }
  )

  assert.equal(response.error, undefined)
  assert.equal(response.result.appended, true)
  assert.deepEqual(response.result.entry, {
    id: 'journal-mcp-1',
    actor: {
      kind: 'agent',
      name: 'No-auth MCP client',
    },
    createdAt: now,
    taskAreaId: null,
    text: 'Investigating failing checks.',
  })
  assert.match(response.result.warnings[0], /missing-area/)
  assert.deepEqual(savedState.journal, [response.result.entry])
})

test('append_journal_entry reports a JSON-RPC rate limit error without saving', async () => {
  let saved = false
  const response = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'append-limited',
      method: 'tools/call',
      params: {
        name: 'append_journal_entry',
        arguments: {
          pageId: 'page-1',
          text: 'Too many updates.',
        },
      },
    },
    {
      ...context,
      checkJournalRateLimit: () => ({
        ok: false,
        retryAfterSeconds: 12,
      }),
      savePageState: async () => {
        saved = true
      },
    }
  )

  assert.equal(response.error?.code, -32029)
  assert.equal(response.error?.data.retryAfterSeconds, 12)
  assert.equal(saved, false)
})

test('update_area_status returns a proposal unless status auto-accept is enabled', async () => {
  const proposalResponse = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'status-proposal',
      method: 'tools/call',
      params: {
        name: 'update_area_status',
        arguments: {
          pageId: 'page-1',
          areaId: 'area-1',
          status: 'done',
        },
      },
    },
    context
  )
  let savedState: PageAppState = {
    ...state,
    page: {
      ...state.page,
      settings: {
        ...state.page.settings,
        mcp: {
          enabled: true,
          autoAcceptStatusUpdates: true,
        },
      },
    },
  }
  const autoAcceptResponse = await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'status-auto',
      method: 'tools/call',
      params: {
        name: 'update_area_status',
        arguments: {
          pageId: 'page-1',
          areaId: 'area-1',
          status: 'blocked',
        },
      },
    },
    {
      ...context,
      createActionId: () => 'action-status-auto',
      createJournalId: () => 'journal-status-auto',
      getPage: async () => savedState,
      now: () => now,
      savePageState: async (nextState) => {
        savedState = nextState
      },
    }
  )

  assert.equal(proposalResponse.error, undefined)
  assert.equal(proposalResponse.result.dryRun, true)
  assert.equal(proposalResponse.result.applied, false)
  assert.deepEqual(proposalResponse.result.patch.operations, [
    {
      op: 'updateAreaMetadata',
      areaId: 'area-1',
      patch: {
        status: 'done',
      },
    },
  ])

  assert.equal(autoAcceptResponse.error, undefined)
  assert.equal(autoAcceptResponse.result.applied, true)
  assert.equal(autoAcceptResponse.result.auditRecord.id, 'action-status-auto')
  assert.equal(savedState.areas[0].metadata?.status, 'blocked')
  assert.match(savedState.journal?.[0]?.text ?? '', /marked .* blocked/)
})

test('export_sdd and import_sdd are recorded in the agent action audit trail', async () => {
  const records: McpAgentActionRecord[] = []
  const auditContext: McpGatewayContext = {
    ...context,
    recordAgentAction: async (record) => {
      records.push(record)
    },
  }

  await handleMcpJsonRpcRequest(
    {
      jsonrpc: MCP_JSON_RPC_VERSION,
      id: 'audit-export',
      method: 'tools/call',
      params: { name: 'export_sdd', arguments: { pageId: 'page-1' } },
    },
    auditContext
  )

  assert.ok(records.some((record) => record.toolName === 'export_sdd'))
})
