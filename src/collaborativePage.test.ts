import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyCollaborativePageStatePatch,
  applyCollaborativeAreaText,
  createCollaborativePageDoc,
  deleteCollaborativeArea,
  getCollaborativeAreaText,
  getPageStateFromCollaborativeDoc,
  replaceCollaborativePageDocState,
  updateCollaborativeArea,
} from './collaborativePage.ts'
import { createDefaultPageState } from './pagePersistence.ts'
import type { AreaState } from './App.tsx'

const now = '2026-06-26T12:00:00.000Z'

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
    page,
  })

  const exported = getPageStateFromCollaborativeDoc(doc)

  assert.equal(exported.page.id, 'page_1')
  assert.equal(exported.areas.length, 2)
  assert.deepEqual(exported.areas[0], createAreas()[0])
  assert.equal(exported.assets[0].storageKey, 'assets/asset_1.png')
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
