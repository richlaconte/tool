export type JournalActorKind = 'agent' | 'human'

export type JournalActor = {
  name: string
  kind: JournalActorKind
}

export type JournalEntry = {
  id: string
  actor: JournalActor
  text: string
  createdAt: string
  taskAreaId: string | null
}

export const MAX_JOURNAL_TEXT_LENGTH = 2000
export const MAX_JOURNAL_ENTRIES = 500
export const MAX_EXPORTED_JOURNAL_ENTRIES = 100

export type CreateJournalEntryInput = {
  text: string
  actorName: string
  actorKind: JournalActorKind
  taskAreaId?: string | null
  knownAreaIds?: ReadonlySet<string> | string[]
  createId?: () => string
  now?: string
}

export type CreateJournalEntryResult =
  | { ok: true; entry: JournalEntry; warnings: string[] }
  | { ok: false; error: string }

export const createJournalEntry = ({
  text,
  actorName,
  actorKind,
  taskAreaId = null,
  knownAreaIds,
  createId = createDefaultJournalId,
  now = new Date().toISOString(),
}: CreateJournalEntryInput): CreateJournalEntryResult => {
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return { ok: false, error: 'Journal entry text is required.' }
  }

  if (trimmed.length > MAX_JOURNAL_TEXT_LENGTH) {
    return {
      ok: false,
      error: `Journal entry exceeds ${MAX_JOURNAL_TEXT_LENGTH} characters.`,
    }
  }

  const warnings: string[] = []
  const areaIdSet =
    knownAreaIds instanceof Set
      ? knownAreaIds
      : knownAreaIds
        ? new Set(knownAreaIds)
        : null

  let resolvedTaskAreaId = taskAreaId ?? null

  if (
    resolvedTaskAreaId &&
    areaIdSet &&
    !areaIdSet.has(resolvedTaskAreaId)
  ) {
    warnings.push(
      `Task Area ${resolvedTaskAreaId} was not found; the entry was recorded without a link.`
    )
    resolvedTaskAreaId = null
  }

  const actorNameTrimmed = actorName.trim().slice(0, 120) || 'Unknown'

  return {
    ok: true,
    warnings,
    entry: {
      id: createId(),
      actor: { name: actorNameTrimmed, kind: actorKind },
      text: trimmed,
      createdAt: now,
      taskAreaId: resolvedTaskAreaId,
    },
  }
}

// Appends stay bounded by dropping the oldest entries once the log is full.
export const pruneJournalEntries = (
  entries: JournalEntry[],
  limit = MAX_JOURNAL_ENTRIES
) => (entries.length <= limit ? entries : entries.slice(entries.length - limit))

export const normalizeJournalEntry = (
  value: unknown
): JournalEntry | null => {
  if (typeof value !== 'object' || value === null) return null

  const record = value as Record<string, unknown>
  const actor =
    typeof record.actor === 'object' && record.actor !== null
      ? (record.actor as Record<string, unknown>)
      : {}

  if (
    typeof record.id !== 'string' ||
    typeof record.text !== 'string' ||
    typeof record.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    actor: {
      name: typeof actor.name === 'string' ? actor.name : 'Unknown',
      kind: actor.kind === 'human' ? 'human' : 'agent',
    },
    text: record.text,
    createdAt: record.createdAt,
    taskAreaId:
      typeof record.taskAreaId === 'string' ? record.taskAreaId : null,
  }
}

export const normalizeJournalEntries = (
  value: unknown
): JournalEntry[] => {
  if (!Array.isArray(value)) return []

  return value
    .map(normalizeJournalEntry)
    .filter((entry): entry is JournalEntry => entry !== null)
}

// Newest-first for panel display; the stored array stays oldest-first.
export const sortJournalEntriesNewestFirst = (
  entries: JournalEntry[]
) =>
  [...entries].sort(
    (first, second) =>
      second.createdAt.localeCompare(first.createdAt) ||
      second.id.localeCompare(first.id)
  )

const createDefaultJournalId = () =>
  `journal_${
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`
