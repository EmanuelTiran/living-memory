import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  invitationCount: vi.fn(),
  invitationDistinct: vi.fn(),
  consentCount: vi.fn(),
  sessionAggregate: vi.fn(),
  questionDistinct: vi.fn(),
  getBehavioralPilotOverview: vi.fn(),
}))

vi.mock(
  '../src/modules/admin/behavioralPilotOverviewService.js',
  () => ({
    getBehavioralPilotOverview:
      mocks.getBehavioralPilotOverview,
  }),
)

vi.mock(
  '../src/modules/memories/MemoryInvitation.js',
  () => ({
    default: {
      countDocuments:
        mocks.invitationCount,
      distinct:
        mocks.invitationDistinct,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryParticipationConsent.js',
  () => ({
    default: {
      countDocuments: mocks.consentCount,
    },
  }),
)

vi.mock(
  '../src/modules/memories/InterviewSession.js',
  () => ({
    default: {
      aggregate: mocks.sessionAggregate,
    },
  }),
)

vi.mock(
  '../src/modules/memories/FamilyQuestion.js',
  () => ({
    default: {
      distinct: mocks.questionDistinct,
    },
  }),
)

import { getPilotOverview } from '../src/modules/admin/pilotOverviewService.js'

describe('Pilot overview service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.invitationCount
      .mockImplementation((query) => {
        if (Object.keys(query).length === 0) {
          return 10
        }

        if (
          query.status === 'pending' &&
          query.expiresAt?.$gt
        ) {
          return 2
        }

        if (
          query.status === 'pending' &&
          query.expiresAt?.$lte
        ) {
          return 1
        }

        return {
          accepted: 6,
          revoked: 1,
          expired: 0,
        }[query.status] ?? 0
      })

    mocks.consentCount.mockResolvedValue(6)
    mocks.invitationDistinct
      .mockImplementation(
        (_field, query) =>
          query.role
            ? ['memory-1', 'memory-2', 'memory-3']
            : [
                'memory-1',
                'memory-2',
                'memory-3',
                'memory-4',
              ],
      )
    mocks.sessionAggregate
      .mockResolvedValue([
        {
          _id: 'memory-1',
          sessionCount: 1,
        },
        {
          _id: 'memory-2',
          sessionCount: 3,
        },
        {
          _id: 'memory-3',
          sessionCount: 4,
        },
      ])
    mocks.questionDistinct
      .mockResolvedValue([
        'memory-1',
        'memory-4',
      ])
    mocks.getBehavioralPilotOverview
      .mockResolvedValue({
        cohort: {
          enrolled: 2,
        },
      })
  })

  it('returns the research pilot funnel without private content', async () => {
    const pilot = await getPilotOverview(
      new Date('2026-08-25T10:00:00.000Z'),
    )

    expect(pilot.invitations).toEqual({
      sent: 10,
      pending: 2,
      accepted: 6,
      revoked: 1,
      expired: 1,
      acceptanceRatePercent: 60,
    })
    expect(pilot.consent).toEqual({
      completed: 6,
      completionRatePercent: 100,
    })
    expect(pilot.capture).toEqual({
      acceptedStorytellerMemories: 3,
      firstStoryMemories: 3,
      threeSessionMemories: 2,
      firstStoryCompletionRatePercent: 100,
      threeSessionRatePercent: 66.7,
    })
    expect(pilot.familyLoop).toEqual({
      acceptedMemories: 4,
      memoriesWithFamilyQuestions: 2,
      returnRatePercent: 50,
    })
    expect(pilot.privacy).toEqual({
      containsPrivateContent: false,
      scope:
        'aggregate_pilot_metadata_only',
    })
    expect(pilot.behavioral).toEqual({
      cohort: {
        enrolled: 2,
      },
    })
  })

  it('rejects an invalid reporting timestamp', async () => {
    await expect(
      getPilotOverview(new Date('invalid')),
    ).rejects.toThrow(
      'Pilot overview timestamp must be valid.',
    )
  })
})
