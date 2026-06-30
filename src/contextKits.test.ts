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
})

test('sprint retro kit creates a linked retrospective board', () => {
  const kit = getContextKitById('sprint-retro')
  assert.ok(kit)
  assert.equal(kit!.title, 'Sprint Retro')
  assert.equal(kit!.description, 'Reflect on the sprint and choose next actions.')
  assert.equal(kit!.areas.length, 6)
  assert.deepEqual(
    kit!.areas.map((area) => area.id),
    [
      'sprint-context',
      'went-well',
      'needs-attention',
      'learned',
      'try-next-sprint',
      'follow-up-owners',
    ]
  )
  assert.deepEqual(
    kit!.areas.map((area) => area.kind),
    ['note', 'note', 'risk', 'question', 'task', 'task']
  )
  assert.ok(kit!.areas.every((area) => area.tags?.includes('retro')))
  assert.ok(
    kit!.areas
      .filter((area) =>
        ['try-next-sprint', 'follow-up-owners'].includes(area.id)
      )
      .every((area) => area.tags?.includes('action'))
  )
  assert.equal(kit!.links?.length, 5)
  assert.deepEqual(
    kit!.links?.map((link) => [
      link.fromAreaId,
      link.toAreaId,
      link.kind,
    ]),
    [
      ['sprint-context', 'went-well', 'relates-to'],
      ['sprint-context', 'needs-attention', 'relates-to'],
      ['needs-attention', 'try-next-sprint', 'depends-on'],
      ['learned', 'try-next-sprint', 'implements'],
      ['try-next-sprint', 'follow-up-owners', 'depends-on'],
    ]
  )
})
