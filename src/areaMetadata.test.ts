import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAreaLink,
  getAreaMetadata,
  normalizeAreaLink,
  removeAreaLinksForDeletedAreas,
  setAreaMetadata,
} from './areaMetadata.ts'
import type { AreaState } from './App.tsx'

const now = '2026-06-29T12:00:00.000Z'

const area: AreaState = {
  id: 'area-1',
  parentId: null,
  x: 100,
  y: 120,
  width: 240,
  height: 80,
  text: 'Decision: ship metadata',
  styles: {},
  createdAt: now,
  updatedAt: now,
}

test('area metadata defaults to a note without forcing persisted fields', () => {
  assert.deepEqual(getAreaMetadata(area), {
    kind: 'note',
    tags: [],
  })
})

test('sets area metadata while preserving existing area content', () => {
  const nextArea = setAreaMetadata(area, {
    kind: 'decision',
    status: 'decided',
    tags: ['architecture', 'agent'],
    filePath: 'src/App.tsx',
    url: 'https://example.com/decision',
  })

  assert.equal(nextArea.text, area.text)
  assert.deepEqual(nextArea.metadata, {
    kind: 'decision',
    status: 'decided',
    tags: ['architecture', 'agent'],
    filePath: 'src/App.tsx',
    url: 'https://example.com/decision',
  })
})

test('creates directional links between stable area ids', () => {
  assert.deepEqual(
    createAreaLink({
      id: 'link-1',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'blocks',
      label: 'blocks launch',
      now,
    }),
    {
      id: 'link-1',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'blocks',
      label: 'blocks launch',
      visual: {
        mode: 'semantic',
        direction: 'forward',
        route: 'auto',
        labelVisibility: 'auto',
      },
      createdAt: now,
      updatedAt: now,
    }
  )
})

test('normalizes connector visual and schema metadata with migration defaults', () => {
  assert.deepEqual(
    normalizeAreaLink({
      id: 'link-1',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'references',
      label: ' user_id ',
      from: {
        areaId: 'area-1',
        anchor: 'left',
      },
      to: {
        areaId: 'area-2',
        anchor: 'right',
      },
      visual: {
        mode: 'schema',
        direction: 'both',
        route: 'orthogonal',
        labelVisibility: 'always',
      },
      schema: {
        fromCardinality: 'many',
        toCardinality: 'one',
        optionality: 'required',
        fieldLabel: ' user_id ',
      },
      createdAt: now,
      updatedAt: now,
    }),
    {
      id: 'link-1',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'references',
      label: 'user_id',
      from: {
        areaId: 'area-1',
        anchor: 'left',
      },
      to: {
        areaId: 'area-2',
        anchor: 'right',
      },
      visual: {
        mode: 'schema',
        direction: 'both',
        route: 'orthogonal',
        labelVisibility: 'always',
      },
      schema: {
        fromCardinality: 'many',
        toCardinality: 'one',
        optionality: 'required',
        fieldLabel: 'user_id',
      },
      createdAt: now,
      updatedAt: now,
    }
  )

  assert.deepEqual(
    normalizeAreaLink({
      id: 'legacy-link',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'relates-to',
      createdAt: now,
      updatedAt: now,
    }),
    {
      id: 'legacy-link',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'relates-to',
      visual: {
        mode: 'semantic',
        direction: 'forward',
        route: 'auto',
        labelVisibility: 'auto',
      },
      createdAt: now,
      updatedAt: now,
    }
  )
})

test('removes links attached to deleted areas', () => {
  const links = [
    createAreaLink({
      id: 'link-1',
      fromAreaId: 'area-1',
      toAreaId: 'area-2',
      kind: 'relates-to',
      now,
    }),
    createAreaLink({
      id: 'link-2',
      fromAreaId: 'area-3',
      toAreaId: 'area-4',
      kind: 'references',
      now,
    }),
  ]

  assert.deepEqual(
    removeAreaLinksForDeletedAreas(links, new Set(['area-2'])),
    [links[1]]
  )
})
