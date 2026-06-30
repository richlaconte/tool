import type {
  AreaLink,
  AreaLinkEndpoint,
  AreaLinkSide,
} from './areaMetadata.ts'

export type AreaRect = {
  x: number
  y: number
  width: number
  height: number
}

export type Point = {
  x: number
  y: number
}

export type AreaBorderHit = {
  side: AreaLinkSide
  position: number
}

const endpointEpsilon = 0.0001

export const clampUnit = (value: number) => {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

export const getAreaBorderHit = (
  area: AreaRect,
  point: Point,
  hitPadding = 12
): AreaBorderHit | null => {
  if (area.width <= 0 || area.height <= 0) return null

  const leftDistance = Math.abs(point.x - area.x)
  const rightDistance = Math.abs(point.x - (area.x + area.width))
  const topDistance = Math.abs(point.y - area.y)
  const bottomDistance = Math.abs(point.y - (area.y + area.height))
  const isInsideExpandedBounds =
    point.x >= area.x - hitPadding &&
    point.x <= area.x + area.width + hitPadding &&
    point.y >= area.y - hitPadding &&
    point.y <= area.y + area.height + hitPadding

  if (!isInsideExpandedBounds) return null

  const distances: Array<{
    side: AreaLinkSide
    distance: number
  }> = [
    { side: 'top', distance: topDistance },
    { side: 'right', distance: rightDistance },
    { side: 'bottom', distance: bottomDistance },
    { side: 'left', distance: leftDistance },
  ]
  const nearest = distances.sort(
    (first, second) => first.distance - second.distance
  )[0]

  if (!nearest || nearest.distance > hitPadding) return null

  return {
    side: nearest.side,
    position:
      nearest.side === 'top' || nearest.side === 'bottom'
        ? clampUnit((point.x - area.x) / area.width)
        : clampUnit((point.y - area.y) / area.height),
  }
}

export const getAreaEndpointPoint = (
  area: AreaRect,
  endpoint: Pick<AreaLinkEndpoint, 'side' | 'position'>
): Point => {
  const position = clampUnit(endpoint.position ?? 0.5)

  if (endpoint.side === 'left') {
    return {
      x: area.x,
      y: area.y + area.height * position,
    }
  }

  if (endpoint.side === 'right') {
    return {
      x: area.x + area.width,
      y: area.y + area.height * position,
    }
  }

  if (endpoint.side === 'top') {
    return {
      x: area.x + area.width * position,
      y: area.y,
    }
  }

  return {
    x: area.x + area.width * position,
    y: area.y + area.height,
  }
}

export const snapLinkEndpointToExisting = ({
  area,
  areaId,
  links,
  maxDistance,
  side,
  position,
}: {
  area: AreaRect
  areaId: string
  links: AreaLink[]
  maxDistance: number
  side: AreaLinkSide
  position: number
}): AreaLinkEndpoint => {
  const candidate: AreaLinkEndpoint = {
    areaId,
    side,
    position: clampUnit(position),
    behavior: 'fixed',
  }
  const candidatePoint = getAreaEndpointPoint(area, candidate)
  const matchingEndpoints = links
    .flatMap((link) => [link.from, link.to])
    .filter(
      (endpoint): endpoint is AreaLinkEndpoint =>
        Boolean(
          endpoint &&
            endpoint.areaId === areaId &&
            endpoint.side === side &&
            typeof endpoint.position === 'number'
        )
    )
    .map((endpoint) => ({
      endpoint,
      distance: getPointDistance(
        candidatePoint,
        getAreaEndpointPoint(area, endpoint)
      ),
    }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((first, second) => first.distance - second.distance)

  const nearest = matchingEndpoints[0]?.endpoint

  return nearest
    ? {
        areaId,
        side,
        position: clampUnit(nearest.position ?? position),
        behavior: 'fixed',
      }
    : candidate
}

export const moveSharedLinkEndpoint = (
  links: AreaLink[],
  {
    from,
    to,
  }: {
    from: AreaLinkEndpoint
    to: AreaLinkEndpoint
  }
) =>
  links.map((link) => ({
    ...link,
    from: endpointsMatch(link.from, from) ? to : link.from,
    to: endpointsMatch(link.to, from) ? to : link.to,
  }))

export const endpointsMatch = (
  first: AreaLinkEndpoint | undefined,
  second: AreaLinkEndpoint | undefined
) =>
  Boolean(
    first &&
      second &&
      first.areaId === second.areaId &&
      first.side === second.side &&
      typeof first.position === 'number' &&
      typeof second.position === 'number' &&
      Math.abs(first.position - second.position) <= endpointEpsilon
  )

export const getPointDistance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y)
