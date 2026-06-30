import type { Database as DatabaseConnection } from 'better-sqlite3'
import * as Y from 'yjs'

import {
  isAreaKind,
  isAreaLinkKind,
  isAreaStatus,
  normalizeAreaMetadata,
  normalizeAreaLink,
  type AreaLink,
  type AreaMetadata,
} from '../areaMetadata.ts'
import type { GifAssetSource } from '../gifSearch.ts'

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
      mcp: {
        enabled: boolean
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
        metadata?: AreaMetadata
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
        metadata?: AreaMetadata
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
    source?: GifAssetSource
  }>
  links: AreaLink[]
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
  links: readLinksMap(doc.getMap<Y.Map<unknown>>('links')),
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
      mcp: {
        enabled: readBoolean(readRecord(settings.mcp).enabled, false),
      },
      shareLinks: null,
    },
  }
}

const readAreasMap = (areasMap: Y.Map<Y.Map<unknown>>) => {
  const areas: StoredPageState['areas'] = []

  areasMap.forEach((areaMap) => {
    const metadata = readAreaMetadata(areaMap.get('metadata'))
    const base = {
      id: readString(areaMap.get('id'), ''),
      parentId: readNullableString(areaMap.get('parentId')),
      x: readNumber(areaMap.get('x'), 0),
      y: readNumber(areaMap.get('y'), 0),
      width: readNumber(areaMap.get('width'), 0),
      height: readNumber(areaMap.get('height'), 0),
      styles: readStylesMap(areaMap.get('styles')),
      ...(metadata ? { metadata } : {}),
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
    const source = readGifAssetSource(assetMap.get('source'))

    assets.push({
      id: readString(assetMap.get('id'), ''),
      kind: 'image',
      mimeType: readString(assetMap.get('mimeType'), ''),
      width: readNumber(assetMap.get('width'), 0),
      height: readNumber(assetMap.get('height'), 0),
      storageKey: readString(assetMap.get('storageKey'), ''),
      createdAt: readString(assetMap.get('createdAt'), ''),
      ...(source ? { source } : {}),
    })
  })

  return assets
}

const readLinksMap = (linksMap: Y.Map<Y.Map<unknown>>) => {
  const links: AreaLink[] = []

  linksMap.forEach((linkMap) => {
    const kind = readString(linkMap.get('kind'), 'relates-to')

    links.push(
      normalizeAreaLink({
        id: readString(linkMap.get('id'), ''),
        fromAreaId: readString(linkMap.get('fromAreaId'), ''),
        toAreaId: readString(linkMap.get('toAreaId'), ''),
        kind: isAreaLinkKind(kind) ? kind : 'relates-to',
        ...(typeof linkMap.get('label') === 'string'
          ? { label: readString(linkMap.get('label'), '') }
          : {}),
        ...(Object.keys(readRecord(linkMap.get('from'))).length > 0
          ? {
              from: readRecord(
                linkMap.get('from')
              ) as AreaLink['from'],
            }
          : {}),
        ...(Object.keys(readRecord(linkMap.get('to'))).length > 0
          ? {
              to: readRecord(linkMap.get('to')) as AreaLink['to'],
            }
          : {}),
        ...(Object.keys(readRecord(linkMap.get('visual'))).length > 0
          ? {
              visual: readRecord(
                linkMap.get('visual')
              ) as AreaLink['visual'],
            }
          : {}),
        ...(Object.keys(readRecord(linkMap.get('schema'))).length > 0
          ? {
              schema: readRecord(
                linkMap.get('schema')
              ) as AreaLink['schema'],
            }
          : {}),
        createdAt: readString(linkMap.get('createdAt'), ''),
        updatedAt: readString(linkMap.get('updatedAt'), ''),
      })
    )
  })

  return links
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

const readGifAssetSource = (value: unknown): GifAssetSource | undefined => {
  const source = readRecord(value)

  if (
    source.provider !== 'giphy' ||
    typeof source.providerAssetId !== 'string' ||
    typeof source.providerUrl !== 'string' ||
    typeof source.title !== 'string' ||
    typeof source.rendition !== 'string' ||
    typeof source.animatedUrl !== 'string' ||
    source.attributionLabel !== 'Powered by GIPHY'
  ) {
    return undefined
  }

  const analytics = readRecord(source.analytics)

  return {
    provider: 'giphy',
    providerAssetId: source.providerAssetId,
    providerUrl: source.providerUrl,
    title: source.title,
    ...(typeof source.rating === 'string'
      ? { rating: source.rating }
      : {}),
    rendition: source.rendition,
    ...(typeof source.stillUrl === 'string'
      ? { stillUrl: source.stillUrl }
      : {}),
    animatedUrl: source.animatedUrl,
    attributionLabel: 'Powered by GIPHY',
    ...(Object.keys(analytics).length > 0
      ? {
          analytics: {
            ...(typeof analytics.onload === 'string'
              ? { onload: analytics.onload }
              : {}),
            ...(typeof analytics.onclick === 'string'
              ? { onclick: analytics.onclick }
              : {}),
            ...(typeof analytics.onsent === 'string'
              ? { onsent: analytics.onsent }
              : {}),
          },
        }
      : {}),
  }
}

const readAreaMetadata = (value: unknown): AreaMetadata | undefined => {
  const metadata = readRecord(value)

  if (!isAreaKind(metadata.kind)) return undefined

  return normalizeAreaMetadata({
    kind: metadata.kind,
    ...(isAreaStatus(metadata.status)
      ? { status: metadata.status }
      : {}),
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    ...(typeof metadata.filePath === 'string'
      ? { filePath: metadata.filePath }
      : {}),
    ...(typeof metadata.url === 'string' ? { url: metadata.url } : {}),
  })
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
