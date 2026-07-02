import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AREA_COMMENT_MAX_LENGTH,
  createAreaComment,
  deleteAreaComment,
  getAreaThread,
  getOrphanedComments,
  getUnresolvedCount,
  reopenAreaComment,
  resolveAreaComment,
  validateAreaCommentText,
} from './areaComments.ts'

const now = '2026-07-02T12:00:00.000Z'
const profile = {
  userName: 'Riley Reviewer',
  color: '#2563eb',
}

const comments = [
  {
    id: 'comment-2',
    areaId: 'area-1',
    authorName: 'A',
    authorColor: '#111111',
    text: 'Second',
    createdAt: '2026-07-02T12:02:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
  },
  {
    id: 'comment-1',
    areaId: 'area-1',
    authorName: 'B',
    authorColor: '#222222',
    text: 'First',
    createdAt: '2026-07-02T12:01:00.000Z',
    resolvedAt: '2026-07-02T12:03:00.000Z',
    resolvedBy: 'Riley Reviewer',
  },
  {
    id: 'comment-3',
    areaId: 'area-2',
    authorName: 'C',
    authorColor: '#333333',
    text: 'Other',
    createdAt: '2026-07-02T12:04:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
  },
]

test('creates trimmed comments with author profile and stable metadata', () => {
  assert.deepEqual(
    createAreaComment({
      areaId: 'area-1',
      createId: () => 'comment-1',
      now: () => now,
      profile,
      text: '  Looks risky.  ',
    }),
    {
      id: 'comment-1',
      areaId: 'area-1',
      authorName: 'Riley Reviewer',
      authorColor: '#2563eb',
      text: 'Looks risky.',
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
    }
  )
})

test('validates empty and too-long comment text', () => {
  assert.deepEqual(validateAreaCommentText('  '), {
    ok: false,
    error: 'Comment cannot be empty.',
  })
  assert.deepEqual(
    validateAreaCommentText('a'.repeat(AREA_COMMENT_MAX_LENGTH + 1)),
    {
      ok: false,
      error: `Comment must be ${AREA_COMMENT_MAX_LENGTH} characters or fewer.`,
    }
  )
  assert.deepEqual(validateAreaCommentText(' useful context '), {
    ok: true,
    text: 'useful context',
  })
})

test('threads are ordered oldest-first and unresolved counts ignore resolved comments', () => {
  assert.deepEqual(
    getAreaThread(comments, 'area-1').map((comment) => comment.id),
    ['comment-1', 'comment-2']
  )
  assert.equal(getUnresolvedCount(comments, 'area-1'), 1)
  assert.equal(getUnresolvedCount(comments, 'area-2'), 1)
})

test('resolve, reopen, and delete update comments immutably', () => {
  const resolved = resolveAreaComment(comments, 'comment-3', {
    now: () => now,
    profile,
  })

  assert.equal(comments[2].resolvedAt, null)
  assert.equal(resolved[2].resolvedAt, now)
  assert.equal(resolved[2].resolvedBy, 'Riley Reviewer')

  const reopened = reopenAreaComment(resolved, 'comment-3')
  assert.equal(reopened[2].resolvedAt, null)
  assert.equal(reopened[2].resolvedBy, null)

  assert.deepEqual(
    deleteAreaComment(reopened, 'comment-3').map((comment) => comment.id),
    ['comment-2', 'comment-1']
  )
})

test('orphaned comments remain discoverable after their area is gone', () => {
  assert.deepEqual(
    getOrphanedComments(comments, [{ id: 'area-1' }]).map(
      (comment) => comment.id
    ),
    ['comment-3']
  )
})
