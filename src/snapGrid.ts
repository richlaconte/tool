import type { AreaState } from './App'
import type { SnapGridSettings } from './pagePersistence'

export const DEFAULT_SNAP_GRID_SIZE = 16
export const MIN_SNAP_GRID_SIZE = 4
export const MAX_SNAP_GRID_SIZE = 128

export const clampSnapGridSize = (size: number) => {
  if (!Number.isFinite(size)) return DEFAULT_SNAP_GRID_SIZE

  return Math.max(
    MIN_SNAP_GRID_SIZE,
    Math.min(MAX_SNAP_GRID_SIZE, Math.round(size))
  )
}

export const snapValueToGrid = (
  value: number,
  snapGridSize: number
) => {
  const size = clampSnapGridSize(snapGridSize)

  return Math.round(value / size) * size
}

export const getActiveSnapGridSize = (
  settings: SnapGridSettings,
  bypassSnapGrid = false
) => {
  if (!settings.enabled || bypassSnapGrid) return undefined

  return clampSnapGridSize(settings.size)
}

export const moveAreaWithSnapGrid = (
  areas: AreaState[],
  areaId: string,
  x: number,
  y: number,
  {
    snapGridSize,
  }: {
    snapGridSize?: number
  } = {}
) => {
  if (!areas.some((area) => area.id === areaId)) return areas

  const nextX =
    snapGridSize === undefined ? x : snapValueToGrid(x, snapGridSize)
  const nextY =
    snapGridSize === undefined ? y : snapValueToGrid(y, snapGridSize)

  return areas.map((area) =>
    area.id === areaId
      ? {
          ...area,
          x: nextX,
          y: nextY,
        }
      : area
  )
}
