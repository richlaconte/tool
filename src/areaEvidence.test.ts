import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addAreaEvidenceReference,
  createAreaEvidenceReference,
  detectAreaEvidenceKind,
  findEvidenceSlashCommand,
  getAreaEvidenceLabel,
  removeAreaEvidenceSlashCommand,
  removeAreaEvidenceReference,
} from './areaEvidence.ts'
import type { AreaState } from './App.tsx'

const now = '2026-06-29T12:00:00.000Z'

const area: AreaState = {
  id: 'area-1',
  parentId: null,
  x: 100,
  y: 120,
  width: 280,
  height: 96,
  text: 'Risk: auth redirect loop',
  styles: {},
  createdAt: now,
  updatedAt: now,
}

test('detects common evidence kinds without network validation', () => {
  assert.equal(detectAreaEvidenceKind('src/App.tsx'), 'file')
  assert.equal(
    detectAreaEvidenceKind('https://github.com/org/repo/pull/42'),
    'url'
  )
  assert.equal(detectAreaEvidenceKind('issue #123'), 'issue')
  assert.equal(detectAreaEvidenceKind('PR 42'), 'pull-request')
  assert.equal(detectAreaEvidenceKind('commit abc1234'), 'commit')
  assert.equal(detectAreaEvidenceKind('pnpm test'), 'command')
  assert.equal(detectAreaEvidenceKind('Design note'), 'note')
})

test('creates readable evidence references with conservative labels', () => {
  assert.deepEqual(
    createAreaEvidenceReference({
      id: 'evidence-1',
      target: 'src/components/Area.tsx',
      now,
    }),
    {
      id: 'evidence-1',
      kind: 'file',
      label: 'Area.tsx',
      target: 'src/components/Area.tsx',
      createdAt: now,
    }
  )
  assert.equal(
    getAreaEvidenceLabel({
      id: 'evidence-2',
      kind: 'url',
      label: '',
      target: 'https://example.com/specs/feature',
      createdAt: now,
    }),
    'feature'
  )
})

test('adds and removes evidence immutably through area metadata', () => {
  const evidence = createAreaEvidenceReference({
    id: 'evidence-1',
    target: 'pnpm test',
    now,
  })
  const nextArea = addAreaEvidenceReference(area, evidence)

  assert.notEqual(nextArea, area)
  assert.deepEqual(nextArea.metadata?.evidence, [evidence])
  assert.deepEqual(
    removeAreaEvidenceReference(nextArea, 'evidence-1').metadata?.evidence,
    []
  )
})

test('finds and removes /ref commands from area text', () => {
  const text = 'Check this\n/ref src/App.tsx'
  const command = findEvidenceSlashCommand(text, text.length)

  assert.deepEqual(command, {
    raw: '/ref src/App.tsx',
    target: 'src/App.tsx',
    start: 11,
    end: 27,
  })
  assert.deepEqual(removeAreaEvidenceSlashCommand(text, command!), {
    text: 'Check this\n',
    caretIndex: 11,
  })
})
