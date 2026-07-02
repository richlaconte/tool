export const AREA_COMMENT_MAX_LENGTH = 2000

export type AreaComment = {
  id: string
  areaId: string
  authorName: string
  authorColor: string
  text: string
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

export type AreaCommentProfile = {
  userName: string
  color: string
}

export type AreaCommentTextValidation =
  | {
      ok: true
      text: string
    }
  | {
      ok: false
      error: string
    }

export const validateAreaCommentText = (
  text: string
): AreaCommentTextValidation => {
  const trimmedText = text.trim()

  if (!trimmedText) {
    return {
      ok: false,
      error: 'Comment cannot be empty.',
    }
  }

  if (trimmedText.length > AREA_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Comment must be ${AREA_COMMENT_MAX_LENGTH} characters or fewer.`,
    }
  }

  return {
    ok: true,
    text: trimmedText,
  }
}

export const createAreaComment = ({
  areaId,
  createId = createDefaultCommentId,
  now = () => new Date().toISOString(),
  profile,
  text,
}: {
  areaId: string
  createId?: () => string
  now?: () => string
  profile: AreaCommentProfile
  text: string
}): AreaComment => {
  const validation = validateAreaCommentText(text)

  if (!validation.ok) {
    throw new Error(validation.error)
  }

  return {
    id: createId(),
    areaId,
    authorName: profile.userName,
    authorColor: profile.color,
    text: validation.text,
    createdAt: now(),
    resolvedAt: null,
    resolvedBy: null,
  }
}

export const getAreaThread = (
  comments: AreaComment[] | undefined,
  areaId: string
) =>
  [...(comments ?? [])]
    .filter((comment) => comment.areaId === areaId)
    .sort(compareAreaComments)

export const getUnresolvedCount = (
  comments: AreaComment[] | undefined,
  areaId: string
) =>
  (comments ?? []).filter(
    (comment) => comment.areaId === areaId && !comment.resolvedAt
  ).length

export const resolveAreaComment = (
  comments: AreaComment[],
  commentId: string,
  {
    now = () => new Date().toISOString(),
    profile,
  }: {
    now?: () => string
    profile: AreaCommentProfile
  }
) =>
  comments.map((comment) =>
    comment.id === commentId
      ? {
          ...comment,
          resolvedAt: now(),
          resolvedBy: profile.userName,
        }
      : comment
  )

export const reopenAreaComment = (
  comments: AreaComment[],
  commentId: string
) =>
  comments.map((comment) =>
    comment.id === commentId
      ? {
          ...comment,
          resolvedAt: null,
          resolvedBy: null,
        }
      : comment
  )

export const deleteAreaComment = (
  comments: AreaComment[],
  commentId: string
) => comments.filter((comment) => comment.id !== commentId)

export const getOrphanedComments = (
  comments: AreaComment[] | undefined,
  areas: Array<{ id: string }>
) => {
  const areaIds = new Set(areas.map((area) => area.id))

  return (comments ?? []).filter((comment) => !areaIds.has(comment.areaId))
}

export const compareAreaComments = (
  first: AreaComment,
  second: AreaComment
) =>
  first.createdAt.localeCompare(second.createdAt) ||
  first.id.localeCompare(second.id)

const createDefaultCommentId = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `comment_${crypto.randomUUID()}`
  }

  return `comment_${Date.now()}`
}
