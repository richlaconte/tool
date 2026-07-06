import type { AreaComment } from './areaComments.ts'
import { getAreaMetadata, type AreaStatus } from './areaMetadata.ts'
import type { AreaState } from './App'
import type { AgentPatch } from './agentInterface.ts'
import { areaTitle } from './sddExport.ts'

export const TASK_BOARD_COLUMNS = [
  {
    id: 'open',
    label: 'Todo',
  },
  {
    id: 'in-progress',
    label: 'Doing',
  },
  {
    id: 'done',
    label: 'Done',
  },
  {
    id: 'blocked',
    label: 'Blocked',
  },
] as const satisfies readonly {
  id: AreaStatus
  label: string
}[]

export type TaskBoardColumnId = (typeof TASK_BOARD_COLUMNS)[number]['id']

export type TaskBoardCard = {
  areaId: string
  title: string
  status: TaskBoardColumnId
  assignee?: {
    kind: 'agent' | 'human'
    name: string
  }
  unresolvedCommentCount: number
}

export type TaskBoardColumn = {
  id: TaskBoardColumnId
  label: string
  cards: TaskBoardCard[]
}

export type TaskBoardAttentionItem =
  | {
      kind: 'proposal'
      id: string
      label: string
    }
  | {
      kind: 'blocked-task'
      id: string
      areaId: string
      label: string
    }
  | {
      kind: 'comment-thread'
      id: string
      areaId: string
      label: string
      count: number
    }

export const buildTaskBoard = ({
  areas,
  comments = [],
}: {
  areas: AreaState[]
  comments?: AreaComment[]
}): TaskBoardColumn[] => {
  const columns = TASK_BOARD_COLUMNS.map((column) => ({
    ...column,
    cards: [] as TaskBoardCard[],
  }))
  const columnById = new Map(columns.map((column) => [column.id, column]))

  for (const area of areas) {
    const metadata = getAreaMetadata(area)

    if (metadata.kind !== 'task') continue

    const status = getTaskBoardStatus(metadata.status)
    const column = columnById.get(status)

    column?.cards.push({
      areaId: area.id,
      title: areaTitle(area),
      status,
      ...(metadata.assignee ? { assignee: metadata.assignee } : {}),
      unresolvedCommentCount: comments.filter(
        (comment) => comment.areaId === area.id && !comment.resolvedAt
      ).length,
    })
  }

  for (const column of columns) {
    column.cards.sort((first, second) =>
      first.title.localeCompare(second.title) ||
      first.areaId.localeCompare(second.areaId)
    )
  }

  return columns
}

export const buildNeedsAttentionQueue = ({
  agentProposal,
  areas,
  comments = [],
}: {
  agentProposal?: AgentPatch | null
  areas: AreaState[]
  comments?: AreaComment[]
}): TaskBoardAttentionItem[] => {
  const items: TaskBoardAttentionItem[] = []

  if (agentProposal && agentProposal.operations.length > 0) {
    items.push({
      kind: 'proposal',
      id: agentProposal.id,
      label: `${agentProposal.operations.length} agent proposal ${
        agentProposal.operations.length === 1 ? 'operation' : 'operations'
      } awaiting review`,
    })
  }

  for (const column of buildTaskBoard({ areas, comments })) {
    if (column.id !== 'blocked') continue

    for (const card of column.cards) {
      items.push({
        kind: 'blocked-task',
        id: `blocked-${card.areaId}`,
        areaId: card.areaId,
        label: card.title,
      })
    }
  }

  const titleByAreaId = new Map(
    areas.map((area) => [area.id, areaTitle(area)])
  )
  const unresolvedCounts = new Map<string, number>()

  for (const comment of comments) {
    if (comment.resolvedAt) continue

    unresolvedCounts.set(
      comment.areaId,
      (unresolvedCounts.get(comment.areaId) ?? 0) + 1
    )
  }

  for (const [areaId, count] of unresolvedCounts) {
    items.push({
      kind: 'comment-thread',
      id: `comments-${areaId}`,
      areaId,
      label: titleByAreaId.get(areaId) ?? areaId,
      count,
    })
  }

  return items
}

const getTaskBoardStatus = (
  status: AreaStatus | undefined
): TaskBoardColumnId => {
  if (
    status === 'in-progress' ||
    status === 'done' ||
    status === 'blocked'
  ) {
    return status
  }

  return 'open'
}
