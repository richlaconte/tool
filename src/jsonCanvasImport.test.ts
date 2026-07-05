import assert from 'node:assert/strict'
import test from 'node:test'

import { exportPageAsJsonCanvas } from './pageExports.ts'
import {
  offsetJsonCanvasImportState,
  parseJsonCanvas,
} from './jsonCanvasImport.ts'
import { createDefaultPageState, type PageAppState } from './pagePersistence.ts'

const now = '2026-07-05T12:00:00.000Z'

test('imports minimal JSON Canvas text, link, file, group, edge, and colors', () => {
  const result = parseJsonCanvas(
    JSON.stringify({
      nodes: [
        {
          id: 'group',
          type: 'group',
          x: 40,
          y: 40,
          width: 320,
          height: 200,
          label: 'Group label',
          color: '4',
        },
        {
          id: 'note',
          type: 'text',
          x: 80,
          y: 90,
          width: 180,
          height: 100,
          text: 'Markdown **note**',
          color: '#ff0000',
        },
        {
          id: 'site',
          type: 'link',
          x: 420,
          y: 90,
          width: 200,
          height: 80,
          url: 'https://example.com',
        },
        {
          id: 'file',
          type: 'file',
          x: 420,
          y: 210,
          width: 200,
          height: 80,
          file: 'docs/spec.md',
        },
      ],
      edges: [
        {
          id: 'edge',
          fromNode: 'note',
          fromSide: 'right',
          toNode: 'site',
          toSide: 'left',
          label: 'references',
        },
      ],
    })
  )

  assert.equal(result.ok, true)
  assert.equal(result.state.areas.length, 4)
  assert.deepEqual(
    result.state.areas.find((area) => area.id === 'note'),
    {
      id: 'note',
      parentId: 'group',
      x: 40,
      y: 50,
      width: 180,
      height: 100,
      text: 'Markdown **note**',
      styles: {
        'border-color': '#ff0000',
      },
      createdAt: result.state.areas.find((area) => area.id === 'note')
        ?.createdAt,
      updatedAt: result.state.areas.find((area) => area.id === 'note')
        ?.updatedAt,
    }
  )
  assert.equal(
    result.state.areas.find((area) => area.id === 'group')?.metadata?.kind,
    'note'
  )
  assert.equal(
    result.state.areas.find((area) => area.id === 'group')?.styles[
      'border-color'
    ],
    '#22c55e'
  )
  assert.equal(
    result.state.areas.find((area) => area.id === 'site')?.metadata?.url,
    'https://example.com'
  )
  assert.equal(
    result.state.areas.find((area) => area.id === 'file')?.metadata?.filePath,
    'docs/spec.md'
  )
  assert.deepEqual(result.state.links?.[0], {
    id: 'edge',
    fromAreaId: 'note',
    toAreaId: 'site',
    kind: 'relates-to',
    label: 'references',
    from: {
      areaId: 'note',
      side: 'right',
      behavior: 'fixed',
    },
    to: {
      areaId: 'site',
      side: 'left',
      behavior: 'fixed',
    },
    visual: {
      mode: 'simple',
      direction: 'forward',
      route: 'auto',
      labelVisibility: 'auto',
    },
    createdAt: result.state.links?.[0]?.createdAt,
    updatedAt: result.state.links?.[0]?.updatedAt,
  })
})

test('restores Cascadery namespaced extensions from JSON Canvas', () => {
  const result = parseJsonCanvas(
    JSON.stringify({
      nodes: [
        {
          id: 'decision',
          type: 'text',
          x: 0,
          y: 0,
          width: 240,
          height: 120,
          text: 'Decision text',
          'x-cascadery-kind': 'decision',
          'x-cascadery-status': 'decided',
          'x-cascadery-tags': ['launch'],
          'x-cascadery-styles': {
            border: '1px solid #2563eb',
          },
          'x-cascadery-evidence': [
            {
              id: 'ev',
              kind: 'url',
              label: 'Reference',
              target: 'https://example.com',
              createdAt: now,
            },
          ],
        },
      ],
      edges: [],
    })
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.state.areas[0]?.metadata, {
    kind: 'decision',
    status: 'decided',
    tags: ['launch'],
    evidence: [
      {
        id: 'ev',
        kind: 'url',
        label: 'Reference',
        target: 'https://example.com',
        createdAt: now,
      },
    ],
  })
  assert.deepEqual(result.state.areas[0]?.styles, {
    border: '1px solid #2563eb',
  })
})

test('imports handwritten malformed and unknown JSON Canvas defensively', () => {
  assert.deepEqual(parseJsonCanvas('{'), {
    ok: false,
    error: 'Import must be valid JSON Canvas.',
  })

  const result = parseJsonCanvas(
    JSON.stringify({
      nodes: [
        {
          id: 'unknown',
          type: 'portal',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
      edges: [
        {
          id: 'dangling',
          fromNode: 'unknown',
          toNode: 'missing',
        },
      ],
    })
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.state.areas, [])
  assert.deepEqual(result.state.links, [])
  assert.match(result.warnings.join(' '), /Unsupported node type/)
  assert.match(result.warnings.join(' '), /missing nodes/)
})

test('round-trips Cascadery fields through JSON Canvas extensions', () => {
  const state: PageAppState = {
    page: createDefaultPageState({ id: 'page_roundtrip', now }),
    assets: [],
    areas: [
      {
        id: 'parent',
        parentId: null,
        x: 20,
        y: 30,
        width: 320,
        height: 200,
        text: 'Parent',
        metadata: {
          kind: 'component',
          status: 'in-progress',
          tags: ['ui'],
          evidence: [
            {
              id: 'evidence',
              kind: 'command',
              label: 'test',
              target: 'pnpm test',
              createdAt: now,
            },
          ],
        },
        styles: {
          background: '#f8fafc',
          border: '1px solid #2563eb',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'child',
        parentId: 'parent',
        x: 24,
        y: 32,
        width: 160,
        height: 90,
        text: 'Child',
        styles: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    links: [
      {
        id: 'link',
        fromAreaId: 'parent',
        toAreaId: 'child',
        kind: 'contains',
        label: 'owns',
        from: {
          areaId: 'parent',
          side: 'bottom',
          position: 0.5,
          behavior: 'fixed',
        },
        to: {
          areaId: 'child',
          side: 'top',
          position: 0.5,
          behavior: 'fixed',
        },
        visual: {
          mode: 'schema',
          direction: 'both',
          route: 'orthogonal',
          labelVisibility: 'always',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
  }

  const result = parseJsonCanvas(JSON.stringify(exportPageAsJsonCanvas(state)))

  assert.equal(result.ok, true)
  assert.equal(
    result.state.areas.find((area) => area.id === 'child')?.parentId,
    'parent'
  )
  assert.deepEqual(
    result.state.areas.find((area) => area.id === 'parent')?.metadata,
    state.areas[0]?.metadata
  )
  assert.deepEqual(
    result.state.areas.find((area) => area.id === 'parent')?.styles,
    state.areas[0]?.styles
  )
  assert.deepEqual(result.state.links?.[0]?.visual, state.links?.[0]?.visual)
  assert.equal(result.state.links?.[0]?.kind, 'contains')
})

test('offsets imported JSON Canvas content below existing areas', () => {
  const imported = parseJsonCanvas(
    JSON.stringify({
      nodes: [
        {
          id: 'note',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          text: 'Imported',
        },
      ],
      edges: [],
    })
  )

  assert.equal(imported.ok, true)

  const offset = offsetJsonCanvasImportState(imported.state, [
    {
      id: 'existing',
      parentId: null,
      x: 40,
      y: 500,
      width: 200,
      height: 100,
      text: 'Existing',
      styles: {},
    },
  ])

  assert.equal(offset.areas[0]?.x, 40)
  assert.equal(offset.areas[0]?.y, 660)
})
