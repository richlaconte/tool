type AlignableArea = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type AlignEdge =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'center-x'
  | 'center-y'

export type DistributeAxis = 'horizontal' | 'vertical'

export type AreaPositionUpdate = {
  id: string
  x: number
  y: number
}

export const alignAreas = <Area extends AlignableArea>(
  areas: Area[],
  edge: AlignEdge
): AreaPositionUpdate[] => {
  if (areas.length < 2) return []

  const left = Math.min(...areas.map((area) => area.x))
  const right = Math.max(
    ...areas.map((area) => area.x + area.width)
  )
  const top = Math.min(...areas.map((area) => area.y))
  const bottom = Math.max(
    ...areas.map((area) => area.y + area.height)
  )
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  return areas.map((area) => {
    if (edge === 'left') {
      return { id: area.id, x: left, y: area.y }
    }

    if (edge === 'right') {
      return { id: area.id, x: right - area.width, y: area.y }
    }

    if (edge === 'top') {
      return { id: area.id, x: area.x, y: top }
    }

    if (edge === 'bottom') {
      return { id: area.id, x: area.x, y: bottom - area.height }
    }

    if (edge === 'center-x') {
      return {
        id: area.id,
        x: centerX - area.width / 2,
        y: area.y,
      }
    }

    return {
      id: area.id,
      x: area.x,
      y: centerY - area.height / 2,
    }
  })
}

export const distributeAreas = <Area extends AlignableArea>(
  areas: Area[],
  axis: DistributeAxis
): AreaPositionUpdate[] => {
  if (areas.length < 3) return []

  const start = axis === 'horizontal' ? 'x' : 'y'
  const size = axis === 'horizontal' ? 'width' : 'height'
  const sorted = [...areas].sort(
    (a, b) => a[start] - b[start] || a.id.localeCompare(b.id)
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span = last[start] + last[size] - first[start]
  const totalSize = sorted.reduce(
    (total, area) => total + area[size],
    0
  )
  const gap = (span - totalSize) / (sorted.length - 1)

  let cursor = first[start]

  return sorted.map((area) => {
    const position = cursor

    cursor += area[size] + gap

    return {
      id: area.id,
      x: axis === 'horizontal' ? position : area.x,
      y: axis === 'vertical' ? position : area.y,
    }
  })
}
