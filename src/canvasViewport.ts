export type CanvasPoint = {
  x: number
  y: number
}

export type CanvasViewportMetrics = {
  rectLeft: number
  rectTop: number
  scrollLeft: number
  scrollTop: number
  zoom: number
}

export type CanvasZoomAnchor = {
  clientX: number
  clientY: number
}

export type CanvasBoundsItem = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasViewportSize = {
  width: number
  height: number
}

export const MIN_CANVAS_ZOOM = 0.25
export const MAX_CANVAS_ZOOM = 4
export const DEFAULT_CANVAS_ZOOM = 1
export const CANVAS_ZOOM_LEVELS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4,
]

export const clampCanvasZoom = (zoom: number) => {
  if (!Number.isFinite(zoom)) return DEFAULT_CANVAS_ZOOM

  return Math.max(
    MIN_CANVAS_ZOOM,
    Math.min(MAX_CANVAS_ZOOM, Number(zoom.toFixed(4)))
  )
}

export const getNextCanvasZoom = (
  currentZoom: number,
  direction: -1 | 1
) => {
  const zoom = clampCanvasZoom(currentZoom)

  if (direction === 1) {
    return (
      CANVAS_ZOOM_LEVELS.find((level) => level > zoom) ??
      MAX_CANVAS_ZOOM
    )
  }

  return (
    [...CANVAS_ZOOM_LEVELS]
      .reverse()
      .find((level) => level < zoom) ?? MIN_CANVAS_ZOOM
  )
}

export const formatCanvasZoom = (zoom: number) =>
  `${Math.round(clampCanvasZoom(zoom) * 100)}%`

export const clampWheelZoomDelta = (deltaY: number) => {
  if (!Number.isFinite(deltaY)) return 0

  return Math.max(-240, Math.min(240, deltaY))
}

export const getContinuousCanvasZoom = (
  currentZoom: number,
  deltaY: number,
  sensitivity = 700
) => {
  const scale = 2 ** (-clampWheelZoomDelta(deltaY) / sensitivity)

  return clampCanvasZoom(currentZoom * scale)
}

export const screenToCanvasPoint = (
  clientX: number,
  clientY: number,
  metrics: CanvasViewportMetrics
): CanvasPoint => ({
  x:
    (clientX - metrics.rectLeft + metrics.scrollLeft) /
    metrics.zoom,
  y:
    (clientY - metrics.rectTop + metrics.scrollTop) /
    metrics.zoom,
})

export const getAnchorPreservingScroll = ({
  anchor,
  metrics,
  nextZoom,
}: {
  anchor: CanvasZoomAnchor
  metrics: CanvasViewportMetrics
  nextZoom: number
}) => {
  const point = screenToCanvasPoint(
    anchor.clientX,
    anchor.clientY,
    metrics
  )
  const zoom = clampCanvasZoom(nextZoom)

  return {
    scrollLeft:
      point.x * zoom - (anchor.clientX - metrics.rectLeft),
    scrollTop: point.y * zoom - (anchor.clientY - metrics.rectTop),
  }
}

export const getZoomToFit = (
  items: CanvasBoundsItem[],
  viewport: CanvasViewportSize,
  padding = 80
) => {
  if (items.length === 0) {
    return {
      zoom: DEFAULT_CANVAS_ZOOM,
      scrollLeft: 0,
      scrollTop: 0,
    }
  }

  const bounds = items.reduce(
    (currentBounds, item) => ({
      minX: Math.min(currentBounds.minX, item.x),
      minY: Math.min(currentBounds.minY, item.y),
      maxX: Math.max(currentBounds.maxX, item.x + item.width),
      maxY: Math.max(currentBounds.maxY, item.y + item.height),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY)
  const availableWidth = Math.max(1, viewport.width - padding * 2)
  const availableHeight = Math.max(1, viewport.height - padding * 2)
  const zoom = clampCanvasZoom(
    Math.min(
      availableWidth / boundsWidth,
      availableHeight / boundsHeight
    )
  )
  const boundsCenterX = bounds.minX + boundsWidth / 2
  const boundsCenterY = bounds.minY + boundsHeight / 2

  return {
    zoom,
    scrollLeft: Math.max(
      0,
      boundsCenterX * zoom - viewport.width / 2
    ),
    scrollTop: Math.max(
      0,
      boundsCenterY * zoom - viewport.height / 2
    ),
  }
}

export const getCanvasWorldSize = (
  items: CanvasBoundsItem[],
  viewport: CanvasViewportSize,
  padding = 1200
) => {
  const maxX = items.reduce(
    (currentMax, item) =>
      Math.max(currentMax, item.x + item.width + padding),
    viewport.width + padding
  )
  const maxY = items.reduce(
    (currentMax, item) =>
      Math.max(currentMax, item.y + item.height + padding),
    viewport.height + padding
  )

  return {
    width: Math.max(2400, Math.ceil(maxX)),
    height: Math.max(1600, Math.ceil(maxY)),
  }
}
