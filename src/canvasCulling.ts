import type { AreaState } from './App'
import type { AreaLink } from './areaMetadata.ts'
import { getAreaAbsoluteRect } from './nestedAreas.ts'

export type CanvasCullingViewport = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasCullingRect = CanvasCullingViewport

export type CanvasCullingOptions = {
  viewport: CanvasCullingViewport
  margin?: number
  alwaysRenderAreaIds?: Iterable<string | null | undefined>
}

const rectsIntersect = (
  first: CanvasCullingRect,
  second: CanvasCullingRect
) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y

export const getVisibleCanvasRect = ({
  viewport,
  margin = 400,
}: {
  viewport: CanvasCullingViewport
  margin?: number
}): CanvasCullingRect => {
  const overscan = Math.max(0, margin)

  return {
    x: viewport.x - overscan,
    y: viewport.y - overscan,
    width: viewport.width + overscan * 2,
    height: viewport.height + overscan * 2,
  }
}

const addAreaAndAncestors = (
  visibleAreaIds: Set<string>,
  areasById: Map<string, AreaState>,
  areaId: string
) => {
  let currentArea = areasById.get(areaId)
  const visitedAreaIds = new Set<string>()

  while (currentArea && !visitedAreaIds.has(currentArea.id)) {
    visibleAreaIds.add(currentArea.id)
    visitedAreaIds.add(currentArea.id)

    if (!currentArea.parentId) return

    currentArea = areasById.get(currentArea.parentId)
  }
}

export const getVisibleAreaIds = (
  areas: AreaState[],
  options: CanvasCullingOptions
) => {
  if (areas.length === 0) return []

  const visibleRect = getVisibleCanvasRect(options)
  const visibleAreaIds = new Set<string>()
  const areasById = new Map(areas.map((area) => [area.id, area]))

  areas.forEach((area) => {
    if (rectsIntersect(getAreaAbsoluteRect(areas, area.id), visibleRect)) {
      addAreaAndAncestors(visibleAreaIds, areasById, area.id)
    }
  })

  for (const areaId of options.alwaysRenderAreaIds ?? []) {
    if (areaId) {
      addAreaAndAncestors(visibleAreaIds, areasById, areaId)
    }
  }

  return areas
    .filter((area) => visibleAreaIds.has(area.id))
    .map((area) => area.id)
}

export const isAreaLinkVisible = (
  link: Pick<AreaLink, 'fromAreaId' | 'toAreaId'>,
  visibleAreaIds: ReadonlySet<string>
) =>
  visibleAreaIds.has(link.fromAreaId) ||
  visibleAreaIds.has(link.toAreaId)
