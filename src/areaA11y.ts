import type { AreaState } from './App'
import { getAreaMetadata } from './areaMetadata.ts'

const MAX_EXCERPT_LENGTH = 80

const toTitleCase = (value: string) =>
  value
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

const formatStatus = (status: string) => status.replaceAll('-', ' ')

const truncate = (value: string) => {
  if (value.length <= MAX_EXCERPT_LENGTH) return value

  return `${value.slice(0, MAX_EXCERPT_LENGTH)}…`
}

const getAreaExcerpt = (area: AreaState) => {
  if (area.type === 'image') {
    return area.alt.trim() || 'Image Area'
  }

  return area.text.split(/\r?\n/)[0]?.trim() || 'Empty Area'
}

export const getAreaAccessibleLabel = (area: AreaState) => {
  const metadata = getAreaMetadata(area)
  const kind = toTitleCase(metadata.kind)
  const status = metadata.status
    ? `, ${formatStatus(metadata.status)}`
    : ''

  return `${kind}${status}: ${truncate(getAreaExcerpt(area))}`
}
