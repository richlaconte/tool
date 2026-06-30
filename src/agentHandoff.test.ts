import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAgentHandoffBrief,
  getAgentHandoffWarnings,
} from './agentHandoff.ts'
import type { PageAppState } from './pagePersistence.ts'
import { createDefaultPageState } from './pagePersistence.ts'

const now = '2026-06-29T12:00:00.000Z'

const state: PageAppState = {
  page: {
    ...createDefaultPageState({
      id: 'page-1',
      now,
    }),
    title: 'Checkout Refactor',
    settings: {
      ...createDefaultPageState({ id: 'page-1', now }).settings,
      shareLinks: {
        pageId: 'page-1',
        editToken: 'secret-edit-token',
        viewToken: 'secret-view-token',
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
      id: 'goal-1',
      parentId: null,
      x: 80,
      y: 120,
      width: 320,
      height: 120,
      text: 'Goal: simplify checkout state handling.',
      metadata: {
        kind: 'note',
        tags: ['goal'],
        evidence: [
          {
            id: 'evidence-1',
            kind: 'file',
            label: 'checkout.ts',
            target: 'src/checkout.ts',
            createdAt: now,
          },
        ],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'decision-1',
      parentId: null,
      x: 440,
      y: 120,
      width: 320,
      height: 120,
      text: 'Decision: keep validation client-side first.',
      metadata: {
        kind: 'decision',
        status: 'decided',
        tags: [],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-1',
      parentId: null,
      x: 80,
      y: 300,
      width: 320,
      height: 120,
      text: '- [ ] Update checkout reducer\nValidation: pnpm test',
      metadata: {
        kind: 'task',
        tags: [],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'risk-1',
      parentId: null,
      x: 440,
      y: 300,
      width: 320,
      height: 120,
      text: 'Risk: payment edge cases regress.',
      metadata: {
        kind: 'risk',
        tags: [],
      },
      styles: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'question-1',
      parentId: null,
      x: 800,
      y: 300,
      width: 320,
      height: 120,
      text: 'Open question: do we need server fallback?',
      metadata: {
        kind: 'question',
        tags: [],
      },
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
      kind: 'implements',
      label: 'drives',
      createdAt: now,
      updatedAt: now,
    },
  ],
}

test('agent handoff brief groups typed areas and includes evidence', () => {
  const brief = createAgentHandoffBrief(state)

  assert.match(brief.markdown, /^# Agent Handoff: Checkout Refactor/)
  assert.match(brief.markdown, /## Goal\n\n- Goal: simplify checkout/)
  assert.match(brief.markdown, /## Decisions\n\n- Decision: keep validation/)
  assert.match(brief.markdown, /## Tasks\n\n- \[ \] Update checkout reducer/)
  assert.match(brief.markdown, /## Risks\n\n- Risk: payment edge cases/)
  assert.match(brief.markdown, /## Open Questions\n\n- Open question:/)
  assert.match(brief.markdown, /## Evidence and References/)
  assert.match(brief.markdown, /`src\/checkout\.ts`/)
  assert.match(brief.markdown, /`decision-1` -> `task-1`/)
  assert.match(brief.markdown, /Suggested Agent Instructions/)
  assert.doesNotMatch(brief.markdown, /secret-edit-token/)
  assert.doesNotMatch(brief.markdown, /private-image-bits/)
})

test('agent handoff warnings identify missing execution context', () => {
  const warnings = getAgentHandoffWarnings({
    ...state,
    areas: state.areas.filter((area) => area.id !== 'goal-1'),
  })

  assert.ok(warnings.includes('No explicit goal.'))
  assert.ok(warnings.includes('No acceptance criteria.'))
})
