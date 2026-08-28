import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  createStoryRevisionSnapshot,
  createTranscriptRevisionSnapshot,
  MAX_SOURCE_REVISION_HISTORY,
} from '../src/modules/memories/sourceRevisionHistory.js'

const changedByUserId =
  '507f1f77bcf86cd799439011'
const changedAt =
  new Date(
    '2026-08-24T08:00:00.000Z',
  )

describe('Source revision history', () => {
  it(
    'preserves an approved written story before editing',
    () => {
      const approvedAt =
        new Date(
          '2026-08-23T08:00:00.000Z',
        )

      const snapshot =
        createStoryRevisionSnapshot(
          {
            revision: 3,
            title: 'המעבר לירושלים',
            content:
              'המשפחה עברה בקיץ.',
            occurredOn:
              '1978-06-01',
            status: 'approved',
            approvedAt,
            approvedByUserId:
              changedByUserId,
          },
          changedByUserId,
          changedAt,
        )

      expect(snapshot).toEqual({
        revision: 3,
        title: 'המעבר לירושלים',
        content:
          'המשפחה עברה בקיץ.',
        occurredOn: '1978-06-01',
        reviewStatus: 'approved',
        approvedAt,
        approvedByUserId:
          changedByUserId,
        changedAt,
        changedByUserId,
      })
    },
  )

  it(
    'preserves transcript approval provenance before editing',
    () => {
      const snapshot =
        createTranscriptRevisionSnapshot(
          {
            revision: 2,
            content:
              'זהו התמלול המאושר.',
            reviewStatus:
              'approved',
            approvedAt:
              changedAt,
            approvedByUserId:
              changedByUserId,
          },
          changedByUserId,
          changedAt,
        )

      expect(snapshot).toMatchObject({
        revision: 2,
        content:
          'זהו התמלול המאושר.',
        reviewStatus: 'approved',
        approvedAt: changedAt,
        approvedByUserId:
          changedByUserId,
        changedAt,
        changedByUserId,
      })
    },
  )

  it(
    'uses safe defaults for legacy sources without a revision field',
    () => {
      expect(
        createStoryRevisionSnapshot(
          {
            title: 'סיפור ישן',
            content:
              'תוכן שנשמר לפני התמיכה בגרסאות.',
            status: 'draft',
          },
          changedByUserId,
          changedAt,
        ),
      ).toMatchObject({
        revision: 1,
        occurredOn: '',
        reviewStatus: 'draft',
      })
    },
  )

  it(
    'keeps a bounded history limit below MongoDB document growth risks',
    () => {
      expect(
        MAX_SOURCE_REVISION_HISTORY,
      ).toBe(20)
    },
  )
})
