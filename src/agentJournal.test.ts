import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_EXPORTED_JOURNAL_ENTRIES,
  MAX_JOURNAL_ENTRIES,
  createJournalEntry,
  normalizeJournalEntries,
  pruneJournalEntries,
  sortJournalEntriesNewestFirst,
  type JournalEntry,
} from './agentJournal.ts'

const now = '2026-07-02T12:00:00.000Z'

test('creates validated journal entries and falls back invalid task Area ids to null', () => {
  const result = createJournalEntry({
    actorKind: 'agent',
    actorName: '  GLM Agent  ',
    createId: () => 'journal-1',
    knownAreaIds: ['area-1'],
    now,
    taskAreaId: 'missing-area',
    text: '  Running the failing tests.  ',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.ok ? result.entry : null, {
    id: 'journal-1',
    actor: {
      kind: 'agent',
      name: 'GLM Agent',
    },
    createdAt: now,
    taskAreaId: null,
    text: 'Running the failing tests.',
  })
  assert.match(result.ok ? result.warnings[0] : '', /missing-area/)
})

test('rejects blank and overlong journal entries', () => {
  assert.equal(
    createJournalEntry({
      actorKind: 'human',
      actorName: 'Riley',
      text: '   ',
    }).ok,
    false
  )
  assert.equal(
    createJournalEntry({
      actorKind: 'agent',
      actorName: 'GLM',
      text: 'x'.repeat(2001),
    }).ok,
    false
  )
})

test('normalizes, prunes, and sorts journal entries for storage and display', () => {
  const entries: JournalEntry[] = Array.from(
    { length: MAX_JOURNAL_ENTRIES + 2 },
    (_value, index) => ({
      id: `journal-${index}`,
      actor: {
        kind: index % 2 === 0 ? 'agent' : 'human',
        name: `Actor ${index}`,
      },
      createdAt: `2026-07-02T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
      taskAreaId: index === 0 ? 'area-1' : null,
      text: `Entry ${index}`,
    })
  )

  assert.equal(
    pruneJournalEntries(entries).length,
    MAX_JOURNAL_ENTRIES
  )
  assert.equal(pruneJournalEntries(entries)[0].id, 'journal-2')
  assert.equal(
    entries.slice(-MAX_EXPORTED_JOURNAL_ENTRIES).length,
    MAX_EXPORTED_JOURNAL_ENTRIES
  )
  assert.deepEqual(
    normalizeJournalEntries([
      entries[0],
      { id: 'bad' },
      { ...entries[1], actor: { name: 'Human', kind: 'human' } },
    ]).map((entry) => entry.id),
    ['journal-0', 'journal-1']
  )
  assert.deepEqual(
    sortJournalEntriesNewestFirst([
      { ...entries[0], id: 'a', createdAt: now },
      { ...entries[1], id: 'b', createdAt: now },
    ]).map((entry) => entry.id),
    ['b', 'a']
  )
})
