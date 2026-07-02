import type { AreaState } from './App'

export const DUPLICATE_AREA_OFFSET = {
  x: 16,
  y: 16,
}

export type DuplicateAreaResult = {
  areas: AreaState[]
  selectedAreaId: string | null
}

export type DuplicateAreasResult = {
  areas: AreaState[]
  selectedAreaIds: string[]
}

export type DeletedAreaSnapshot = {
  area: AreaState
  descendantAreas: AreaState[]
  index: number
  deletedAt: number
}

export type DeletedAreasSnapshot = DeletedAreaSnapshot[]

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

export const duplicateAreas = (
  areas: AreaState[],
  sourceAreaIds: string[],
  createAreaId: () => string
): DuplicateAreasResult => {
  const duplicatedAreas: AreaState[] = []
  const selectedAreaIds: string[] = []

  for (const sourceAreaId of sourceAreaIds) {
    const sourceArea = areas.find((area) => area.id === sourceAreaId)
    if (!sourceArea) continue

    const id = createAreaId()
    duplicatedAreas.push({
      ...cloneArea(sourceArea),
      id,
      x: sourceArea.x + DUPLICATE_AREA_OFFSET.x,
      y: sourceArea.y + DUPLICATE_AREA_OFFSET.y,
    })
    selectedAreaIds.push(id)
  }

  return {
    areas:
      duplicatedAreas.length > 0
        ? [...areas, ...duplicatedAreas]
        : areas,
    selectedAreaIds,
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

export const deleteAreas = (
  areas: AreaState[],
  areaIds: string[],
  deletedAt = Date.now()
) => {
  let nextAreas = areas
  const deletedAreas: DeletedAreasSnapshot = []

  for (const areaId of areaIds) {
    const result = deleteArea(nextAreas, areaId, deletedAt)
    nextAreas = result.areas

    if (result.deletedArea) {
      deletedAreas.push({
        ...result.deletedArea,
        index: areas.findIndex((area) => area.id === areaId),
      })
    }
  }

  return {
    areas: deletedAreas.length > 0 ? nextAreas : areas,
    deletedAreas,
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

export const restoreDeletedAreas = (
  areas: AreaState[],
  deletedAreas: DeletedAreasSnapshot
) =>
  [...deletedAreas]
    .sort((left, right) => left.index - right.index)
    .reduce(
      (nextAreas, deletedArea) =>
        restoreDeletedArea(nextAreas, deletedArea),
      areas
    )

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
