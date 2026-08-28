import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/MemoryProfile.js',
  () => ({
    default: {
      findOne: mocks.findOne,
    },
  }),
)

import {
  listApprovedProfileSources,
} from '../src/modules/chat/approvedProfileSourceProvider.js'
import {
  buildChatContext,
} from '../src/modules/chat/chatContextService.js'

const memoryId =
  '507f1f77bcf86cd799439010'

function createProfileQuery(result) {
  const query = {
    select: vi.fn(),
    lean: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.lean.mockResolvedValue(result)

  return query
}

describe(
  'Approved profile source provider',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it(
      'exposes the stored subject name as versioned archive evidence',
      async () => {
        const updatedAt =
          new Date(
            '2026-08-23T12:00:00.000Z',
          )

        mocks.findOne.mockReturnValue(
          createProfileQuery({
            _id: memoryId,
            subjectName: 'אורה',
            updatedAt,
          }),
        )

        const result =
          await listApprovedProfileSources(
            memoryId,
          )

        expect(mocks.findOne)
          .toHaveBeenCalledWith({
            _id: memoryId,
            status: 'active',
          })

        expect(result).toEqual([
          {
            sourceType:
              'memory_profile',
            sourceId: memoryId,
            title:
              'שם האדם בפרופיל הארכיון',
            content:
              'שם האדם המתועד בארכיון הוא אורה.',
            approvedAt: null,
            sourceVersion:
              updatedAt.toISOString(),
            sourceRoute:
              `/app/memories/${memoryId}#memory-profile-title`,
          },
        ])
      },
    )

    it(
      'grounds a natural Hebrew name question in the profile source',
      async () => {
        const source = {
          sourceType:
            'memory_profile',
          sourceId: memoryId,
          title:
            'שם האדם בפרופיל הארכיון',
          content:
            'שם האדם המתועד בארכיון הוא אורה.',
          approvedAt: null,
          sourceVersion:
            '2026-08-23T12:00:00.000Z',
          sourceRoute:
            `/app/memories/${memoryId}#memory-profile-title`,
        }

        const provider = {
          listApprovedSources: vi
            .fn()
            .mockResolvedValue([
              source,
            ]),
        }

        const result =
          await buildChatContext(
            {
              memoryId,
              message:
                'איך קוראים לך?',
            },
            {
              sourceProviders: [
                provider,
              ],
            },
          )

        expect(result).toMatchObject({
          groundingStatus: 'grounded',
          sources: [source],
          fallbackResponse: null,
        })
      },
    )

    it(
      'returns no source for a missing or archived profile',
      async () => {
        mocks.findOne.mockReturnValue(
          createProfileQuery(null),
        )

        await expect(
          listApprovedProfileSources(
            memoryId,
          ),
        ).resolves.toEqual([])
      },
    )
  },
)
