import * as Y from 'yjs'

import type { AreaState, AssetState, ImageAreaState, TextAreaState } from './App'
import {
  isAreaKind,
  isAreaStatus,
  normalizeAreaMetadata,
  type AreaLink,
  type AreaMetadata,
} from './areaMetadata.ts'
import type { PageAppState, PageState } from './pagePersistence'

type CollaborativeAreaPatch = Partial<Omit<AreaState, 'styles'>> & {
  styles?: Record<string, string>
}

const PAGE_MAP = 'page'
const AREAS_MAP = 'areas'
const ASSETS_MAP = 'assets'
const LINKS_MAP = 'links'

export const createCollaborativePageDoc = (state: PageAppState) => {
  const doc = new Y.Doc()

  replaceCollaborativePageDocState(doc, state)

  return doc
}

export const replaceCollaborativePageDocState = (
  doc: Y.Doc,
  state: PageAppState,
  origin?: unknown
) => {
  doc.transact(() => {
    const pageMap = getPageMap(doc)
    const areasMap = getAreasMap(doc)
    const assetsMap = getAssetsMap(doc)
    const linksMap = getLinksMap(doc)

    pageMap.clear()
    areasMap.clear()
    assetsMap.clear()
    linksMap.clear()

    writePageMap(pageMap, state.page)

    for (const area of state.areas) {
      areasMap.set(area.id, createCollaborativeAreaMap(area))
    }

    for (const asset of state.assets) {
      assetsMap.set(asset.id, createPlainMap(asset))
    }

    for (const link of state.links ?? []) {
      linksMap.set(link.id, createPlainMap(link))
    }
  }, origin)
}

export const applyCollaborativePageStatePatch = (
  doc: Y.Doc,
  previousState: PageAppState,
  nextState: PageAppState,
  origin?: unknown
) => {
  doc.transact(() => {
    patchPageMap(getPageMap(doc), previousState.page, nextState.page)
    patchAreasMap(
      getAreasMap(doc),
      previousState.areas,
      nextState.areas
    )
    patchAssetsMap(
      getAssetsMap(doc),
      previousState.assets,
      nextState.assets
    )
    patchLinksMap(
      getLinksMap(doc),
      previousState.links ?? [],
      nextState.links ?? []
    )
  }, origin)
}

export const getPageStateFromCollaborativeDoc = (
  doc: Y.Doc
): PageAppState => ({
  page: readPageMap(getPageMap(doc)),
  areas: readAreasMap(getAreasMap(doc)),
  assets: readAssetsMap(getAssetsMap(doc)),
  links: readLinksMap(getLinksMap(doc)),
})

export const getCollaborativeAreaText = (doc: Y.Doc, areaId: string) => {
  const areaMap = getAreasMap(doc).get(areaId)
  const text = areaMap?.get('text')

  if (!(text instanceof Y.Text)) {
    throw new Error(`Area ${areaId} does not have collaborative text.`)
  }

  return text
}

export const applyCollaborativeAreaText = (
  doc: Y.Doc,
  areaId: string,
  nextText: string
) => {
  const text = getCollaborativeAreaText(doc, areaId)
  const currentText = text.toString()

  if (currentText === nextText) return

  const diff = getTextDiff(currentText, nextText)

  doc.transact(() => {
    applyTextDiff(text, diff)
  })
}

export const updateCollaborativeArea = (
  doc: Y.Doc,
  areaId: string,
  patch: CollaborativeAreaPatch
) => {
  const areaMap = getAreasMap(doc).get(areaId)
  if (!areaMap) return

  doc.transact(() => {
    const { styles, text, ...restPatch } = patch as CollaborativeAreaPatch & {
      text?: string
    }

    for (const [key, value] of Object.entries(restPatch)) {
      areaMap.set(key, cloneJsonValue(value))
    }

    if (styles) {
      const stylesMap = getStylesMap(areaMap)
      for (const [property, value] of Object.entries(styles)) {
        stylesMap.set(property, value)
      }
    }

    if (typeof text === 'string') {
      applyCollaborativeAreaText(doc, areaId, text)
    }
  })
}

export const deleteCollaborativeArea = (doc: Y.Doc, areaId: string) => {
  const areasMap = getAreasMap(doc)
  const deletedAreaIds = getAreaAndDescendantIds(areasMap, areaId)

  doc.transact(() => {
    for (const deletedAreaId of deletedAreaIds) {
      areasMap.delete(deletedAreaId)
    }
  })
}

const writePageMap = (pageMap: Y.Map<unknown>, page: PageState) => {
  pageMap.set('id', page.id)
  pageMap.set('title', page.title)
  pageMap.set('createdAt', page.createdAt)
  pageMap.set('updatedAt', page.updatedAt)
  pageMap.set('settings', cloneJsonValue(page.settings))
}

const patchPageMap = (
  pageMap: Y.Map<unknown>,
  previousPage: PageState,
  nextPage: PageState
) => {
  setMapValueIfChanged(pageMap, 'id', previousPage.id, nextPage.id)
  setMapValueIfChanged(
    pageMap,
    'title',
    previousPage.title,
    nextPage.title
  )
  setMapValueIfChanged(
    pageMap,
    'createdAt',
    previousPage.createdAt,
    nextPage.createdAt
  )
  setMapValueIfChanged(
    pageMap,
    'updatedAt',
    previousPage.updatedAt,
    nextPage.updatedAt
  )
  setMapValueIfChanged(
    pageMap,
    'settings',
    previousPage.settings,
    nextPage.settings
  )
}

const readPageMap = (pageMap: Y.Map<unknown>): PageState => ({
  id: String(pageMap.get('id') ?? ''),
  title: String(pageMap.get('title') ?? 'Untitled page'),
  createdAt: String(pageMap.get('createdAt') ?? ''),
  updatedAt: String(pageMap.get('updatedAt') ?? ''),
  settings: readPageSettings(pageMap.get('settings')),
})

const readPageSettings = (value: unknown): PageState['settings'] => {
  const settings = readRecord(cloneJsonValue(value))
  const snapGrid = readRecord(settings.snapGrid)
  const theme = readRecord(settings.theme)
  const mcp = readRecord(settings.mcp)

  return {
    background:
      typeof settings.background === 'string'
        ? settings.background
        : '#ffffff',
    snapGrid: {
      enabled:
        typeof snapGrid.enabled === 'boolean'
          ? snapGrid.enabled
          : false,
      size: typeof snapGrid.size === 'number' ? snapGrid.size : 16,
      visible:
        typeof snapGrid.visible === 'boolean'
          ? snapGrid.visible
          : false,
    },
    theme: {
      colors: Array.isArray(theme.colors)
        ? (theme.colors as PageState['settings']['theme']['colors'])
        : [],
    },
    mcp: {
      enabled: typeof mcp.enabled === 'boolean' ? mcp.enabled : false,
    },
    shareLinks: null,
  }
}

const createCollaborativeAreaMap = (area: AreaState) => {
  const areaMap = new Y.Map<unknown>()

  areaMap.set('id', area.id)
  areaMap.set('type', area.type ?? 'text')
  areaMap.set('parentId', area.parentId)
  areaMap.set('x', area.x)
  areaMap.set('y', area.y)
  areaMap.set('width', area.width)
  areaMap.set('height', area.height)
  areaMap.set('createdAt', area.createdAt)
  areaMap.set('updatedAt', area.updatedAt)
  areaMap.set('styles', createStylesMap(area.styles))
  if (area.metadata) {
    areaMap.set('metadata', cloneJsonValue(area.metadata))
  }

  if (area.type === 'image') {
    areaMap.set('assetId', area.assetId)
    areaMap.set('alt', area.alt)
  } else {
    const text = new Y.Text()
    text.insert(0, area.text)
    areaMap.set('text', text)
  }

  return areaMap
}

const patchAreasMap = (
  areasMap: Y.Map<Y.Map<unknown>>,
  previousAreas: AreaState[],
  nextAreas: AreaState[]
) => {
  const previousAreasById = new Map(
    previousAreas.map((area) => [area.id, area])
  )
  const nextAreasById = new Map(nextAreas.map((area) => [area.id, area]))

  for (const [areaId, previousArea] of previousAreasById) {
    if (!nextAreasById.has(areaId)) {
      areasMap.delete(previousArea.id)
    }
  }

  for (const nextArea of nextAreas) {
    const previousArea = previousAreasById.get(nextArea.id)
    const existingAreaMap = areasMap.get(nextArea.id)

    if (
      !existingAreaMap ||
      (previousArea && previousArea.type !== nextArea.type)
    ) {
      areasMap.set(nextArea.id, createCollaborativeAreaMap(nextArea))
      continue
    }

    patchCollaborativeAreaMap(
      existingAreaMap,
      previousArea,
      nextArea
    )
  }
}

const patchCollaborativeAreaMap = (
  areaMap: Y.Map<unknown>,
  previousArea: AreaState | undefined,
  nextArea: AreaState
) => {
  const commonFields = [
    'id',
    'type',
    'parentId',
    'x',
    'y',
    'width',
    'height',
    'createdAt',
    'updatedAt',
    'metadata',
  ] satisfies Array<keyof AreaState>

  for (const field of commonFields) {
    setMapValueIfChanged(
      areaMap,
      field,
      previousArea?.[field],
      nextArea[field]
    )
  }

  patchStylesMap(
    getStylesMap(areaMap),
    previousArea?.styles ?? {},
    nextArea.styles
  )

  if (nextArea.type === 'image') {
    setMapValueIfChanged(
      areaMap,
      'assetId',
      previousArea?.type === 'image' ? previousArea.assetId : undefined,
      nextArea.assetId
    )
    setMapValueIfChanged(
      areaMap,
      'alt',
      previousArea?.type === 'image' ? previousArea.alt : undefined,
      nextArea.alt
    )
    return
  }

  if (previousArea?.type === 'text' && previousArea.text === nextArea.text) {
    return
  }

  const text = getAreaTextMapValue(areaMap)
  const diff = getTextDiff(text.toString(), nextArea.text)
  applyTextDiff(text, diff)
}

const readAreasMap = (areasMap: Y.Map<Y.Map<unknown>>) => {
  const areas: AreaState[] = []

  areasMap.forEach((areaMap) => {
    const metadata = readAreaMetadata(areaMap.get('metadata'))
    const base = {
      id: String(areaMap.get('id') ?? ''),
      parentId: readNullableString(areaMap.get('parentId')),
      x: Number(areaMap.get('x') ?? 0),
      y: Number(areaMap.get('y') ?? 0),
      width: Number(areaMap.get('width') ?? 0),
      height: Number(areaMap.get('height') ?? 0),
      styles: readStylesMap(getStylesMap(areaMap)),
      ...(metadata ? { metadata } : {}),
      createdAt: readOptionalString(areaMap.get('createdAt')),
      updatedAt: readOptionalString(areaMap.get('updatedAt')),
    }

    if (areaMap.get('type') === 'image') {
      areas.push({
        ...base,
        type: 'image',
        assetId: String(areaMap.get('assetId') ?? ''),
        alt: String(areaMap.get('alt') ?? ''),
      } satisfies ImageAreaState)
      return
    }

    const text = areaMap.get('text')
    areas.push({
      ...base,
      type: 'text',
      text: text instanceof Y.Text ? text.toString() : '',
    } satisfies TextAreaState)
  })

  return areas
}

const readAssetsMap = (assetsMap: Y.Map<Y.Map<unknown>>) => {
  const assets: AssetState[] = []

  assetsMap.forEach((assetMap) => {
    assets.push({
      id: String(assetMap.get('id') ?? ''),
      kind: 'image',
      mimeType: String(assetMap.get('mimeType') ?? ''),
      width: Number(assetMap.get('width') ?? 0),
      height: Number(assetMap.get('height') ?? 0),
      storageKey: String(assetMap.get('storageKey') ?? ''),
      createdAt: String(assetMap.get('createdAt') ?? ''),
    })
  })

  return assets
}

const readLinksMap = (linksMap: Y.Map<Y.Map<unknown>>) => {
  const links: AreaLink[] = []

  linksMap.forEach((linkMap) => {
    const kind = String(linkMap.get('kind') ?? 'relates-to')

    links.push({
      id: String(linkMap.get('id') ?? ''),
      fromAreaId: String(linkMap.get('fromAreaId') ?? ''),
      toAreaId: String(linkMap.get('toAreaId') ?? ''),
      kind: isKnownAreaLinkKind(kind) ? kind : 'relates-to',
      ...(typeof linkMap.get('label') === 'string'
        ? { label: String(linkMap.get('label')) }
        : {}),
      createdAt: String(linkMap.get('createdAt') ?? ''),
      updatedAt: String(linkMap.get('updatedAt') ?? ''),
    })
  })

  return links
}

const createPlainMap = (value: Record<string, unknown>) => {
  const map = new Y.Map<unknown>()

  for (const [key, entryValue] of Object.entries(value)) {
    map.set(key, cloneJsonValue(entryValue))
  }

  return map
}

const patchAssetsMap = (
  assetsMap: Y.Map<Y.Map<unknown>>,
  previousAssets: AssetState[],
  nextAssets: AssetState[]
) => {
  const previousAssetsById = new Map(
    previousAssets.map((asset) => [asset.id, asset])
  )
  const nextAssetsById = new Map(
    nextAssets.map((asset) => [asset.id, asset])
  )

  for (const [assetId] of previousAssetsById) {
    if (!nextAssetsById.has(assetId)) {
      assetsMap.delete(assetId)
    }
  }

  for (const nextAsset of nextAssets) {
    const previousAsset = previousAssetsById.get(nextAsset.id)
    const assetMap = assetsMap.get(nextAsset.id)

    if (!assetMap) {
      assetsMap.set(nextAsset.id, createPlainMap(nextAsset))
      continue
    }

    for (const [key, value] of Object.entries(nextAsset)) {
      setMapValueIfChanged(
        assetMap,
        key,
        previousAsset?.[key as keyof AssetState],
        value
      )
    }
  }
}

const patchLinksMap = (
  linksMap: Y.Map<Y.Map<unknown>>,
  previousLinks: AreaLink[],
  nextLinks: AreaLink[]
) => {
  const previousLinksById = new Map(
    previousLinks.map((link) => [link.id, link])
  )
  const nextLinksById = new Map(nextLinks.map((link) => [link.id, link]))

  for (const [linkId] of previousLinksById) {
    if (!nextLinksById.has(linkId)) {
      linksMap.delete(linkId)
    }
  }

  for (const nextLink of nextLinks) {
    const previousLink = previousLinksById.get(nextLink.id)
    const linkMap = linksMap.get(nextLink.id)

    if (!linkMap) {
      linksMap.set(nextLink.id, createPlainMap(nextLink))
      continue
    }

    for (const [key, value] of Object.entries(nextLink)) {
      setMapValueIfChanged(
        linkMap,
        key,
        previousLink?.[key as keyof AreaLink],
        value
      )
    }
  }
}

const createStylesMap = (styles: Record<string, string>) => {
  const map = new Y.Map<string>()

  for (const [property, value] of Object.entries(styles)) {
    map.set(property, value)
  }

  return map
}

const patchStylesMap = (
  stylesMap: Y.Map<string>,
  previousStyles: Record<string, string>,
  nextStyles: Record<string, string>
) => {
  for (const property of Object.keys(previousStyles)) {
    if (!(property in nextStyles)) {
      stylesMap.delete(property)
    }
  }

  for (const [property, value] of Object.entries(nextStyles)) {
    if (previousStyles[property] !== value) {
      stylesMap.set(property, value)
    }
  }
}

const getStylesMap = (areaMap: Y.Map<unknown>) => {
  const stylesMap = areaMap.get('styles')

  if (stylesMap instanceof Y.Map) {
    return stylesMap as Y.Map<string>
  }

  const nextStylesMap = new Y.Map<string>()
  areaMap.set('styles', nextStylesMap)
  return nextStylesMap
}

const getAreaTextMapValue = (areaMap: Y.Map<unknown>) => {
  const existingText = areaMap.get('text')

  if (existingText instanceof Y.Text) {
    return existingText
  }

  const text = new Y.Text()
  areaMap.set('text', text)
  return text
}

const readStylesMap = (stylesMap: Y.Map<string>) =>
  Object.fromEntries(stylesMap.entries())

const readAreaMetadata = (value: unknown): AreaMetadata | undefined => {
  const metadata = readRecord(cloneJsonValue(value))

  if (!metadata.kind) return undefined
  const kind = isAreaKind(metadata.kind) ? metadata.kind : 'note'

  return normalizeAreaMetadata({
    kind,
    ...(isAreaStatus(metadata.status)
      ? { status: metadata.status }
      : {}),
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    ...(typeof metadata.filePath === 'string'
      ? { filePath: metadata.filePath }
      : {}),
    ...(typeof metadata.url === 'string' ? { url: metadata.url } : {}),
    ...(Array.isArray(metadata.evidence)
      ? { evidence: metadata.evidence as AreaMetadata['evidence'] }
      : {}),
  })
}

const isKnownAreaLinkKind = (kind: string): kind is AreaLink['kind'] =>
  [
    'relates-to',
    'depends-on',
    'implements',
    'blocks',
    'answers',
    'references',
  ].includes(kind)

const getPageMap = (doc: Y.Doc) => doc.getMap<unknown>(PAGE_MAP)

const getAreasMap = (doc: Y.Doc) =>
  doc.getMap<Y.Map<unknown>>(AREAS_MAP)

const getAssetsMap = (doc: Y.Doc) =>
  doc.getMap<Y.Map<unknown>>(ASSETS_MAP)

const getLinksMap = (doc: Y.Doc) =>
  doc.getMap<Y.Map<unknown>>(LINKS_MAP)

const getAreaAndDescendantIds = (
  areasMap: Y.Map<Y.Map<unknown>>,
  areaId: string
) => {
  const areaIds = new Set([areaId])
  const pendingAreaIds = [areaId]

  while (pendingAreaIds.length > 0) {
    const parentId = pendingAreaIds.pop()

    areasMap.forEach((areaMap) => {
      const currentAreaId = areaMap.get('id')
      if (
        typeof currentAreaId === 'string' &&
        parentId &&
        areaMap.get('parentId') === parentId &&
        !areaIds.has(currentAreaId)
      ) {
        areaIds.add(currentAreaId)
        pendingAreaIds.push(currentAreaId)
      }
    })
  }

  return areaIds
}

const getTextDiff = (currentText: string, nextText: string) => {
  let index = 0

  while (
    index < currentText.length &&
    index < nextText.length &&
    currentText[index] === nextText[index]
  ) {
    index += 1
  }

  let currentEnd = currentText.length
  let nextEnd = nextText.length

  while (
    currentEnd > index &&
    nextEnd > index &&
    currentText[currentEnd - 1] === nextText[nextEnd - 1]
  ) {
    currentEnd -= 1
    nextEnd -= 1
  }

  return {
    index,
    deleteLength: currentEnd - index,
    insertText: nextText.slice(index, nextEnd),
  }
}

const applyTextDiff = (
  text: Y.Text,
  diff: ReturnType<typeof getTextDiff>
) => {
  if (diff.deleteLength > 0) {
    text.delete(diff.index, diff.deleteLength)
  }

  if (diff.insertText) {
    text.insert(diff.index, diff.insertText)
  }
}

const setMapValueIfChanged = (
  map: Y.Map<unknown>,
  key: string,
  previousValue: unknown,
  nextValue: unknown
) => {
  if (jsonValuesEqual(previousValue, nextValue)) return

  map.set(key, cloneJsonValue(nextValue))
}

const jsonValuesEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right)

const readNullableString = (value: unknown) =>
  typeof value === 'string' ? value : null

const readOptionalString = (value: unknown) =>
  typeof value === 'string' ? value : undefined

const readRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const cloneJsonValue = (value: unknown) =>
  value === undefined ? value : JSON.parse(JSON.stringify(value))
