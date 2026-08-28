import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  buildMemoryPilotProgress,
} from '../src/modules/memories/memoryPilotService.js'

const ownerUserId =
  '507f1f77bcf86cd799439010'
const storytellerUserId =
  '507f1f77bcf86cd799439011'

const enrollment = {
  _id: '507f1f77bcf86cd799439012',
  memoryId: '507f1f77bcf86cd799439013',
  ownerUserId,
  version: 'family-behavioral-pilot-v1',
  status: 'active',
  startedAt: new Date(
    '2026-08-01T00:00:00.000Z',
  ),
  endsAt: new Date(
    '2026-08-29T00:00:00.000Z',
  ),
  withdrawnAt: null,
}

describe('Memory pilot progress', () => {
  it('counts repeated storytelling and family questions in distinct weeks', () => {
    const progress =
      buildMemoryPilotProgress({
        enrollment,
        memberships: [
          {
            userId: storytellerUserId,
            role: 'contributor',
            status: 'active',
          },
        ],
        sessions: [
          {
            startedByUserId:
              storytellerUserId,
            completedAt: new Date(
              '2026-08-02T10:00:00.000Z',
            ),
          },
          {
            startedByUserId:
              storytellerUserId,
            completedAt: new Date(
              '2026-08-17T10:00:00.000Z',
            ),
          },
          {
            startedByUserId:
              storytellerUserId,
            completedAt: new Date(
              '2026-08-24T10:00:00.000Z',
            ),
          },
        ],
        stories: [],
        questions: [
          {
            askedByUserId: ownerUserId,
            createdAt: new Date(
              '2026-08-04T10:00:00.000Z',
            ),
          },
          {
            askedByUserId: ownerUserId,
            createdAt: new Date(
              '2026-08-18T10:00:00.000Z',
            ),
          },
          {
            askedByUserId:
              storytellerUserId,
            createdAt: new Date(
              '2026-08-11T10:00:00.000Z',
            ),
          },
        ],
        now: new Date(
          '2026-08-30T00:00:00.000Z',
        ),
      })

    expect(
      progress.progress.contributionWeeks,
    ).toEqual([1, 3, 4])
    expect(
      progress.progress.familyQuestionWeeks,
    ).toEqual([1, 3])
    expect(
      progress.progress
        .meaningfulInteractionCount,
    ).toBe(5)
    expect(
      progress.gates
        .threeContributionWeeks.met,
    ).toBe(true)
    expect(
      progress.gates
        .familyReturnByWeekTwo.met,
    ).toBe(true)
    expect(
      progress.gates
        .twoFamilyQuestionWeeks.met,
    ).toBe(true)
    expect(
      progress.gates.d30HouseholdActive.met,
    ).toBe(true)
    expect(
      progress.progress.coreLoopCompleted,
    ).toBe(true)
  })

  it('does not count the storyteller asking their own family question', () => {
    const progress =
      buildMemoryPilotProgress({
        enrollment,
        sessions: [],
        stories: [],
        questions: [
          {
            askedByUserId: ownerUserId,
            createdAt: new Date(
              '2026-08-03T10:00:00.000Z',
            ),
          },
        ],
        memberships: [],
        now: new Date(
          '2026-08-04T00:00:00.000Z',
        ),
      })

    expect(
      progress.progress.familyQuestionWeeks,
    ).toEqual([])
    expect(
      progress.gates
        .familyReturnByWeekTwo.eligible,
    ).toBe(false)
    expect(
      progress.enrollment.daysRemaining,
    ).toBe(25)
  })

  it('rejects invalid reporting timestamps', () => {
    expect(() =>
      buildMemoryPilotProgress({
        enrollment,
        now: new Date('invalid'),
      }),
    ).toThrow(
      'Pilot timestamp must be valid.',
    )
  })
})
