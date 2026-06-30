import type { AreaState } from './App'
import { getAreaAbsolutePosition } from './nestedAreas.ts'

export type CanvasRect = {
  x: number
  y: number
  width: number
  height: number
}

export type OffscreenIndicatorDirection =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'

export type OffscreenIndicator = {
  id: string
  direction: OffscreenIndicatorDirection
  count: number
  areaIds: string[]
  targetCenter: {
    x: number
    y: number
  }
  targetBounds: CanvasRect
  viewportPosition: {
    x: number
    y: number
  }
  rotationDegrees: number
}

type SafeInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

type DirectionBucket = {
  direction: OffscreenIndicatorDirection
  angleDegrees: number
  areas: Array<{
    id: string
    rect: CanvasRect
  }>
}

const VISIBLE_INTERSECTION_MARGIN = 8
const DEFAULT_SAFE_INSETS: SafeInsets = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
}

const DIRECTION_BY_ANGLE: Array<{
  direction: OffscreenIndicatorDirection
  angleDegrees: number
}> = [
  {
    direction: 'east',
    angleDegrees: 0,
  },
  {
    direction: 'southeast',
    angleDegrees: 45,
  },
  {
    direction: 'south',
    angleDegrees: 90,
  },
  {
    direction: 'southwest',
    angleDegrees: 135,
  },
  {
    direction: 'west',
    angleDegrees: 180,
  },
  {
    direction: 'northwest',
    angleDegrees: 225,
  },
  {
    direction: 'north',
    angleDegrees: 270,
  },
  {
    direction: 'northeast',
    angleDegrees: 315,
  },
]

const CLOCKWISE_SORT_ORDER: OffscreenIndicatorDirection[] = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
]

const DIRECTION_SORT_INDEX = new Map(
  CLOCKWISE_SORT_ORDER.map((direction, index) => [direction, index])
)

export const getOffscreenIndicatorAriaLabel = (
  indicator: Pick<OffscreenIndicator, 'count' | 'direction'>
) =>
  indicator.count === 1
    ? `Area offscreen ${indicator.direction}`
    : `${indicator.count} Areas offscreen ${indicator.direction}`

export const getOffscreenAreaIndicators = ({
  areas,
  safeInsets = DEFAULT_SAFE_INSETS,
  viewport,
  viewportPixelSize,
  zoom,
}: {
  areas: AreaState[]
  viewport: CanvasRect
  viewportPixelSize: {
    width: number
    height: number
  }
  zoom: number
  safeInsets?: SafeInsets
}) => {
  if (areas.length === 0) return []
  if (viewport.width <= 0 || viewport.height <= 0) return []
  if (viewportPixelSize.width <= 0 || viewportPixelSize.height <= 0) {
    return []
  }

  const viewportCenter = getRectCenter(viewport)
  const buckets = new Map<OffscreenIndicatorDirection, DirectionBucket>()

  for (const area of areas) {
    const rect = getAreaRect(areas, area)

    if (isVisibleEnough(rect, viewport)) continue

    const areaCenter = getRectCenter(rect)
    const angleDegrees = getAngleDegrees(
      areaCenter.x - viewportCenter.x,
      areaCenter.y - viewportCenter.y
    )
    const direction = getDirectionForAngle(angleDegrees)
    const bucket =
      buckets.get(direction.direction) ??
      {
        direction: direction.direction,
        angleDegrees: direction.angleDegrees,
        areas: [],
      }

    bucket.areas.push({
      id: area.id,
      rect,
    })
    buckets.set(direction.direction, bucket)
  }

  return [...buckets.values()]
    .map((bucket) =>
      createIndicatorForBucket({
        bucket,
        safeInsets,
        viewport,
        viewportCenter,
        viewportPixelSize,
        zoom,
      })
    )
    .sort(
      (firstIndicator, secondIndicator) =>
        (DIRECTION_SORT_INDEX.get(firstIndicator.direction) ?? 0) -
        (DIRECTION_SORT_INDEX.get(secondIndicator.direction) ?? 0)
    )
}

const getAreaRect = (areas: AreaState[], area: AreaState): CanvasRect => {
  const position = getAreaAbsolutePosition(areas, area.id)

  return {
    x: position.x,
    y: position.y,
    width: area.width,
    height: area.height,
  }
}

const isVisibleEnough = (rect: CanvasRect, viewport: CanvasRect) => {
  const intersectionWidth =
    Math.min(rect.x + rect.width, viewport.x + viewport.width) -
    Math.max(rect.x, viewport.x)
  const intersectionHeight =
    Math.min(rect.y + rect.height, viewport.y + viewport.height) -
    Math.max(rect.y, viewport.y)

  return (
    intersectionWidth >= VISIBLE_INTERSECTION_MARGIN &&
    intersectionHeight >= VISIBLE_INTERSECTION_MARGIN
  )
}

const getRectCenter = (rect: CanvasRect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
})

const getAngleDegrees = (x: number, y: number) =>
  (Math.atan2(y, x) * 180) / Math.PI

const normalizeAngle = (angleDegrees: number) =>
  ((angleDegrees % 360) + 360) % 360

const getDirectionForAngle = (angleDegrees: number) => {
  const index =
    Math.round(normalizeAngle(angleDegrees) / 45) %
    DIRECTION_BY_ANGLE.length

  return DIRECTION_BY_ANGLE[index]
}

const createIndicatorForBucket = ({
  bucket,
  safeInsets,
  viewport,
  viewportCenter,
  viewportPixelSize,
  zoom,
}: {
  bucket: DirectionBucket
  safeInsets: SafeInsets
  viewport: CanvasRect
  viewportCenter: {
    x: number
    y: number
  }
  viewportPixelSize: {
    width: number
    height: number
  }
  zoom: number
}): OffscreenIndicator => {
  const targetBounds = getBoundingRect(bucket.areas.map((area) => area.rect))
  const targetCenter = getRectCenter(targetBounds)
  const targetPixelCenter = {
    x: (targetCenter.x - viewport.x) * zoom,
    y: (targetCenter.y - viewport.y) * zoom,
  }
  const viewportPixelCenter = {
    x: viewportPixelSize.width / 2,
    y: viewportPixelSize.height / 2,
  }
  const vector = {
    x: targetPixelCenter.x - viewportPixelCenter.x,
    y: targetPixelCenter.y - viewportPixelCenter.y,
  }
  const fallbackVector = getDirectionVector(bucket.angleDegrees)
  const viewportPosition = getEdgePosition({
    safeInsets,
    vector:
      vector.x === 0 && vector.y === 0 ? fallbackVector : vector,
    viewportPixelCenter,
    viewportPixelSize,
  })

  return {
    id: bucket.direction,
    direction: bucket.direction,
    count: bucket.areas.length,
    areaIds: bucket.areas.map((area) => area.id),
    targetCenter,
    targetBounds,
    viewportPosition,
    rotationDegrees: getAngleDegrees(
      targetCenter.x - viewportCenter.x,
      targetCenter.y - viewportCenter.y
    ),
  }
}

const getBoundingRect = (rects: CanvasRect[]): CanvasRect => {
  const bounds = rects.reduce(
    (currentBounds, rect) => ({
      minX: Math.min(currentBounds.minX, rect.x),
      minY: Math.min(currentBounds.minY, rect.y),
      maxX: Math.max(currentBounds.maxX, rect.x + rect.width),
      maxY: Math.max(currentBounds.maxY, rect.y + rect.height),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  }
}

const getDirectionVector = (angleDegrees: number) => {
  const angleRadians = (angleDegrees * Math.PI) / 180

  return {
    x: Math.cos(angleRadians),
    y: Math.sin(angleRadians),
  }
}

const getEdgePosition = ({
  safeInsets,
  vector,
  viewportPixelCenter,
  viewportPixelSize,
}: {
  safeInsets: SafeInsets
  vector: {
    x: number
    y: number
  }
  viewportPixelCenter: {
    x: number
    y: number
  }
  viewportPixelSize: {
    width: number
    height: number
  }
}) => {
  const horizontalScale =
    vector.x > 0
      ? (viewportPixelSize.width -
          safeInsets.right -
          viewportPixelCenter.x) /
        vector.x
      : vector.x < 0
        ? (safeInsets.left - viewportPixelCenter.x) / vector.x
        : Number.POSITIVE_INFINITY
  const verticalScale =
    vector.y > 0
      ? (viewportPixelSize.height -
          safeInsets.bottom -
          viewportPixelCenter.y) /
        vector.y
      : vector.y < 0
        ? (safeInsets.top - viewportPixelCenter.y) / vector.y
        : Number.POSITIVE_INFINITY
  const scale = Math.max(
    0,
    Math.min(horizontalScale, verticalScale)
  )

  return {
    x: clamp(
      viewportPixelCenter.x + vector.x * scale,
      safeInsets.left,
      viewportPixelSize.width - safeInsets.right
    ),
    y: clamp(
      viewportPixelCenter.y + vector.y * scale,
      safeInsets.top,
      viewportPixelSize.height - safeInsets.bottom
    ),
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
