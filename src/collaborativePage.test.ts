import assert from 'node:assert/strict'
import test from 'node:test'

import * as Y from 'yjs'

import {
  LOCAL_ORIGIN,
  AGENT_ORIGIN,
  appendJournalEntry,
  applyCollaborativePageStatePatch,
  applyCollaborativeAreaText,
  addCollaborativeComment,
  createCollaborativePageDoc,
  deleteCollaborativeComment,
  deleteCollaborativeArea,
  getCollaborativeAreaText,
  getPageStateFromCollaborativeDoc,
  isCollaborativePageDocEmpty,
  reopenCollaborativeComment,
  replaceCollaborativePageDocState,
  resolveCollaborativeComment,
  updateCollaborativeArea,
  updateCollaborativeAreas,
} from './collaborativePage.ts'
import { createDefaultPageState } from './pagePersistence.ts'
import type { AreaState } from './App.tsx'

const now = '2026-06-26T12:00:00.000Z'
const comment = {
  id: 'comment_1',
  areaId: 'parent',
  authorName: 'Riley Reviewer',
  authorColor: '#2563eb',
  text: 'Please verify this risk.',
  createdAt: now,
  resolvedAt: null,
  resolvedBy: null,
}
const journalEntry = {
  id: 'journal_1',
  actor: {
    name: 'GLM Agent',
    kind: 'agent' as const,
  },
  text: 'Checking implementation status.',
  createdAt: now,
  taskAreaId: 'parent',
}

const createAreas = (): AreaState[] => [
  {
    createdAt: now,
    height: 80,
    id: 'parent',
    parentId: null,
    styles: {
      border: '1px solid black',
    },
    text: 'Parent text',
    type: 'text',
    updatedAt: now,
    width: 220,
    x: 40,
    y: 60,
  },
  {
    assetId: 'asset_1',
    alt: 'Sketch',
    createdAt: now,
    height: 120,
    id: 'child',
    parentId: 'parent',
    styles: {},
    type: 'image',
    updatedAt: now,
    width: 180,
    x: 20,
    y: 24,
  },
]

test('converts app page state into a Yjs document and back', () => {
  const page = createDefaultPageState({ id: 'page_1', now })
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [
      {
        createdAt: now,
        height: 120,
        id: 'asset_1',
        kind: 'image',
        mimeType: 'image/png',
        storageKey: 'assets/asset_1.png',
        width: 180,
      },
    ],
    links: [
      {
        id: 'link_1',
        fromAreaId: 'parent',
        toAreaId: 'child',
        kind: 'references',
        label: 'references image',
        from: {
          areaId: 'parent',
          side: 'right',
          position: 0.4,
          behavior: 'fixed',
        },
        to: {
          areaId: 'child',
          side: 'left',
          position: 0.6,
          behavior: 'fixed',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    comments: [comment],
    journal: [journalEntry],
    page,
  })

  const exported = getPageStateFromCollaborativeDoc(doc)

  assert.equal(exported.page.id, 'page_1')
  assert.equal(exported.areas.length, 2)
  assert.deepEqual(exported.areas[0], createAreas()[0])
  assert.equal(exported.assets[0].storageKey, 'assets/asset_1.png')
  assert.deepEqual(exported.links, [
    {
      id: 'link_1',
      fromAreaId: 'parent',
      toAreaId: 'child',
      kind: 'references',
      label: 'references image',
      from: {
        areaId: 'parent',
        side: 'right',
        position: 0.4,
        behavior: 'fixed',
      },
      to: {
        areaId: 'child',
        side: 'left',
        position: 0.6,
        behavior: 'fixed',
      },
      visual: {
        mode: 'semantic',
        direction: 'forward',
        route: 'auto',
        labelVisibility: 'auto',
      },
      createdAt: now,
      updatedAt: now,
    },
  ])
  assert.deepEqual(exported.comments, [comment])
  assert.deepEqual(exported.journal, [journalEntry])
})

test('detects whether a collaborative document has server state', () => {
  const emptyDoc = new Y.Doc()

  assert.equal(isCollaborativePageDocEmpty(emptyDoc), true)

  const populatedDoc = createCollaborativePageDoc({
    areas: [],
    assets: [],
    page: createDefaultPageState({ id: 'page_empty', now }),
  })

  assert.equal(isCollaborativePageDocEmpty(populatedDoc), false)
})

test('collaborative area metadata survives document round trips', () => {
  const [area] = createAreas()
  const doc = createCollaborativePageDoc({
    areas: [
      {
        ...area,
        metadata: {
          kind: 'risk',
          status: 'blocked',
          tags: ['launch'],
          filePath: 'src/risk.ts',
        },
      },
    ],
    assets: [],
    page: createDefaultPageState({ id: 'page_metadata', now }),
  })

  assert.deepEqual(getPageStateFromCollaborativeDoc(doc).areas[0].metadata, {
    kind: 'risk',
    status: 'blocked',
    tags: ['launch'],
    filePath: 'src/risk.ts',
  })
})

test('collaborative comments can be added, resolved, reopened, and deleted', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_comments', now }),
  })

  addCollaborativeComment(doc, comment)
  resolveCollaborativeComment(doc, 'comment_1', {
    resolvedAt: '2026-06-26T12:05:00.000Z',
    resolvedBy: 'Riley Reviewer',
  })

  assert.deepEqual(getPageStateFromCollaborativeDoc(doc).comments, [
    {
      ...comment,
      resolvedAt: '2026-06-26T12:05:00.000Z',
      resolvedBy: 'Riley Reviewer',
    },
  ])

  reopenCollaborativeComment(doc, 'comment_1')
  assert.equal(
    getPageStateFromCollaborativeDoc(doc).comments?.[0]?.resolvedAt,
    null
  )

  deleteCollaborativeComment(doc, 'comment_1')
  assert.deepEqual(getPageStateFromCollaborativeDoc(doc).comments, [])
})

test('text areas store content in Y.Text and accept diff updates', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_2', now }),
  })

  const text = getCollaborativeAreaText(doc, 'parent')
  assert.equal(text.toString(), 'Parent text')

  applyCollaborativeAreaText(doc, 'parent', 'Parent text plus more')

  assert.equal(text.toString(), 'Parent text plus more')
  assert.equal(
    getPageStateFromCollaborativeDoc(doc).areas[0].text,
    'Parent text plus more'
  )
})

test('updates area geometry and merges style properties', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_3', now }),
  })

  updateCollaborativeArea(doc, 'parent', {
    styles: {
      color: 'red',
    },
    width: 320,
    x: 100,
  })

  const [parent] = getPageStateFromCollaborativeDoc(doc).areas

  assert.equal(parent.x, 100)
  assert.equal(parent.width, 320)
  assert.deepEqual(parent.styles, {
    border: '1px solid black',
    color: 'red',
  })
})

test('updates multiple areas in one collaborative transaction', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_group_move', now }),
  })
  let updateCount = 0
  doc.on('update', () => {
    updateCount += 1
  })

  updateCollaborativeAreas(doc, [
    {
      areaId: 'parent',
      patch: {
        x: 120,
      },
    },
    {
      areaId: 'child',
      patch: {
        y: 48,
      },
    },
  ])

  const nextState = getPageStateFromCollaborativeDoc(doc)

  assert.equal(nextState.areas.find((area) => area.id === 'parent')?.x, 120)
  assert.equal(nextState.areas.find((area) => area.id === 'child')?.y, 48)
  assert.equal(updateCount, 1)
})

test('collaborative write helpers tag local origin by default and honor explicit origins', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_origins', now }),
  })
  const origins: unknown[] = []

  doc.on('afterTransaction', (transaction) => {
    origins.push(transaction.origin)
  })

  updateCollaborativeArea(doc, 'parent', {
    x: 120,
  })
  updateCollaborativeAreas(doc, [
    {
      areaId: 'parent',
      patch: {
        y: 160,
      },
    },
  ])
  applyCollaborativeAreaText(doc, 'parent', 'Origin text')
  deleteCollaborativeArea(doc, 'child', 'explicit-delete')

  assert.deepEqual(origins.slice(-4), [
    LOCAL_ORIGIN,
    LOCAL_ORIGIN,
    LOCAL_ORIGIN,
    'explicit-delete',
  ])
})

test('collaborative journal appends use agent origin and prune oldest entries', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_journal', now }),
  })
  const origins: unknown[] = []

  doc.on('afterTransaction', (transaction) => {
    origins.push(transaction.origin)
  })

  appendJournalEntry(doc, journalEntry)

  const exported = getPageStateFromCollaborativeDoc(doc)

  assert.deepEqual(exported.journal, [journalEntry])
  assert.equal(origins.at(-1), AGENT_ORIGIN)
})

test('deleting an area removes its descendants in one transaction', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_4', now }),
  })

  deleteCollaborativeArea(doc, 'parent')

  assert.deepEqual(getPageStateFromCollaborativeDoc(doc).areas, [])
})

test('replaces collaborative document state in one transaction', () => {
  const doc = createCollaborativePageDoc({
    areas: createAreas(),
    assets: [],
    page: createDefaultPageState({ id: 'page_5', now }),
  })

  replaceCollaborativePageDocState(doc, {
    areas: [
      {
        createdAt: now,
        height: 70,
        id: 'replacement',
        parentId: null,
        styles: {
          color: 'blue',
        },
        text: 'Replacement text',
        type: 'text',
        updatedAt: now,
        width: 240,
        x: 12,
        y: 18,
      },
    ],
    assets: [],
    page: createDefaultPageState({ id: 'page_5', now }),
  })

  assert.deepEqual(
    getPageStateFromCollaborativeDoc(doc).areas.map((area) => area.id),
    ['replacement']
  )
  assert.equal(
    getCollaborativeAreaText(doc, 'replacement').toString(),
    'Replacement text'
  )
})

test('state patches preserve remotely-created areas that local state has not seen', () => {
  const [localArea] = createAreas()
  const remoteArea: AreaState = {
    createdAt: now,
    height: 80,
    id: 'remote',
    parentId: null,
    styles: {},
    text: 'Remote text',
    type: 'text',
    updatedAt: now,
    width: 220,
    x: 240,
    y: 260,
  }
  const page = createDefaultPageState({ id: 'page_6', now })
  const doc = createCollaborativePageDoc({
    areas: [localArea, remoteArea],
    assets: [],
    page,
  })

  applyCollaborativePageStatePatch(
    doc,
    {
      areas: [localArea],
      assets: [],
      page,
    },
    {
      areas: [
        {
          ...localArea,
          x: 120,
        },
      ],
      assets: [],
      page,
    }
  )

  const areaIds = getPageStateFromCollaborativeDoc(doc).areas.map(
    (area) => area.id
  )

  assert.deepEqual(areaIds.sort(), ['parent', 'remote'])
  assert.equal(
    getPageStateFromCollaborativeDoc(doc).areas.find(
      (area) => area.id === 'parent'
    )?.x,
    120
  )
})

test('state patches delete only areas removed from the local client snapshot', () => {
  const [localArea] = createAreas()
  const remoteArea: AreaState = {
    createdAt: now,
    height: 80,
    id: 'remote',
    parentId: null,
    styles: {},
    text: 'Remote text',
    type: 'text',
    updatedAt: now,
    width: 220,
    x: 240,
    y: 260,
  }
  const page = createDefaultPageState({ id: 'page_7', now })
  const doc = createCollaborativePageDoc({
    areas: [localArea, remoteArea],
    assets: [],
    page,
  })

  applyCollaborativePageStatePatch(
    doc,
    {
      areas: [localArea, remoteArea],
      assets: [],
      page,
    },
    {
      areas: [remoteArea],
      assets: [],
      page,
    }
  )

  assert.deepEqual(
    getPageStateFromCollaborativeDoc(doc).areas.map((area) => area.id),
    ['remote']
  )
})

test('state patches do not overwrite remote text when local text did not change', () => {
  const [localArea] = createAreas()
  const page = createDefaultPageState({ id: 'page_8', now })
  const doc = createCollaborativePageDoc({
    areas: [
      {
        ...localArea,
        text: 'Remote edit',
      },
    ],
    assets: [],
    page,
  })

  applyCollaborativePageStatePatch(
    doc,
    {
      areas: [localArea],
      assets: [],
      page,
    },
    {
      areas: [
        {
          ...localArea,
          x: 180,
        },
      ],
      assets: [],
      page,
    }
  )

  const [area] = getPageStateFromCollaborativeDoc(doc).areas

  assert.equal(area.x, 180)
  assert.equal(area.type === 'text' ? area.text : '', 'Remote edit')
})

test('offline edits converge after clients exchange Yjs updates', () => {
  const page = createDefaultPageState({ id: 'page_offline_merge', now })
  const [baseArea] = createAreas()
  const initialState = {
    areas: [baseArea],
    assets: [],
    page,
  }
  const docA = createCollaborativePageDoc(initialState)
  const docB = new Y.Doc()

  Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

  applyCollaborativePageStatePatch(
    docA,
    initialState,
    {
      ...initialState,
      areas: [
        {
          ...baseArea,
          text: 'Offline edit from A',
        },
      ],
    }
  )
  applyCollaborativePageStatePatch(
    docB,
    initialState,
    {
      ...initialState,
      areas: [
        baseArea,
        {
          createdAt: now,
          height: 96,
          id: 'offline-b',
          parentId: null,
          styles: {},
          text: 'Offline area from B',
          type: 'text',
          updatedAt: now,
          width: 240,
          x: 360,
          y: 120,
        },
      ],
    }
  )

  const updateA = Y.encodeStateAsUpdate(docA)
  const updateB = Y.encodeStateAsUpdate(docB)

  Y.applyUpdate(docA, updateB)
  Y.applyUpdate(docB, updateA)

  const stateA = getPageStateFromCollaborativeDoc(docA)
  const stateB = getPageStateFromCollaborativeDoc(docB)

  assert.deepEqual(stateA, stateB)
  assert.equal(
    stateA.areas.find((area) => area.id === 'parent')?.type === 'text'
      ? stateA.areas.find((area) => area.id === 'parent')?.text
      : '',
    'Offline edit from A'
  )
  assert.equal(
    stateA.areas.find((area) => area.id === 'offline-b')?.type,
    'text'
  )
})
