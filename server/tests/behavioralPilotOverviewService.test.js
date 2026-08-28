import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  enrollmentFind: vi.fn(),
  sessionFind: vi.fn(),
  storyFind: vi.fn(),
  questionFind: vi.fn(),
  membershipFind: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/MemoryPilotEnrollment.js',
  () => ({
    default: {
      find: mocks.enrollmentFind,
    },
  }),
)

vi.mock(
  '../src/modules/memories/InterviewSession.js',
  () => ({
    default: {
      find: mocks.sessionFind,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryStory.js',
  () => ({
    default: {
      find: mocks.storyFind,
    },
  }),
)

vi.mock(
  '../src/modules/memories/FamilyQuestion.js',
  () => ({
    default: {
      find: mocks.questionFind,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryMembership.js',
  () => ({
    default: {
      find: mocks.membershipFind,
    },
  }),
)

import { getBehavioralPilotOverview } from '../src/modules/admin/behavioralPilotOverviewService.js'

function leanResult(value) {
  return {
    lean: vi.fn().mockResolvedValue(value),
  }
}

function selectedResult(value) {
  return {
    select: vi.fn(
      () => leanResult(value),
    ),
  }
}

const memoryOne =
  '507f1f77bcf86cd799439010'
const memoryTwo =
  '507f1f77bcf86cd799439011'
const ownerOne =
  '507f1f77bcf86cd799439012'
const ownerTwo =
  '507f1f77bcf86cd799439013'
const storyteller =
  '507f1f77bcf86cd799439014'

describe('Behavioral pilot overview service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.enrollmentFind.mockReturnValue(
      leanResult([
        {
          _id: '507f1f77bcf86cd799439015',
          memoryId: memoryOne,
          ownerUserId: ownerOne,
          version:
            'family-behavioral-pilot-v1',
          status: 'active',
          startedAt: new Date(
            '2026-08-01T00:00:00.000Z',
          ),
          endsAt: new Date(
            '2026-08-29T00:00:00.000Z',
          ),
        },
        {
          _id: '507f1f77bcf86cd799439016',
          memoryId: memoryTwo,
          ownerUserId: ownerTwo,
          version:
            'family-behavioral-pilot-v1',
          status: 'active',
          startedAt: new Date(
            '2026-08-15T00:00:00.000Z',
          ),
          endsAt: new Date(
            '2026-09-12T00:00:00.000Z',
          ),
        },
      ]),
    )
    mocks.sessionFind.mockReturnValue(
      selectedResult([
        {
          memoryId: memoryOne,
          startedByUserId: storyteller,
          completedAt: new Date(
            '2026-08-02T10:00:00.000Z',
          ),
        },
        {
          memoryId: memoryOne,
          startedByUserId: storyteller,
          completedAt: new Date(
            '2026-08-16T10:00:00.000Z',
          ),
        },
        {
          memoryId: memoryOne,
          startedByUserId: storyteller,
          completedAt: new Date(
            '2026-08-24T10:00:00.000Z',
          ),
        },
      ]),
    )
    mocks.storyFind.mockReturnValue(
      selectedResult([]),
    )
    mocks.questionFind.mockReturnValue(
      selectedResult([
        {
          memoryId: memoryOne,
          askedByUserId: ownerOne,
          createdAt: new Date(
            '2026-08-04T10:00:00.000Z',
          ),
        },
        {
          memoryId: memoryOne,
          askedByUserId: ownerOne,
          createdAt: new Date(
            '2026-08-18T10:00:00.000Z',
          ),
        },
      ]),
    )
    mocks.membershipFind.mockReturnValue(
      selectedResult([
        {
          memoryId: memoryOne,
          userId: storyteller,
          role: 'contributor',
          status: 'active',
        },
      ]),
    )
  })

  it('reports only eligible cohort rates and meaningful interactions', async () => {
    const overview =
      await getBehavioralPilotOverview(
        new Date(
          '2026-08-29T00:00:00.000Z',
        ),
      )

    expect(overview.cohort).toEqual({
      enrolled: 2,
      active: 1,
      completed: 1,
      withdrawn: 0,
    })
    expect(overview.northStar).toEqual({
      meaningfulFamilyInteractions: 5,
      averagePerParticipatingMemory: 2.5,
    })
    expect(
      overview.gates
        .threeContributionWeeks,
    ).toEqual({
      eligible: 1,
      met: 1,
      ratePercent: 100,
      targetPercent: 50,
    })
    expect(
      overview.gates
        .familyReturnByWeekTwo,
    ).toEqual({
      eligible: 2,
      met: 1,
      ratePercent: 50,
      targetPercent: 50,
    })
    expect(overview.coreLoop).toEqual({
      eligible: 1,
      completed: 1,
      completionRatePercent: 100,
    })
    expect(overview.privacy).toEqual({
      containsPrivateContent: false,
      scope:
        'aggregate_behavioral_pilot_metadata_only',
    })
  })

  it('returns an empty cohort without querying behavior collections', async () => {
    mocks.enrollmentFind.mockReturnValue(
      leanResult([]),
    )

    const overview =
      await getBehavioralPilotOverview(
        new Date(
          '2026-08-29T00:00:00.000Z',
        ),
      )

    expect(overview.cohort.enrolled).toBe(0)
    expect(
      overview.gates
        .d30HouseholdActive.ratePercent,
    ).toBe(null)
    expect(mocks.sessionFind)
      .not.toHaveBeenCalled()
  })
})
