import type { AreaState } from './App'

export const DUPLICATE_AREA_OFFSET = {
  x: 16,
  y: 16,
}

export type DuplicateAreaResult = {
  areas: AreaState[]
  selectedAreaId: string | null
}

export type DeletedAreaSnapshot = {
  area: AreaState
  descendantAreas: AreaState[]
  index: number
  deletedAt: number
}

export type DeleteAreaResult = {
  areas: AreaState[]
  deletedArea: DeletedAreaSnapshot | null
}

export const duplicateArea = (
  areas: AreaState[],
  sourceAreaId: string,
  newAreaId: string
): DuplicateAreaResult => {
  const sourceArea = areas.find((area) => area.id === sourceAreaId)

  if (!sourceArea) {
    return {
      areas,
      selectedAreaId: null,
    }
  }

  const duplicatedArea: AreaState = {
    ...cloneArea(sourceArea),
    id: newAreaId,
    x: sourceArea.x + DUPLICATE_AREA_OFFSET.x,
    y: sourceArea.y + DUPLICATE_AREA_OFFSET.y,
  }

  return {
    areas: [...areas, duplicatedArea],
    selectedAreaId: duplicatedArea.id,
  }
}

export const deleteArea = (
  areas: AreaState[],
  areaId: string,
  deletedAt = Date.now()
): DeleteAreaResult => {
  const index = areas.findIndex((area) => area.id === areaId)

  if (index === -1) {
    return {
      areas,
      deletedArea: null,
    }
  }

  const area = areas[index]
  const descendantAreaIds = getDescendantAreaIds(areas, areaId)
  const deletedArea: DeletedAreaSnapshot = {
    area: cloneArea(area),
    descendantAreas: areas
      .filter((currentArea) => descendantAreaIds.has(currentArea.id))
      .map(cloneArea),
    index,
    deletedAt,
  }

  return {
    areas: areas.filter(
      (currentArea) =>
        currentArea.id !== areaId &&
        !descendantAreaIds.has(currentArea.id)
    ),
    deletedArea,
  }
}

export const restoreDeletedArea = (
  areas: AreaState[],
  deletedArea: DeletedAreaSnapshot
) => {
  if (areas.some((area) => area.id === deletedArea.area.id)) {
    return areas
  }

  const restoredAreas = [
    cloneArea(deletedArea.area),
    ...(deletedArea.descendantAreas ?? []).map(cloneArea),
  ]
  const restoreIndex = Math.min(deletedArea.index, areas.length)

  return [
    ...areas.slice(0, restoreIndex),
    ...restoredAreas,
    ...areas.slice(restoreIndex),
  ]
}

const cloneArea = (area: AreaState): AreaState => ({
  ...area,
  styles: {
    ...area.styles,
  },
  ...(area.metadata
    ? {
        metadata: {
          ...area.metadata,
          tags: [...area.metadata.tags],
        },
      }
    : {}),
})

const getDescendantAreaIds = (
  areas: AreaState[],
  areaId: string
) => {
  const descendantAreaIds = new Set<string>()
  const pendingAreaIds = [areaId]

  while (pendingAreaIds.length > 0) {
    const parentId = pendingAreaIds.pop()

    for (const area of areas) {
      if (
        parentId &&
        area.parentId === parentId &&
        !descendantAreaIds.has(area.id)
      ) {
        descendantAreaIds.add(area.id)
        pendingAreaIds.push(area.id)
      }
    }
  }

  return descendantAreaIds
}
