import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EARS_LINT_RULE_IDS,
  EARS_TEMPLATES,
  lintEarsRequirement,
} from './earsLint.ts'
import { normalizeAreaMetadata } from './areaMetadata.ts'

const WELL_FORMED =
  'Requirement: When the share dialog opens, the system shall generate an edit link within 2 seconds.'

const ruleIds = (text: string) =>
  lintEarsRequirement(text).map((hint) => hint.ruleId)

test('the five EARS templates exist and stay quiet while placeholders remain', () => {
  assert.deepEqual(
    EARS_TEMPLATES.map((template) => template.id),
    [
      'ubiquitous',
      'event-driven',
      'state-driven',
      'optional-feature',
      'unwanted-behavior',
    ]
  )

  for (const template of EARS_TEMPLATES) {
    assert.match(template.text, /shall/)
    // Unfilled scaffolds are drafts: no hints until placeholders are gone.
    assert.deepEqual(lintEarsRequirement(template.text), [])
  }
})

test('a well-formed EARS statement produces no hints', () => {
  assert.deepEqual(lintEarsRequirement(WELL_FORMED), [])
  assert.deepEqual(lintEarsRequirement(''), [])
  assert.deepEqual(lintEarsRequirement('   '), [])
})

test('every lint rule fires on its bad example and passes its counterexample', () => {
  const cases: Array<{ ruleId: string; bad: string; good: string }> = [
    {
      ruleId: 'missing-shall',
      bad: 'Requirement: The system logs every security event.',
      good: WELL_FORMED,
    },
    {
      ruleId: 'weak-modal',
      bad: 'Requirement: The system should log security events, and it shall retain them.',
      good: WELL_FORMED,
    },
    {
      ruleId: 'vague-term',
      bad: 'Requirement: The system shall be fast.',
      good: 'Requirement: The system shall respond within 200 ms at p95.',
    },
    {
      ruleId: 'vague-adverb',
      bad: 'Requirement: The system shall recover gracefully.',
      good: 'Requirement: The system shall retry once, then surface an error banner.',
    },
    {
      ruleId: 'open-ended',
      bad: 'Requirement: The system shall export JSON, Markdown, etc.',
      good: 'Requirement: The system shall export JSON and Markdown.',
    },
    {
      ruleId: 'and-or',
      bad: 'Requirement: The system shall log and/or alert on failures.',
      good: 'Requirement: The system shall log failures.',
    },
    {
      ruleId: 'compound-requirement',
      bad: 'Requirement: The system shall log events and shall alert the owner.',
      good: WELL_FORMED,
    },
    {
      ruleId: 'tbd-marker',
      bad: 'Requirement: The system shall retain data for TBD days.',
      good: 'Requirement: The system shall retain data for 90 days.',
    },
    {
      ruleId: 'unbounded-timing',
      bad: 'Requirement: The system shall sync as soon as possible.',
      good: 'Requirement: The system shall sync within 5 seconds.',
    },
    {
      ruleId: 'optimization-verb',
      bad: 'Requirement: The system shall minimize latency.',
      good: 'Requirement: The system shall keep p95 latency under 200 ms.',
    },
  ]

  assert.deepEqual(
    cases.map((entry) => entry.ruleId).sort(),
    [...EARS_LINT_RULE_IDS].sort()
  )

  for (const entry of cases) {
    assert.ok(
      ruleIds(entry.bad).includes(entry.ruleId),
      `${entry.ruleId} should fire on: ${entry.bad}`
    )
    assert.ok(
      !ruleIds(entry.good).includes(entry.ruleId),
      `${entry.ruleId} should pass on: ${entry.good}`
    )
  }
})

test('EARS hint dismissal state round-trips through metadata normalization', () => {
  const dismissed = normalizeAreaMetadata({
    kind: 'requirement',
    tags: [],
    earsHintDismissed: true,
  })
  const notDismissed = normalizeAreaMetadata({
    kind: 'requirement',
    tags: [],
  })
  const falseValue = normalizeAreaMetadata({
    kind: 'requirement',
    tags: [],
    earsHintDismissed: false,
  })

  assert.equal(dismissed.earsHintDismissed, true)
  assert.equal(dismissed.kind, 'requirement')
  assert.equal('earsHintDismissed' in notDismissed, false)
  assert.equal('earsHintDismissed' in falseValue, false)
})
