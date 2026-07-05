import type { AreaState } from './App'
import type { AreaLink } from './areaMetadata.ts'
import type { PageAppState } from './pagePersistence.ts'

export type AreaChangedField =
  | 'text'
  | 'position'
  | 'size'
  | 'styles'
  | 'metadata'
  | 'parent'

export type PageChangedField = 'title' | 'settings'

export type PageDiffAreaSummary = {
  id: string
  excerpt: string
}

export type PageDiffAreaChange = {
  id: string
  changedFields: AreaChangedField[]
  before: {
    excerpt: string
  }
  after: {
    excerpt: string
  }
}

export type PageDiffLinkSummary = {
  id: string
  label: string
  fromAreaId: string
  toAreaId: string
}

export type PageDiff = {
  addedAreas: PageDiffAreaSummary[]
  removedAreas: PageDiffAreaSummary[]
  changedAreas: PageDiffAreaChange[]
  addedLinks: PageDiffLinkSummary[]
  removedLinks: PageDiffLinkSummary[]
  changedLinks: PageDiffLinkSummary[]
  pageChanges: PageChangedField[]
}

export const diffPageStates = (
  before: PageAppState,
  after: PageAppState
): PageDiff => {
  const beforeAreas = new Map(before.areas.map((area) => [area.id, area]))
  const afterAreas = new Map(after.areas.map((area) => [area.id, area]))
  const beforeLinks = new Map((before.links ?? []).map((link) => [link.id, link]))
  const afterLinks = new Map((after.links ?? []).map((link) => [link.id, link]))

  return {
    addedAreas: sortAreasForDiff(
      after.areas.filter((area) => !beforeAreas.has(area.id))
    ).map(toAreaSummary),
    removedAreas: sortAreasForDiff(
      before.areas.filter((area) => !afterAreas.has(area.id))
    ).map(toAreaSummary),
    changedAreas: sortAreasForDiff(
      after.areas.filter((area) => beforeAreas.has(area.id))
    ).flatMap((area) => {
      const previous = beforeAreas.get(area.id)
      if (!previous) return []

      const changedFields = getChangedAreaFields(previous, area)

      return changedFields.length > 0
        ? [
            {
              id: area.id,
              changedFields,
              before: {
                excerpt: getAreaExcerpt(previous),
              },
              after: {
                excerpt: getAreaExcerpt(area),
              },
            },
          ]
        : []
    }),
    addedLinks: sortLinksForDiff(
      (after.links ?? []).filter((link) => !beforeLinks.has(link.id))
    ).map(toLinkSummary),
    removedLinks: sortLinksForDiff(
      (before.links ?? []).filter((link) => !afterLinks.has(link.id))
    ).map(toLinkSummary),
    changedLinks: sortLinksForDiff(
      (after.links ?? []).filter((link) => {
        const previous = beforeLinks.get(link.id)

        return previous ? stableJson(previous) !== stableJson(link) : false
      })
    ).map(toLinkSummary),
    pageChanges: getPageChanges(before, after),
  }
}

const getChangedAreaFields = (
  before: AreaState,
  after: AreaState
): AreaChangedField[] => {
  const fields: AreaChangedField[] = []

  if (getAreaText(before) !== getAreaText(after)) fields.push('text')
  if (before.x !== after.x || before.y !== after.y) fields.push('position')
  if (before.width !== after.width || before.height !== after.height) {
    fields.push('size')
  }
  if (stableJson(before.styles) !== stableJson(after.styles)) {
    fields.push('styles')
  }
  if (stableJson(before.metadata ?? null) !== stableJson(after.metadata ?? null)) {
    fields.push('metadata')
  }
  if (before.parentId !== after.parentId) fields.push('parent')

  return fields
}

const getPageChanges = (
  before: PageAppState,
  after: PageAppState
): PageChangedField[] => {
  const changes: PageChangedField[] = []

  if (before.page.title !== after.page.title) changes.push('title')
  if (
    stableJson(before.page.settings) !== stableJson(after.page.settings)
  ) {
    changes.push('settings')
  }

  return changes
}

const sortAreasForDiff = (areas: AreaState[]) =>
  [...areas].sort(
    (left, right) =>
      left.y - right.y ||
      left.x - right.x ||
      left.id.localeCompare(right.id)
  )

const sortLinksForDiff = (links: AreaLink[]) =>
  [...links].sort((left, right) => left.id.localeCompare(right.id))

const toAreaSummary = (area: AreaState): PageDiffAreaSummary => ({
  id: area.id,
  excerpt: getAreaExcerpt(area),
})

const toLinkSummary = (link: AreaLink): PageDiffLinkSummary => ({
  id: link.id,
  label: link.label ?? link.kind,
  fromAreaId: link.fromAreaId,
  toAreaId: link.toAreaId,
})

const getAreaExcerpt = (area: AreaState) =>
  truncateExcerpt(getAreaText(area).split(/\r?\n/)[0]?.trim() || area.id)

const getAreaText = (area: AreaState) =>
  area.type === 'image' ? area.alt : area.text

const truncateExcerpt = (value: string) =>
  value.length <= 80 ? value : `${value.slice(0, 77)}...`

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}
