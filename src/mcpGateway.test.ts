import assert from 'node:assert/strict'
import test from 'node:test'

import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'
import {
  handleMcpJsonRpcRequest,
  MCP_JSON_RPC_VERSION,
  type McpGatewayContext,
} from './mcpGateway.ts'

const now = '2026-06-26T12:00:00.000Z'

const state: PageAppState = {
  page: createDefaultPageState({
    id: 'page-1',
    now,
  }),
  assets: [],
  areas: [
    {
      id: 'area-1',
      parentId: null,
      x: 100,
      y: 120,
      width: 260,
      height: 120,
      text: 'Decision: expose read-only MCP before write tools.',
      styles: {},
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
      'move_area',
      'nest_area',
      'delete_area',
      'apply_patch',
    ]
  )
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

  assert.equal(missingPage.error.code, -32004)
  assert.equal(missingAi.error.code, -32010)
})
