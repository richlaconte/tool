import type { Database as DatabaseConnection } from 'better-sqlite3'
import * as Y from 'yjs'

export type StoredPageState = {
  page: {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    settings: {
      background: string
      snapGrid: {
        enabled: boolean
        size: number
        visible: boolean
      }
      theme: {
        colors: Array<Record<string, unknown>>
      }
      shareLinks: null
    }
  }
  areas: Array<
    | {
        id: string
        type?: 'text'
        parentId: string | null
        x: number
        y: number
        width: number
        height: number
        text: string
        styles: Record<string, string>
        createdAt?: string
        updatedAt?: string
      }
    | {
        id: string
        type: 'image'
        parentId: string | null
        x: number
        y: number
        width: number
        height: number
        assetId: string
        alt: string
        styles: Record<string, string>
        createdAt?: string
        updatedAt?: string
      }
  >
  assets: Array<{
    id: string
    kind: 'image'
    mimeType: string
    width: number
    height: number
    storageKey: string
    createdAt: string
  }>
}

type DocumentRow = {
  data: Buffer
}

export const setupCollaborativeDocumentStorage = (
  database: DatabaseConnection
) => {
  database.exec(`
    create table if not exists "documents" (
      "name" varchar(255) not null,
      "data" blob not null,
      unique(name)
    );
  `)
}

export const getStoredCollaborativePageState = (
  database: DatabaseConnection,
  pageId: string
): StoredPageState | null => {
  setupCollaborativeDocumentStorage(database)

  const row = database
    .prepare('select data from documents where name = ? order by rowid desc')
    .get(`page:${pageId}`) as DocumentRow | undefined

  if (!row) return null

  const doc = new Y.Doc()
  Y.applyUpdate(doc, new Uint8Array(row.data))

  return readPageStateFromDoc(doc, pageId)
}

const readPageStateFromDoc = (
  doc: Y.Doc,
  fallbackPageId: string
): StoredPageState => ({
  page: readPageMap(doc.getMap('page'), fallbackPageId),
  areas: readAreasMap(doc.getMap<Y.Map<unknown>>('areas')),
  assets: readAssetsMap(doc.getMap<Y.Map<unknown>>('assets')),
})

const readPageMap = (
  pageMap: Y.Map<unknown>,
  fallbackPageId: string
): StoredPageState['page'] => {
  const settings = readRecord(pageMap.get('settings'))

  return {
    id: readString(pageMap.get('id'), fallbackPageId),
    title: readString(pageMap.get('title'), 'Untitled page'),
    createdAt: readString(pageMap.get('createdAt'), ''),
    updatedAt: readString(pageMap.get('updatedAt'), ''),
    settings: {
      background: readString(settings.background, '#ffffff'),
      snapGrid: {
        enabled: readBoolean(
          readRecord(settings.snapGrid).enabled,
          false
        ),
        size: readNumber(readRecord(settings.snapGrid).size, 16),
        visible: readBoolean(
          readRecord(settings.snapGrid).visible,
          false
        ),
      },
      theme: {
        colors: Array.isArray(readRecord(settings.theme).colors)
          ? (readRecord(settings.theme).colors as Array<
              Record<string, unknown>
            >)
          : [],
      },
      shareLinks: null,
    },
  }
}

const readAreasMap = (areasMap: Y.Map<Y.Map<unknown>>) => {
  const areas: StoredPageState['areas'] = []

  areasMap.forEach((areaMap) => {
    const base = {
      id: readString(areaMap.get('id'), ''),
      parentId: readNullableString(areaMap.get('parentId')),
      x: readNumber(areaMap.get('x'), 0),
      y: readNumber(areaMap.get('y'), 0),
      width: readNumber(areaMap.get('width'), 0),
      height: readNumber(areaMap.get('height'), 0),
      styles: readStylesMap(areaMap.get('styles')),
      createdAt: readOptionalString(areaMap.get('createdAt')),
      updatedAt: readOptionalString(areaMap.get('updatedAt')),
    }

    if (areaMap.get('type') === 'image') {
      areas.push({
        ...base,
        type: 'image',
        assetId: readString(areaMap.get('assetId'), ''),
        alt: readString(areaMap.get('alt'), ''),
      })
      return
    }

    const text = areaMap.get('text')

    areas.push({
      ...base,
      text: text instanceof Y.Text ? text.toString() : '',
    })
  })

  return areas
}

const readAssetsMap = (assetsMap: Y.Map<Y.Map<unknown>>) => {
  const assets: StoredPageState['assets'] = []

  assetsMap.forEach((assetMap) => {
    assets.push({
      id: readString(assetMap.get('id'), ''),
      kind: 'image',
      mimeType: readString(assetMap.get('mimeType'), ''),
      width: readNumber(assetMap.get('width'), 0),
      height: readNumber(assetMap.get('height'), 0),
      storageKey: readString(assetMap.get('storageKey'), ''),
      createdAt: readString(assetMap.get('createdAt'), ''),
    })
  })

  return assets
}

const readStylesMap = (value: unknown) => {
  if (!(value instanceof Y.Map)) return {}

  const styles: Record<string, string> = {}

  value.forEach((styleValue, key) => {
    if (typeof styleValue === 'string') {
      styles[key] = styleValue
    }
  })

  return styles
}

const readRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const readString = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value : fallback

const readOptionalString = (value: unknown) =>
  typeof value === 'string' ? value : undefined

const readNullableString = (value: unknown) =>
  typeof value === 'string' ? value : null

const readNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback
