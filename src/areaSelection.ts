type SelectableArea = {
  id: string
  parentId: string | null
  x: number
  y: number
  width: number
  height: number
}

export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasPointLike = {
  x: number
  y: number
}

export const MARQUEE_DRAG_THRESHOLD = 4

export const isMarqueeDrag = (
  start: CanvasPointLike,
  current: CanvasPointLike
) =>
  Math.abs(current.x - start.x) > MARQUEE_DRAG_THRESHOLD ||
  Math.abs(current.y - start.y) > MARQUEE_DRAG_THRESHOLD

export const getMarqueeRect = (
  start: CanvasPointLike,
  end: CanvasPointLike
): SelectionRect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
})

export const toggleAreaSelection = (
  selectedIds: string[],
  areaId: string
) =>
  selectedIds.includes(areaId)
    ? selectedIds.filter((id) => id !== areaId)
    : [...selectedIds, areaId]

export const getMarqueeSelection = <Area extends SelectableArea>(
  rect: SelectionRect,
  areas: Area[]
) =>
  areas
    .filter(
      (area) =>
        area.parentId === null &&
        area.x < rect.x + rect.width &&
        area.x + area.width > rect.x &&
        area.y < rect.y + rect.height &&
        area.y + area.height > rect.y
    )
    .map((area) => area.id)

export const normalizeSelection = <Area extends SelectableArea>(
  selectedIds: string[],
  areas: Area[]
) => {
  const areasById = new Map(areas.map((area) => [area.id, area]))
  const selected = new Set(
    selectedIds.filter((id) => areasById.has(id))
  )

  const hasSelectedAncestor = (areaId: string) => {
    let parentId = areasById.get(areaId)?.parentId ?? null

    while (parentId !== null) {
      if (selected.has(parentId)) return true

      parentId = areasById.get(parentId)?.parentId ?? null
    }

    return false
  }

  return [...selected].filter((id) => !hasSelectedAncestor(id))
}

export const getSelectableRootAreaIds = <
  Area extends SelectableArea,
>(
  areas: Area[]
) =>
  areas
    .filter((area) => area.parentId === null)
    .map((area) => area.id)
