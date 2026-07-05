import type { AreaState, AssetState } from './App'
import {
  AREA_KINDS,
  AREA_LINK_KINDS,
  AREA_STATUSES,
  createAreaLink,
} from './areaMetadata.ts'
import { DEFAULT_AREA_HEIGHT, DEFAULT_AREA_WIDTH } from './areaResize.ts'
import {
  createDefaultPageState,
  type PageAppState,
} from './pagePersistence.ts'

type BenchmarkPageOptions = {
  areaCount?: number
  pageId?: string
  seed?: number | string
  now?: string
}

const DEFAULT_BENCHMARK_AREA_COUNT = 600

const hashSeed = (seed: number | string) => {
  const input = String(seed)
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const createRandom = (seed: number | string) => {
  let state =
    typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <Value>(values: readonly Value[], random: () => number) =>
  values[Math.floor(random() * values.length)] ?? values[0]

const createBenchmarkText = (
  index: number,
  random: () => number
) => {
  const topics = [
    'Interaction contract',
    'Data sync edge case',
    'Style command',
    'Review checkpoint',
    'Connector behavior',
    'Template cleanup',
    'Export concern',
    'Performance note',
  ]
  const topic = pick(topics, random)
  const status = pick(AREA_STATUSES, random)

  return `${topic} ${index + 1}\n\nStatus: ${status}\n\nThis Area is generated benchmark content for canvas-scale testing.`
}

export const createBenchmarkPageState = ({
  areaCount = DEFAULT_BENCHMARK_AREA_COUNT,
  pageId = 'page_benchmark',
  seed = 'cascadery-benchmark',
  now = new Date().toISOString(),
}: BenchmarkPageOptions = {}): PageAppState => {
  const count = Math.max(0, Math.floor(areaCount))
  const random = createRandom(seed)
  const areas: AreaState[] = []
  const assets: AssetState[] = []
  const rootAreaIds: string[] = []

  for (let index = 0; index < count; index += 1) {
    const id = `benchmark_area_${index + 1}`
    const row = Math.floor(index / 12)
    const column = index % 12
    const parentId =
      index > 0 && index % 9 === 0 && rootAreaIds.length > 0
        ? rootAreaIds[Math.floor(random() * rootAreaIds.length)]
        : null
    const x = parentId
      ? 28 + Math.floor(random() * 120)
      : 80 + column * 360 + Math.floor(random() * 96)
    const y = parentId
      ? 42 + Math.floor(random() * 120)
      : 80 + row * 260 + Math.floor(random() * 72)
    const width = parentId
      ? 180 + Math.floor(random() * 70)
      : DEFAULT_AREA_WIDTH + Math.floor(random() * 120)
    const height = parentId
      ? 120 + Math.floor(random() * 70)
      : DEFAULT_AREA_HEIGHT + Math.floor(random() * 90)
    const metadata =
      index % 4 === 0
        ? {
            kind: pick(AREA_KINDS, random),
            status: pick(AREA_STATUSES, random),
            tags: ['benchmark', `cluster-${row % 8}`],
          }
        : undefined
    const styles =
      index % 7 === 0
        ? {
            border: '1px solid #d4d4d8',
            background: '#fafafa',
          }
        : {}

    if (index % 20 === 0) {
      const assetId = `benchmark_asset_${index + 1}`

      assets.push({
        id: assetId,
        kind: 'image',
        mimeType: 'image/svg+xml',
        width: 640,
        height: 360,
        storageKey: `benchmark://image/${index + 1}`,
        createdAt: now,
      })
      areas.push({
        id,
        type: 'image',
        parentId,
        x,
        y,
        width,
        height,
        assetId,
        alt: `Benchmark placeholder image ${index + 1}`,
        styles,
        metadata,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      areas.push({
        id,
        type: 'text',
        parentId,
        x,
        y,
        width,
        height,
        text: createBenchmarkText(index, random),
        styles,
        metadata,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (!parentId) {
      rootAreaIds.push(id)
    }
  }

  const linkCount = Math.floor(count * 0.5)
  const links = Array.from({ length: linkCount }, (_, index) => {
    const fromIndex = Math.floor(random() * count)
    const toIndex = (fromIndex + 1 + Math.floor(random() * (count - 1))) % count
    const fromAreaId = `benchmark_area_${fromIndex + 1}`
    const toAreaId = `benchmark_area_${toIndex + 1}`

    return createAreaLink({
      id: `benchmark_link_${index + 1}`,
      fromAreaId,
      toAreaId,
      kind: pick(AREA_LINK_KINDS, random),
      label: index % 5 === 0 ? `Link ${index + 1}` : undefined,
      visual: {
        mode: index % 6 === 0 ? 'schema' : 'semantic',
        direction: 'forward',
        route: index % 3 === 0 ? 'orthogonal' : 'straight',
      },
      now,
    })
  })

  return {
    page: {
      ...createDefaultPageState({ id: pageId, now }),
      title: 'Benchmark canvas',
    },
    areas,
    assets,
    links,
    comments: [],
    journal: [],
  }
}
