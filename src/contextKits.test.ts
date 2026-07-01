import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTEXT_KITS,
  getContextKitById,
  insertContextKit,
} from './contextKits.ts'
import type { PageAppState } from './pagePersistence.ts'
import { createDefaultPageState } from './pagePersistence.ts'

const now = '2026-06-29T12:00:00.000Z'

const state: PageAppState = {
  page: createDefaultPageState({
    id: 'page-1',
    now,
  }),
  areas: [],
  assets: [],
  links: [],
}

test('context kits describe developer workflows with typed starter areas', () => {
  assert.ok(CONTEXT_KITS.length >= 5)

  for (const kit of CONTEXT_KITS) {
    assert.ok(kit.id)
    assert.ok(kit.title)
    assert.ok(kit.description)
    assert.ok(kit.icon)
    assert.ok(kit.areas.length >= 3)
    assert.ok(kit.areas.every((area) => area.text.trim()))
    assert.ok(kit.areas.some((area) => area.kind && area.kind !== 'note'))
  }
})

test('context kits do not include the removed UI state matrix template', () => {
  assert.equal(getContextKitById('ui-state-matrix'), null)
  assert.equal(
    CONTEXT_KITS.some((kit) => kit.id === 'ui-state-matrix'),
    false
  )
})

test('context kit insertion creates normal areas with fresh ids and links', () => {
  const kit = getContextKitById('implementation-map')
  assert.ok(kit)

  const result = insertContextKit(state, kit!, {
    createAreaId: (index) => `area-${index}`,
    createLinkId: (index) => `link-${index}`,
    now,
  })

  assert.equal(result.areas.length, kit!.areas.length)
  assert.equal(result.areas[0].id, 'area-0')
  assert.equal(result.areas[0].type, 'text')
  assert.equal(result.areas[0].createdAt, now)
  assert.equal(result.selectedAreaId, 'area-0')
  assert.ok(result.areas.every((area) => area.styles))
  assert.ok(result.links.every((link) => link.fromAreaId.startsWith('area-')))
  assert.ok(result.links.every((link) => link.toAreaId.startsWith('area-')))
  assert.ok(
    result.links.every(
      (link) =>
        link.from?.behavior === 'fixed' &&
        link.to?.behavior === 'fixed' &&
        link.from.side &&
        link.to.side &&
        typeof link.from.position === 'number' &&
        typeof link.to.position === 'number'
    )
  )
})

test('sprint retro kit creates six h2-style prompts in one row', () => {
  const kit = getContextKitById('sprint-retro')
  assert.ok(kit)
  assert.equal(kit!.title, 'Sprint Retro')
  assert.equal(kit!.description, 'Reflect on the sprint and choose next actions.')
  assert.equal(kit!.areas.length, 6)
  assert.deepEqual(
    kit!.areas.map((area) => area.id),
    [
      'went-well',
      'challenges',
      'risks',
      'action-items',
      'shoutouts',
      'feelings',
    ]
  )
  assert.deepEqual(
    kit!.areas.map((area) => area.text),
    [
      'Went well',
      'Challenges',
      'Risks',
      'Action items',
      'Shoutouts',
      'Feelings',
    ]
  )
  assert.deepEqual(
    kit!.areas.map((area) => area.kind),
    ['note', 'question', 'risk', 'task', 'note', 'question']
  )
  assert.ok(kit!.areas.every((area) => area.tags?.includes('retro')))
  assert.ok(
    kit!.areas
      .filter((area) => area.id === 'action-items')
      .every((area) => area.tags?.includes('action'))
  )
  assert.ok(kit!.areas.every((area) => area.y === kit!.areas[0].y))

  for (let index = 1; index < kit!.areas.length; index += 1) {
    const previousArea = kit!.areas[index - 1]
    const currentArea = kit!.areas[index]

    assert.ok(currentArea.x > previousArea.x)
    assert.ok(currentArea.x >= previousArea.x + previousArea.width)
  }

  assert.ok(
    kit!.areas.every(
      (area) =>
        area.styles?.['font-size'] === '24px' &&
        area.styles?.['font-weight'] === '700' &&
        area.styles?.['line-height'] === '1.2'
    )
  )
  assert.equal(kit!.links?.length ?? 0, 0)
})
