import type { AreaState } from './App'

export const MAX_NESTING_DEPTH = 2

type Point = {
  x: number
  y: number
}

type Rect = Point & {
  width: number
  height: number
}

export type NestingCandidateReason =
  | 'valid'
  | 'none'
  | 'self'
  | 'descendant'
  | 'depth-limit'
  | 'not-contained'

export type NestingCandidateResult = {
  parentId: string | null
  reason: NestingCandidateReason
}

export const getAreaParentId = (area: AreaState) =>
  area.parentId ?? null

export const getRootAreas = (areas: AreaState[]) =>
  areas.filter((area) => getAreaParentId(area) === null)

export const getChildAreas = (
  areas: AreaState[],
  parentId: string
) => areas.filter((area) => getAreaParentId(area) === parentId)

export const getAreaDepth = (
  areas: AreaState[],
  areaId: string
) => {
  let depth = 0
  let currentArea = areas.find((area) => area.id === areaId)
  const visitedAreaIds = new Set<string>()

  while (currentArea && getAreaParentId(currentArea)) {
    const parentId = getAreaParentId(currentArea)

    if (!parentId || visitedAreaIds.has(parentId)) return depth

    visitedAreaIds.add(parentId)
    currentArea = areas.find((area) => area.id === parentId)
    if (currentArea) depth += 1
  }

  return depth
}

export const getAreaAbsolutePosition = (
  areas: AreaState[],
  areaId: string
): Point => {
  const area = areas.find((currentArea) => currentArea.id === areaId)

  if (!area) {
    return {
      x: 0,
      y: 0,
    }
  }

  const parentId = getAreaParentId(area)

  if (!parentId) {
    return {
      x: area.x,
      y: area.y,
    }
  }

  const parentPosition = getAreaAbsolutePosition(areas, parentId)

  return {
    x: parentPosition.x + area.x,
    y: parentPosition.y + area.y,
  }
}

export const reparentArea = (
  areas: AreaState[],
  areaId: string,
  parentId: string | null
) => {
  const area = areas.find((currentArea) => currentArea.id === areaId)

  if (!area) return areas
  if (parentId === areaId) return areas
  if (parentId && !areas.some((currentArea) => currentArea.id === parentId)) {
    return areas
  }
  if (parentId && isAreaDescendantOf(areas, parentId, areaId)) {
    return areas
  }
  if (!isDepthAllowed(areas, areaId, parentId)) return areas

  const absolutePosition = getAreaAbsolutePosition(areas, areaId)
  const parentPosition = parentId
    ? getAreaAbsolutePosition(areas, parentId)
    : {
        x: 0,
        y: 0,
      }

  return areas.map((currentArea) =>
    currentArea.id === areaId
      ? {
          ...currentArea,
          parentId,
          x: absolutePosition.x - parentPosition.x,
          y: absolutePosition.y - parentPosition.y,
        }
      : currentArea
  )
}

export const nestAreaIfContained = (
  areas: AreaState[],
  areaId: string
) => {
  const containingParentId = getContainingAreaId(areas, areaId)
  const area = areas.find((currentArea) => currentArea.id === areaId)

  if (!area) return areas

  if (containingParentId) {
    if (containingParentId === getAreaParentId(area)) return areas

    return reparentArea(areas, areaId, containingParentId)
  }

  if (getAreaParentId(area) !== null) {
    return reparentArea(areas, areaId, null)
  }

  return areas
}

export const getContainingAreaId = (
  areas: AreaState[],
  areaId: string
) => {
  return getCandidateParentId(areas, areaId)
}

export const getCandidateParentId = (
  areas: AreaState[],
  areaId: string
) => getNestingCandidate(areas, areaId).parentId

export const getNestingCandidate = (
  areas: AreaState[],
  areaId: string
): NestingCandidateResult => {
  const area = areas.find((currentArea) => currentArea.id === areaId)

  if (!area) {
    return {
      parentId: null,
      reason: 'none',
    }
  }

  const areaRect = getAreaAbsoluteRect(areas, areaId)
  const descendants = getDescendantAreaIds(areas, areaId)
  const candidates: AreaState[] = []
  let hasDepthLimitedCandidate = false
  let hasDescendantCandidate = false
  let hasContainedCandidate = false

  areas.forEach((candidateArea) => {
    if (candidateArea.id === areaId) return

    const candidateContainsArea = containsRect(
      getAreaAbsoluteRect(areas, candidateArea.id),
      areaRect
    )

    if (!candidateContainsArea) return

    hasContainedCandidate = true

    if (descendants.has(candidateArea.id)) {
      hasDescendantCandidate = true
      return
    }

    if (!isDepthAllowed(areas, areaId, candidateArea.id)) {
      hasDepthLimitedCandidate = true
      return
    }

    candidates.push(candidateArea)
  })

  const candidate = candidates.sort(
    (firstArea, secondArea) =>
      getAreaDepth(areas, secondArea.id) -
        getAreaDepth(areas, firstArea.id) ||
      getAreaArea(firstArea) - getAreaArea(secondArea) ||
      areas.indexOf(secondArea) - areas.indexOf(firstArea)
  )[0]

  if (candidate) {
    return {
      parentId: candidate.id,
      reason: 'valid',
    }
  }

  return {
    parentId: null,
    reason: hasDepthLimitedCandidate
      ? 'depth-limit'
      : hasDescendantCandidate
        ? 'descendant'
        : hasContainedCandidate
          ? 'not-contained'
          : 'none',
  }
}

export const getUnnestingSourceId = (
  areas: AreaState[],
  areaId: string
) => {
  const area = areas.find((currentArea) => currentArea.id === areaId)
  const parentId = area ? getAreaParentId(area) : null

  if (!parentId) return null

  const parentContainsArea = containsRect(
    getAreaAbsoluteRect(areas, parentId),
    getAreaAbsoluteRect(areas, areaId)
  )

  return parentContainsArea ? null : parentId
}

export const getAreaAbsoluteRect = (
  areas: AreaState[],
  areaId: string
): Rect => {
  const area = areas.find((currentArea) => currentArea.id === areaId)
  const position = getAreaAbsolutePosition(areas, areaId)

  return {
    ...position,
    width: area?.width ?? 0,
    height: area?.height ?? 0,
  }
}

const containsRect = (parentRect: Rect, childRect: Rect) =>
  childRect.x >= parentRect.x &&
  childRect.y >= parentRect.y &&
  childRect.x + childRect.width <= parentRect.x + parentRect.width &&
  childRect.y + childRect.height <= parentRect.y + parentRect.height

const getAreaArea = (area: AreaState) => area.width * area.height

const isAreaDescendantOf = (
  areas: AreaState[],
  areaId: string,
  possibleAncestorId: string
) => {
  let currentArea = areas.find((area) => area.id === areaId)
  const visitedAreaIds = new Set<string>()

  while (currentArea) {
    const parentId = getAreaParentId(currentArea)

    if (!parentId) return false
    if (parentId === possibleAncestorId) return true
    if (visitedAreaIds.has(parentId)) return false

    visitedAreaIds.add(parentId)
    currentArea = areas.find((area) => area.id === parentId)
  }

  return false
}

const getDescendantAreaIds = (
  areas: AreaState[],
  areaId: string
) => {
  const descendantAreaIds = new Set<string>()
  const pendingAreaIds = [areaId]

  while (pendingAreaIds.length > 0) {
    const parentId = pendingAreaIds.pop()

    for (const childArea of areas) {
      if (
        parentId &&
        getAreaParentId(childArea) === parentId &&
        !descendantAreaIds.has(childArea.id)
      ) {
        descendantAreaIds.add(childArea.id)
        pendingAreaIds.push(childArea.id)
      }
    }
  }

  return descendantAreaIds
}

const getSubtreeDepth = (
  areas: AreaState[],
  areaId: string
): number => {
  const children = getChildAreas(areas, areaId)

  if (children.length === 0) return 0

  return (
    1 +
    Math.max(
      ...children.map((childArea) =>
        getSubtreeDepth(areas, childArea.id)
      )
    )
  )
}

const isDepthAllowed = (
  areas: AreaState[],
  areaId: string,
  parentId: string | null
) => {
  const parentDepth = parentId ? getAreaDepth(areas, parentId) + 1 : 0
  const subtreeDepth = getSubtreeDepth(areas, areaId)

  return parentDepth + subtreeDepth <= MAX_NESTING_DEPTH
}
