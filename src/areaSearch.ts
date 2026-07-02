import type { AreaState } from './App'
import { getAreaMetadata } from './areaMetadata.ts'

export type AreaSearchMatchField =
  | 'text'
  | 'kind'
  | 'status'
  | 'tag'
  | 'evidence'

export type AreaSearchResult = {
  areaId: string
  matchField: AreaSearchMatchField
  excerpt: string
  score: number
}

type SearchFilter = {
  field: 'kind' | 'status'
  value: string
}

export const searchAreas = (
  areas: AreaState[],
  query: string
): AreaSearchResult[] => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  const filter = parseSearchFilter(normalizedQuery)
  const results = areas.flatMap((area) => {
    const result = filter
      ? getFilterResult(area, filter)
      : getFreeTextResult(area, normalizedQuery)

    return result ? [result] : []
  })

  return results.sort((first, second) => {
    const firstArea = areas.find((area) => area.id === first.areaId)
    const secondArea = areas.find((area) => area.id === second.areaId)

    return (
      second.score - first.score ||
      (firstArea?.y ?? 0) - (secondArea?.y ?? 0) ||
      (firstArea?.x ?? 0) - (secondArea?.x ?? 0)
    )
  })
}

const getFilterResult = (
  area: AreaState,
  filter: SearchFilter
): AreaSearchResult | null => {
  const metadata = getAreaMetadata(area)
  const fieldValue =
    filter.field === 'kind' ? metadata.kind : metadata.status ?? ''

  if (normalizeSearchText(fieldValue) !== filter.value) return null

  return {
    areaId: area.id,
    matchField: filter.field,
    excerpt: fieldValue,
    score: 80,
  }
}

const getFreeTextResult = (
  area: AreaState,
  query: string
): AreaSearchResult | null => {
  const textMatch = getTextMatch(area, query)
  if (textMatch) return textMatch

  const metadata = getAreaMetadata(area)
  const kind = metadata.kind
  if (normalizeSearchText(kind).includes(query)) {
    return {
      areaId: area.id,
      matchField: 'kind',
      excerpt: kind,
      score: 60,
    }
  }

  if (metadata.status && normalizeSearchText(metadata.status).includes(query)) {
    return {
      areaId: area.id,
      matchField: 'status',
      excerpt: metadata.status,
      score: 55,
    }
  }

  const tag = metadata.tags.find((candidate) =>
    normalizeSearchText(candidate).includes(query)
  )
  if (tag) {
    return {
      areaId: area.id,
      matchField: 'tag',
      excerpt: tag,
      score: 50,
    }
  }

  const evidence = (metadata.evidence ?? []).find((reference) =>
    normalizeSearchText(`${reference.label} ${reference.target}`).includes(
      query
    )
  )
  if (evidence) {
    return {
      areaId: area.id,
      matchField: 'evidence',
      excerpt: `${evidence.label} ${evidence.target}`.trim(),
      score: 45,
    }
  }

  return null
}

const getTextMatch = (
  area: AreaState,
  query: string
): AreaSearchResult | null => {
  if (area.type === 'image') {
    return normalizeSearchText(area.alt).includes(query)
      ? {
          areaId: area.id,
          matchField: 'text',
          excerpt: area.alt,
          score: 70,
        }
      : null
  }

  const lines = area.text.split('\n')
  const titleLine = lines[0] ?? ''
  if (normalizeSearchText(titleLine).includes(query)) {
    return {
      areaId: area.id,
      matchField: 'text',
      excerpt: titleLine,
      score: 100,
    }
  }

  const bodyLine = lines
    .slice(1)
    .find((line) => normalizeSearchText(line).includes(query))

  if (!bodyLine) return null

  return {
    areaId: area.id,
    matchField: 'text',
    excerpt: bodyLine,
    score: 70,
  }
}

const parseSearchFilter = (query: string): SearchFilter | null => {
  const match = /^(kind|status):([^\s]+)$/.exec(query)
  if (!match) return null

  return {
    field: match[1] as SearchFilter['field'],
    value: match[2],
  }
}

const normalizeSearchText = (value: string) =>
  value.trim().toLowerCase()
