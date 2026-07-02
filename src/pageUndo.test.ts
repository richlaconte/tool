import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LOCAL_ORIGIN,
  createCollaborativePageDoc,
  getPageStateFromCollaborativeDoc,
  updateCollaborativeArea,
} from './collaborativePage.ts'
import {
  canRedo,
  canUndo,
  createPageUndoManager,
  redo,
  undo,
} from './pageUndo.ts'
import { createDefaultPageState } from './pagePersistence.ts'

const now = '2026-07-02T12:00:00.000Z'

const createDoc = () =>
  createCollaborativePageDoc({
    areas: [
      {
        id: 'area-1',
        parentId: null,
        x: 20,
        y: 40,
        width: 240,
        height: 100,
        text: 'First',
        type: 'text',
        styles: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    assets: [],
    comments: [],
    links: [],
    page: createDefaultPageState({ id: 'page-undo', now }),
  })

test('undo manager tracks only local user origins', () => {
  const doc = createDoc()
  const manager = createPageUndoManager(doc)

  updateCollaborativeArea(
    doc,
    'area-1',
    {
      x: 120,
    },
    'remote-user'
  )
  assert.equal(canUndo(manager), false)

  updateCollaborativeArea(doc, 'area-1', {
    y: 180,
  })

  assert.equal(canUndo(manager), true)
  undo(manager)

  const [area] = getPageStateFromCollaborativeDoc(doc).areas
  assert.equal(area.x, 120)
  assert.equal(area.y, 40)
  assert.equal(canRedo(manager), true)

  redo(manager)
  assert.equal(getPageStateFromCollaborativeDoc(doc).areas[0].y, 180)

  manager.destroy()
})

test('undo manager coalesces rapid local changes and clears redo after new edits', () => {
  const doc = createDoc()
  const manager = createPageUndoManager(doc)

  updateCollaborativeArea(doc, 'area-1', {
    x: 60,
  })
  updateCollaborativeArea(doc, 'area-1', {
    y: 80,
  })

  undo(manager)
  assert.deepEqual(
    getPageStateFromCollaborativeDoc(doc).areas.map(({ id, x, y }) => ({
      id,
      x,
      y,
    })),
    [{ id: 'area-1', x: 20, y: 40 }]
  )
  assert.equal(canRedo(manager), true)

  updateCollaborativeArea(doc, 'area-1', {
    width: 300,
  })
  assert.equal(canRedo(manager), false)

  manager.destroy()
})

test('undo managers are isolated per page document', () => {
  const firstDoc = createDoc()
  const secondDoc = createDoc()
  const firstManager = createPageUndoManager(firstDoc)
  const secondManager = createPageUndoManager(secondDoc)

  updateCollaborativeArea(firstDoc, 'area-1', {
    x: 400,
  })

  assert.equal(canUndo(firstManager), true)
  assert.equal(canUndo(secondManager), false)

  firstManager.destroy()
  secondManager.destroy()
})

test('page metadata is outside the undo scope', () => {
  const doc = createDoc()
  const manager = createPageUndoManager(doc)

  doc.transact(() => {
    doc.getMap('page').set('title', 'Changed title')
  }, LOCAL_ORIGIN)

  assert.equal(canUndo(manager), false)
  assert.equal(getPageStateFromCollaborativeDoc(doc).page.title, 'Changed title')

  manager.destroy()
})
