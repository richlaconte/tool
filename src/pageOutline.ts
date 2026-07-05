import type { AreaState } from './App'
import { getAreaMetadata } from './areaMetadata.ts'
import { getAreaAbsolutePosition, getAreaParentId } from './nestedAreas.ts'
import type { PageAppState } from './pagePersistence.ts'

export type PageOutlineItem = {
  areaId: string
  title: string
  kind: string
  status?: string
  depth: number
  children: PageOutlineItem[]
}

const getAreaTitle = (area: AreaState) => {
  if (area.type === 'image') {
    return area.alt.trim() || 'Image Area'
  }

  return area.text.split(/\r?\n/)[0]?.trim() || 'Empty Area'
}

const sortByReadingOrder = (areas: AreaState[], allAreas: AreaState[]) =>
  [...areas].sort((firstArea, secondArea) => {
    const firstPosition = getAreaAbsolutePosition(allAreas, firstArea.id)
    const secondPosition = getAreaAbsolutePosition(allAreas, secondArea.id)

    return (
      firstPosition.y - secondPosition.y ||
      firstPosition.x - secondPosition.x ||
      areas.indexOf(firstArea) - areas.indexOf(secondArea)
    )
  })

const buildOutlineItem = (
  area: AreaState,
  areas: AreaState[],
  depth: number
): PageOutlineItem => {
  const metadata = getAreaMetadata(area)
  const children = sortByReadingOrder(
    areas.filter(
      (candidateArea) => getAreaParentId(candidateArea) === area.id
    ),
    areas
  ).map((childArea) => buildOutlineItem(childArea, areas, depth + 1))

  return {
    areaId: area.id,
    title: getAreaTitle(area),
    kind: metadata.kind,
    ...(metadata.status ? { status: metadata.status } : {}),
    depth,
    children,
  }
}

export const getPageOutline = (state: Pick<PageAppState, 'areas'>) =>
  sortByReadingOrder(
    state.areas.filter((area) => getAreaParentId(area) === null),
    state.areas
  ).map((area) => buildOutlineItem(area, state.areas, 0))
