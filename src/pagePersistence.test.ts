import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDefaultPageState,
  parsePageJson,
  serializePageState,
  stringifyPageState,
} from './pagePersistence.ts'

const now = '2026-06-26T12:00:00.000Z'
const areas = [
  {
    id: 'area-1',
    parentId: null,
    x: 100,
    y: 120,
    height: 56,
    width: 240,
    text: 'Persist me',
    styles: {
      border: '1px solid red',
      color: 'blue',
    },
  },
]
const restoredAreas = [
  {
    ...areas[0],
    createdAt: now,
    updatedAt: now,
  },
]
const imageAsset = {
  id: 'asset-1',
  kind: 'image' as const,
  mimeType: 'image/png',
  width: 320,
  height: 180,
  storageKey: 'data:image/png;base64,abc',
  createdAt: now,
}
const gifAsset = {
  id: 'gif-asset-1',
  kind: 'image' as const,
  mimeType: 'image/gif',
  width: 200,
  height: 160,
  storageKey: 'https://media.giphy.com/full.gif',
  createdAt: now,
  source: {
    provider: 'giphy' as const,
    providerAssetId: 'gif-1',
    providerUrl: 'https://giphy.com/gifs/gif-1',
    title: 'Ship it',
    rating: 'pg',
    rendition: 'fixed_width',
    stillUrl: 'https://media.giphy.com/still.gif',
    animatedUrl: 'https://media.giphy.com/full.gif',
    attributionLabel: 'Powered by GIPHY' as const,
    analytics: {
      onload: 'https://analytics.giphy.com/onload',
      onclick: 'https://analytics.giphy.com/click',
      onsent: 'https://analytics.giphy.com/send',
    },
  },
}
const imageArea = {
  id: 'image-area-1',
  type: 'image' as const,
  parentId: null,
  x: 300,
  y: 340,
  height: 180,
  width: 320,
  assetId: 'asset-1',
  alt: 'Chart preview',
  styles: {},
  createdAt: now,
  updatedAt: now,
}
const themeColor = {
  id: 'color-1',
  name: 'Business Blue',
  token: 'business-blue',
  value: '#2563eb',
  createdAt: now,
  updatedAt: now,
}
const shareLinks = {
  pageId: 'page-1',
  editToken: 'edit-token',
  viewToken: 'view-token',
  createdAt: now,
  updatedAt: now,
  revokedAt: null,
}
const areaMetadata = {
  kind: 'decision' as const,
  status: 'decided' as const,
  tags: ['architecture', 'agent'],
  filePath: 'src/App.tsx',
  url: 'https://example.com/decision',
  evidence: [
    {
      id: 'evidence-1',
      kind: 'file' as const,
      label: 'App.tsx',
      target: 'src/App.tsx',
      createdAt: now,
    },
  ],
}
const areaLink = {
  id: 'link-1',
  fromAreaId: 'area-1',
  toAreaId: 'child-area',
  kind: 'relates-to' as const,
  label: 'supports',
  from: {
    areaId: 'area-1',
    anchor: 'right' as const,
    side: 'right' as const,
    position: 0.35,
    behavior: 'fixed' as const,
  },
  to: {
    areaId: 'child-area',
    anchor: 'left' as const,
    side: 'left' as const,
    position: 0.65,
    behavior: 'fixed' as const,
  },
  visual: {
    mode: 'schema' as const,
    direction: 'forward' as const,
    route: 'orthogonal' as const,
    labelVisibility: 'always' as const,
  },
  schema: {
    fromCardinality: 'one' as const,
    toCardinality: 'many' as const,
    optionality: 'required' as const,
    fieldLabel: 'parent_id',
  },
  createdAt: now,
  updatedAt: now,
}

test('serializes page state into schema version 1 JSON', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const snapshot = serializePageState({ areas, assets: [], page }, now)

  assert.deepEqual(snapshot, {
    schemaVersion: 1,
    page: {
      id: 'page-1',
      title: 'Untitled page',
      createdAt: now,
      updatedAt: now,
      settings: {
        background: '#ffffff',
        snapGrid: {
          enabled: false,
          size: 16,
          visible: false,
        },
        theme: {
          colors: [],
        },
        mcp: {
          enabled: false,
        },
        shareLinks: null,
      },
    },
    areas: [
      {
        id: 'area-1',
        type: 'text',
        parentId: null,
        x: 100,
        y: 120,
        width: 240,
        height: 56,
        text: 'Persist me',
        styles: {
          border: '1px solid red',
          color: 'blue',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    assets: [],
  })
})

test('stringifies page JSON deterministically', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const snapshot = serializePageState({ areas, assets: [], page }, now)

  assert.equal(
    stringifyPageState({ areas, assets: [], page }, now),
    `${JSON.stringify(snapshot, null, 2)}\n`
  )
})

test('parses persisted JSON back to app state', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const json = stringifyPageState({ areas, assets: [], page }, now)
  const result = parsePageJson(json)

  assert.equal(result.ok, true)
  assert.deepEqual(result.ok ? result.state.areas : [], restoredAreas)
  assert.deepEqual(result.ok ? result.state.page : null, page)
})

test('serializes and parses image areas with image assets', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const snapshot = serializePageState(
    {
      areas: [imageArea],
      assets: [imageAsset],
      page,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(snapshot.areas, [imageArea])
  assert.deepEqual(snapshot.assets, [imageAsset])
  assert.equal(result.ok, true)
  assert.deepEqual(result.ok ? result.state.areas : [], [imageArea])
  assert.deepEqual(result.ok ? result.state.assets : [], [imageAsset])
})

test('serializes and parses gif source metadata on image assets', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const snapshot = serializePageState({
    areas: [],
    assets: [gifAsset],
    page,
  })
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(snapshot.assets, [gifAsset])
  assert.equal(result.ok, true)
  assert.deepEqual(result.ok ? result.state.assets : [], [gifAsset])
})

test('serializes and parses theme color tokens', () => {
  const page = {
    ...createDefaultPageState({
      id: 'page-1',
      now,
    }),
    settings: {
      ...createDefaultPageState({ id: 'page-1', now }).settings,
      theme: {
        colors: [themeColor],
      },
    },
  }
  const snapshot = serializePageState(
    {
      areas,
      assets: [],
      page,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(snapshot.page.settings.theme.colors, [themeColor])
  assert.deepEqual(
    result.ok ? result.state.page.settings.theme.colors : [],
    [themeColor]
  )
})

test('serializes and parses share links', () => {
  const page = {
    ...createDefaultPageState({
      id: 'page-1',
      now,
    }),
    settings: {
      ...createDefaultPageState({ id: 'page-1', now }).settings,
      shareLinks,
    },
  }
  const snapshot = serializePageState(
    {
      areas,
      assets: [],
      page,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(snapshot.page.settings.shareLinks, shareLinks)
  assert.deepEqual(
    result.ok ? result.state.page.settings.shareLinks : null,
    shareLinks
  )
})

test('serializes and parses MCP page access settings', () => {
  const page = {
    ...createDefaultPageState({
      id: 'page-1',
      now,
    }),
    settings: {
      ...createDefaultPageState({ id: 'page-1', now }).settings,
      mcp: {
        enabled: true,
      },
    },
  }
  const snapshot = serializePageState(
    {
      areas,
      assets: [],
      page,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(snapshot.page.settings.mcp, {
    enabled: true,
  })
  assert.deepEqual(result.ok ? result.state.page.settings.mcp : null, {
    enabled: true,
  })
})

test('serializes and parses nested area parent ids', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const nestedAreas = [
    areas[0],
    {
      ...areas[0],
      id: 'child-area',
      parentId: 'area-1',
      x: 20,
      y: 24,
      text: 'Nested child',
    },
  ]
  const snapshot = serializePageState(
    {
      areas: nestedAreas,
      assets: [],
      page,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(
    snapshot.areas.map((area) => ({
      id: area.id,
      parentId: area.parentId,
    })),
    [
      { id: 'area-1', parentId: null },
      { id: 'child-area', parentId: 'area-1' },
    ]
  )
  assert.deepEqual(
    result.ok
      ? result.state.areas.map((area) => ({
          id: area.id,
          parentId: area.parentId,
        }))
      : [],
    [
      { id: 'area-1', parentId: null },
      { id: 'child-area', parentId: 'area-1' },
    ]
  )
})

test('serializes and parses area metadata and links', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const typedAreas = [
    {
      ...areas[0],
      metadata: areaMetadata,
    },
    {
      ...areas[0],
      id: 'child-area',
      parentId: 'area-1',
      text: 'Supporting note',
    },
  ]
  const snapshot = serializePageState(
    {
      areas: typedAreas,
      assets: [],
      links: [areaLink],
      page,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.deepEqual(snapshot.areas[0].metadata, areaMetadata)
  assert.deepEqual(snapshot.links, [areaLink])
  assert.equal(result.ok, true)
  assert.deepEqual(
    result.ok ? result.state.areas[0].metadata : null,
    areaMetadata
  )
  assert.deepEqual(result.ok ? result.state.links : [], [areaLink])
})

test('restores legacy links with connector visual defaults', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const snapshot = serializePageState(
    {
      areas,
      assets: [],
      links: [
        {
          id: 'legacy-link',
          fromAreaId: 'area-1',
          toAreaId: 'child-area',
          kind: 'depends-on',
          createdAt: now,
          updatedAt: now,
        },
      ],
      page,
    },
    now
  )
  const legacyJson = JSON.stringify({
    ...snapshot,
    links: [
      {
        id: 'legacy-link',
        fromAreaId: 'area-1',
        toAreaId: 'child-area',
        kind: 'depends-on',
        createdAt: now,
        updatedAt: now,
      },
    ],
  })
  const result = parsePageJson(legacyJson)

  assert.equal(result.ok, true)
  assert.deepEqual(result.ok ? result.state.links : [], [
    {
      id: 'legacy-link',
      fromAreaId: 'area-1',
      toAreaId: 'child-area',
      kind: 'depends-on',
      visual: {
        mode: 'semantic',
        direction: 'forward',
        route: 'auto',
        labelVisibility: 'auto',
      },
      createdAt: now,
      updatedAt: now,
    },
  ])
})

test('clamps persisted snap grid size while saving and restoring', () => {
  const page = createDefaultPageState({
    id: 'page-1',
    now,
  })
  const oversizedPage = {
    ...page,
    settings: {
      ...page.settings,
      snapGrid: {
        enabled: true,
        size: 400,
        visible: true,
      },
    },
  }
  const snapshot = serializePageState(
    {
      areas,
      assets: [],
      page: oversizedPage,
    },
    now
  )
  const result = parsePageJson(JSON.stringify(snapshot))

  assert.equal(snapshot.page.settings.snapGrid.size, 128)
  assert.equal(
    result.ok ? result.state.page.settings.snapGrid.size : 0,
    128
  )
})

test('ignores unknown future fields while restoring known state', () => {
  const json = JSON.stringify({
    schemaVersion: 1,
    page: {
      id: 'page-1',
      title: 'Imported page',
      createdAt: now,
      updatedAt: now,
      settings: {
        background: '#ffffff',
        snapGrid: {
          enabled: false,
          size: 16,
          visible: false,
        },
        theme: {
          colors: [],
        },
        mcp: {
          enabled: false,
        },
        shareLinks: null,
      },
      futurePageField: true,
    },
    areas: [
      {
        ...areas[0],
        type: 'text',
        createdAt: now,
        updatedAt: now,
        futureAreaField: true,
      },
    ],
    assets: [],
    futureRootField: true,
  })
  const result = parsePageJson(json)

  assert.equal(result.ok, true)
  assert.equal(result.ok ? result.state.page.title : '', 'Imported page')
  assert.deepEqual(result.ok ? result.state.areas : [], restoredAreas)
})

test('rejects invalid imports without returning replacement state', () => {
  const result = parsePageJson('{not valid json')

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.error, /valid JSON/)
})

test('rejects unsupported schema versions', () => {
  const result = parsePageJson(
    JSON.stringify({
      schemaVersion: 99,
      page: {},
      areas: [],
      assets: [],
    })
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.error, /schema/)
})
