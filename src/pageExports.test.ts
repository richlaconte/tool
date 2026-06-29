import assert from 'node:assert/strict'
import test from 'node:test'

import type { PageAppState } from './pagePersistence.ts'
import { createDefaultPageState } from './pagePersistence.ts'
import {
  exportPageAsJsonCanvas,
  exportPageAsMarkdown,
  stringifyExportedPageState,
} from './pageExports.ts'

const now = '2026-06-29T12:00:00.000Z'

const state: PageAppState = {
  page: {
    ...createDefaultPageState({
      id: 'page-1',
      now,
    }),
    title: 'Launch Plan',
    settings: {
      ...createDefaultPageState({ id: 'page-1', now }).settings,
      shareLinks: {
        pageId: 'page-1',
        editToken: 'raw-edit-secret',
        viewToken: 'raw-view-secret',
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
      },
    },
  },
  assets: [
    {
      id: 'asset-1',
      kind: 'image',
      mimeType: 'image/png',
      width: 640,
      height: 320,
      storageKey: 'data:image/png;base64,private-image-bits',
      createdAt: now,
    },
  ],
  areas: [
    {
      id: 'decision-1',
      parentId: null,
      x: 100.2,
      y: 120.7,
      width: 260.4,
      height: 120.1,
      text: 'Use WebSockets\nfor shared editing.',
      metadata: {
        kind: 'decision',
        status: 'decided',
        tags: ['collaboration'],
        filePath: 'src/server/collaborationServer.ts',
      },
      styles: {
        border: '1px solid #2563eb',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-1',
      parentId: null,
      x: 480,
      y: 120,
      width: 220,
      height: 96,
      text: '- Add Markdown export',
      metadata: {
        kind: 'task',
        status: 'open',
        tags: ['portable'],
        url: 'https://example.com/export',
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'risk-1',
      parentId: null,
      x: 100,
      y: 300,
      width: 240,
      height: 80,
      text: 'Exports should not leak share tokens.',
      metadata: {
        kind: 'risk',
        tags: [],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'note-1',
      parentId: null,
      x: 380,
      y: 300,
      width: 240,
      height: 80,
      text: 'Loose implementation note.',
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'image-1',
      type: 'image',
      parentId: null,
      x: 660,
      y: 300,
      width: 320,
      height: 160,
      assetId: 'asset-1',
      alt: 'Architecture sketch',
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
  ],
  links: [
    {
      id: 'link-1',
      fromAreaId: 'decision-1',
      toAreaId: 'task-1',
      kind: 'depends-on',
      label: 'drives',
      createdAt: now,
      updatedAt: now,
    },
  ],
}

test('Markdown export groups typed Areas and preserves text', () => {
  const markdown = exportPageAsMarkdown(state)

  assert.match(markdown, /^# Launch Plan/)
  assert.match(markdown, /## Decisions\n\n### Use WebSockets/)
  assert.match(markdown, /Area: `decision-1`/)
  assert.match(markdown, /Status: decided/)
  assert.match(markdown, /Tags: collaboration/)
  assert.match(markdown, /File: `src\/server\/collaborationServer\.ts`/)
  assert.match(markdown, /Use WebSockets\nfor shared editing\./)
  assert.match(markdown, /## Tasks\n\n### Add Markdown export/)
  assert.match(markdown, /URL: https:\/\/example\.com\/export/)
  assert.match(markdown, /## Risks\n\n### Exports should not leak share tokens\./)
  assert.match(markdown, /## Areas\n\n### Loose implementation note\./)
  assert.match(markdown, /### Architecture sketch/)
  assert.match(markdown, /Image Area: `image-1`/)
  assert.match(markdown, /Asset: `asset-1`/)
  assert.match(
    markdown,
    /## Links\n\n- `decision-1` -> `task-1` \(depends-on, drives\)/
  )
})

test('JSON Canvas export maps Areas and links without leaking raw assets', () => {
  const canvas = exportPageAsJsonCanvas(state)
  const decisionNode = canvas.nodes.find((node) => node.id === 'decision-1')
  const imageNode = canvas.nodes.find((node) => node.id === 'image-1')
  const edge = canvas.edges[0]
  const serializedCanvas = JSON.stringify(canvas)

  assert.deepEqual(decisionNode, {
    id: 'decision-1',
    type: 'text',
    x: 100,
    y: 121,
    width: 260,
    height: 120,
    text: 'Use WebSockets\nfor shared editing.',
    cascadery: {
      areaType: 'text',
      parentId: null,
      metadata: {
        kind: 'decision',
        status: 'decided',
        tags: ['collaboration'],
        filePath: 'src/server/collaborationServer.ts',
      },
      styles: {
        border: '1px solid #2563eb',
      },
    },
  })
  assert.deepEqual(imageNode, {
    id: 'image-1',
    type: 'text',
    x: 660,
    y: 300,
    width: 320,
    height: 160,
    text: '![Architecture sketch](asset:asset-1)',
    cascadery: {
      areaType: 'image',
      parentId: null,
      alt: 'Architecture sketch',
      asset: {
        id: 'asset-1',
        kind: 'image',
        mimeType: 'image/png',
        width: 640,
        height: 320,
        createdAt: now,
      },
      metadata: {
        kind: 'note',
        tags: [],
      },
      styles: {},
    },
  })
  assert.deepEqual(edge, {
    id: 'link-1',
    fromNode: 'decision-1',
    toNode: 'task-1',
    toEnd: 'arrow',
    label: 'drives',
    cascadery: {
      kind: 'depends-on',
      createdAt: now,
      updatedAt: now,
    },
  })
  assert.doesNotMatch(serializedCanvas, /private-image-bits/)
  assert.doesNotMatch(serializedCanvas, /raw-edit-secret/)
  assert.doesNotMatch(serializedCanvas, /raw-view-secret/)
})

test('Cascadery JSON export redacts share secrets but remains importable', () => {
  const json = stringifyExportedPageState(state, now)

  assert.doesNotMatch(json, /raw-edit-secret/)
  assert.doesNotMatch(json, /raw-view-secret/)
  assert.match(json, /"shareLinks": null/)
  assert.match(json, /"links": \[/)
})
