import assert from 'node:assert/strict'
import test from 'node:test'

import { createBenchmarkPageState } from './benchmarkPage.ts'

const now = '2026-07-05T12:00:00.000Z'

test('creates deterministic benchmark page content from a seed', () => {
  const first = createBenchmarkPageState({
    areaCount: 200,
    pageId: 'page_benchmark',
    seed: 'cascadery',
    now,
  })
  const second = createBenchmarkPageState({
    areaCount: 200,
    pageId: 'page_benchmark',
    seed: 'cascadery',
    now,
  })
  const differentSeed = createBenchmarkPageState({
    areaCount: 200,
    pageId: 'page_benchmark',
    seed: 'different',
    now,
  })

  assert.deepEqual(first, second)
  assert.notDeepEqual(
    first.areas.map((area) => [area.x, area.y, area.text]),
    differentSeed.areas.map((area) => [area.x, area.y, area.text])
  )
})

test('mixes text, image, nested, typed, and linked benchmark areas', () => {
  const state = createBenchmarkPageState({
    areaCount: 240,
    pageId: 'page_benchmark',
    seed: 'large-canvas',
    now,
  })
  const imageAreas = state.areas.filter(
    (area) => area.type === 'image'
  )
  const nestedAreas = state.areas.filter(
    (area) => area.parentId !== null
  )
  const typedAreas = state.areas.filter(
    (area) => area.metadata?.kind !== undefined
  )

  assert.equal(state.areas.length, 240)
  assert.equal(imageAreas.length, 12)
  assert.equal(state.assets.length, imageAreas.length)
  assert.ok(nestedAreas.length >= 20)
  assert.ok(typedAreas.length >= 40)
  assert.equal(state.links?.length, 120)
  assert.equal(state.page.title, 'Benchmark canvas')
})
