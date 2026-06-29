import assert from 'node:assert/strict'
import test from 'node:test'

import type { AgentActionRecord, AgentPatch } from './agentInterface.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'
import {
  addPageHistoryEntry,
  applyRestorePageStatePatch,
  createAgentHistoryEntry,
  createEmptyPageHistoryState,
  createImportHistoryEntry,
  getPageHistoryPatch,
  getRecentPageHistoryEvents,
  parsePageHistoryJson,
  serializePageHistoryState,
} from './pageHistory.ts'

const now = '2026-06-29T12:00:00.000Z'

const pageWithSecretLinks = createDefaultPageState({
  id: 'page-1',
  now,
})

pageWithSecretLinks.settings.shareLinks = {
  pageId: 'page-1',
  editToken: 'secret-edit-token',
  viewToken: 'secret-view-token',
  createdAt: now,
  updatedAt: now,
  revokedAt: null,
}

const beforeState: PageAppState = {
  page: pageWithSecretLinks,
  assets: [],
  areas: [
    {
      id: 'area-1',
      parentId: null,
      x: 100,
      y: 120,
      width: 240,
      height: 120,
      text: 'Raw private draft content',
      styles: {
        border: '1px solid red',
      },
      createdAt: now,
      updatedAt: now,
    },
  ],
}

const afterState: PageAppState = {
  page: createDefaultPageState({
    id: 'page-1',
    now: '2026-06-29T12:01:00.000Z',
  }),
  assets: [],
  areas: [],
}

test('creates import restore events without leaking page content or share tokens in event data', () => {
  const entry = createImportHistoryEntry({
    actor: {
      kind: 'local-user',
      id: 'local-user',
      displayName: 'Local user',
    },
    beforeState,
    createId: () => 'import-1',
    importedAreaCount: afterState.areas.length,
    now,
  })

  assert.deepEqual(entry.event, {
    id: 'change-import-1',
    pageId: 'page-1',
    actor: {
      kind: 'local-user',
      id: 'local-user',
      displayName: 'Local user',
    },
    summary: 'Imported page JSON',
    actionType: 'import',
    operationCount: 1,
    createdAt: now,
    reversible: true,
    undoPatchId: 'patch-import-1',
  })

  const eventJson = JSON.stringify(entry.event)

  assert.doesNotMatch(eventJson, /Raw private draft content/)
  assert.doesNotMatch(eventJson, /secret-edit-token/)
  assert.doesNotMatch(eventJson, /secret-view-token/)
  assert.equal(
    entry.patch.kind === 'restore-page-state'
      ? entry.patch.state.page.settings.shareLinks
      : null,
    null
  )
})

test('restore page history patches apply the captured previous page state', () => {
  const entry = createImportHistoryEntry({
    actor: {
      kind: 'local-user',
      id: 'local-user',
      displayName: 'Local user',
    },
    beforeState,
    createId: () => 'import-restore',
    importedAreaCount: afterState.areas.length,
    now,
  })

  assert.equal(entry.patch.kind, 'restore-page-state')

  const restoredState = applyRestorePageStatePatch(afterState, entry.patch)

  assert.equal(restoredState.areas[0]?.id, 'area-1')
  assert.equal(
    restoredState.areas[0]?.type === 'image'
      ? ''
      : restoredState.areas[0]?.text,
    'Raw private draft content'
  )
  assert.equal(restoredState.page.settings.shareLinks, null)
})

test('import restore events can be associated with the imported page id', () => {
  const entry = createImportHistoryEntry({
    actor: {
      kind: 'local-user',
      id: 'local-user',
      displayName: 'Local user',
    },
    beforeState,
    createId: () => 'import-new-page',
    importedAreaCount: 0,
    now,
    pageId: 'imported-page',
  })

  assert.equal(entry.event.pageId, 'imported-page')
  assert.equal(entry.patch.pageId, 'imported-page')
})

test('creates agent audit events linked to undo patches', () => {
  const undoPatch: AgentPatch = {
    schemaVersion: 1,
    id: 'undo-agent-patch',
    pageId: 'page-1',
    source: {
      kind: 'mcp-agent',
      clientId: 'agent-client',
      displayName: 'GLM Agent',
    },
    operations: [
      {
        op: 'deleteArea',
        areaId: 'area-2',
      },
    ],
    createdAt: now,
  }
  const auditRecord: AgentActionRecord = {
    id: 'agent-action-1',
    pageId: 'page-1',
    patchId: 'agent-patch-1',
    clientId: 'agent-client',
    clientDisplayName: 'GLM Agent',
    operationCount: 2,
    beforeSummary: {
      areaCount: 1,
      assetCount: 0,
      imageAreaCount: 0,
      textAreaCount: 1,
    },
    afterSummary: {
      areaCount: 2,
      assetCount: 0,
      imageAreaCount: 0,
      textAreaCount: 2,
    },
    undoPatch,
    createdAt: now,
    result: 'applied',
  }

  const entry = createAgentHistoryEntry(auditRecord)

  assert.deepEqual(entry.event, {
    id: 'change-agent-action-1',
    pageId: 'page-1',
    actor: {
      kind: 'mcp-agent',
      id: 'agent-client',
      displayName: 'GLM Agent',
    },
    summary: 'Applied agent proposal agent-patch-1',
    actionType: 'agent-proposal',
    operationCount: 2,
    createdAt: now,
    reversible: true,
    undoPatchId: 'patch-agent-action-1',
    sourceId: 'agent-patch-1',
  })
  assert.equal(entry.patch.kind, 'agent-patch')
  assert.deepEqual(
    entry.patch.kind === 'agent-patch' ? entry.patch.patch : null,
    undoPatch
  )
})

test('history state stores recent events and keeps patch lookup private from event records', () => {
  const history = createEmptyPageHistoryState()
  const entry = createImportHistoryEntry({
    actor: {
      kind: 'local-user',
      id: 'local-user',
      displayName: 'Local user',
    },
    beforeState,
    createId: () => 'import-history',
    importedAreaCount: 0,
    now,
  })

  const nextHistory = addPageHistoryEntry(history, entry)
  const recentEvents = getRecentPageHistoryEvents(nextHistory, 'page-1')

  assert.equal(recentEvents.length, 1)
  assert.equal(recentEvents[0]?.id, 'change-import-history')
  assert.equal(
    getPageHistoryPatch(nextHistory, 'patch-import-history')?.id,
    'patch-import-history'
  )
  assert.doesNotMatch(
    JSON.stringify(recentEvents),
    /Raw private draft content/
  )
})

test('serializes and parses page history state defensively', () => {
  const entry = createImportHistoryEntry({
    actor: {
      kind: 'local-user',
      id: 'local-user',
      displayName: 'Local user',
    },
    beforeState,
    createId: () => 'import-serialize',
    importedAreaCount: 0,
    now,
  })
  const history = addPageHistoryEntry(
    createEmptyPageHistoryState(),
    entry
  )
  const parsed = parsePageHistoryJson(serializePageHistoryState(history))

  assert.equal(parsed.events[0]?.id, 'change-import-serialize')
  assert.equal(
    getPageHistoryPatch(parsed, 'patch-import-serialize')?.id,
    'patch-import-serialize'
  )
  assert.deepEqual(parsePageHistoryJson('{'), createEmptyPageHistoryState())
})
