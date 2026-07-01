import type { AreaState } from './App'

export const DEFAULT_AREA_WIDTH = 280
export const DEFAULT_AREA_HEIGHT = 44
export const MIN_AREA_WIDTH = 80
export const MIN_AREA_HEIGHT = 28

export const getVisibleAreaContentHeight = (
  areaHeight: number,
  contentHeight: number
) => Math.max(areaHeight, contentHeight)

type ResizeAreaOptions = {
  maxWidth?: number
  maxHeight?: number
  snapGridSize?: number
}

export const getAreaResizeMaxDimensions = (
  areas: AreaState[],
  areaId: string
): Pick<ResizeAreaOptions, 'maxWidth' | 'maxHeight'> => {
  const area = areas.find((currentArea) => currentArea.id === areaId)

  if (!area?.parentId) return {}

  const parentArea = areas.find(
    (currentArea) => currentArea.id === area.parentId
  )

  if (!parentArea) return {}

  return {
    maxWidth: Math.max(MIN_AREA_WIDTH, parentArea.width - area.x),
    maxHeight: Math.max(MIN_AREA_HEIGHT, parentArea.height - area.y),
  }
}

const snapValue = (value: number, snapGridSize?: number) =>
  snapGridSize && snapGridSize > 0
    ? Math.round(value / snapGridSize) * snapGridSize
    : value

const clampValue = (
  value: number,
  minValue: number,
  maxValue?: number
) =>
  Math.max(
    minValue,
    maxValue ? Math.min(value, maxValue) : value
  )

export const resizeAreaWidth = (
  areas: AreaState[],
  areaId: string,
  nextWidth: number,
  options: ResizeAreaOptions = {}
) =>
  resizeAreaDimensions(
    areas,
    areaId,
    nextWidth,
    areas.find((area) => area.id === areaId)?.height ??
      DEFAULT_AREA_HEIGHT,
    options
  )

export const resizeAreaDimensions = (
  areas: AreaState[],
  areaId: string,
  nextWidth: number,
  nextHeight: number,
  options: ResizeAreaOptions = {}
) => {
  if (!areas.some((area) => area.id === areaId)) return areas

  const clampedWidth = clampValue(
    snapValue(nextWidth, options.snapGridSize),
    MIN_AREA_WIDTH,
    options.maxWidth
  )
  const clampedHeight = clampValue(
    snapValue(nextHeight, options.snapGridSize),
    MIN_AREA_HEIGHT,
    options.maxHeight
  )

  return areas.map((area) =>
    area.id === areaId
      ? {
          ...area,
          width: clampedWidth,
          height: clampedHeight,
        }
      : area
  )
}
