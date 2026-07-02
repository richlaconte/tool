import * as Y from 'yjs'

import { LOCAL_ORIGIN } from './collaborativePage.ts'

const AREAS_MAP = 'areas'
const ASSETS_MAP = 'assets'
const LINKS_MAP = 'links'
const COMMENTS_MAP = 'comments'

export type PageUndoManager = Y.UndoManager

export const createPageUndoManager = (doc: Y.Doc): PageUndoManager =>
  new Y.UndoManager(
    [
      doc.getMap(AREAS_MAP),
      doc.getMap(ASSETS_MAP),
      doc.getMap(LINKS_MAP),
      doc.getMap(COMMENTS_MAP),
    ],
    {
      captureTimeout: 300,
      trackedOrigins: new Set([LOCAL_ORIGIN]),
    }
  )

export const canUndo = (manager: PageUndoManager) =>
  manager.undoStack.length > 0

export const canRedo = (manager: PageUndoManager) =>
  manager.redoStack.length > 0

export const undo = (manager: PageUndoManager) => {
  if (!canUndo(manager)) return

  manager.undo()
}

export const redo = (manager: PageUndoManager) => {
  if (!canRedo(manager)) return

  manager.redo()
}
