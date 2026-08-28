import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  memoryExists: vi.fn(),
  findStory: vi.fn(),
  updateStory: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/MemoryProfile.js',
  () => ({
    default: {
      exists:
        mocks.memoryExists,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryStory.js',
  () => ({
    default: {
      findOne:
        mocks.findStory,
      findOneAndUpdate:
        mocks.updateStory,
    },
  }),
)

import {
  updateMemoryStory,
} from '../src/modules/memories/memoryStoryService.js'

const userId =
  '507f1f77bcf86cd799439010'
const memoryId =
  '507f1f77bcf86cd799439011'
const storyId =
  '507f1f77bcf86cd799439012'

function createApprovedStory() {
  return {
    _id: storyId,
    memoryId,
    title: 'הבית הישן',
    content:
      'זהו התוכן המאושר של הסיפור הישן.',
    occurredOn: '1970-01-02',
    status: 'approved',
    approvedAt:
      new Date(
        '2026-08-23T08:00:00.000Z',
      ),
    approvedByUserId: userId,
    revision: 2,
  }
}

describe(
  'Memory story revision service',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mocks.memoryExists
        .mockResolvedValue(true)
    })

    it(
      'keeps the approved story in history and returns the edit to draft',
      async () => {
        const currentStory =
          createApprovedStory()
        const revisedStory = {
          ...currentStory,
          title:
            'הבית הישן בירושלים',
          status: 'draft',
          approvedAt: null,
          approvedByUserId: null,
          revision: 3,
          toJSON() {
            return {
              ...this,
              toJSON: undefined,
            }
          },
        }

        mocks.findStory
          .mockResolvedValue(
            currentStory,
          )
        mocks.updateStory
          .mockResolvedValue(
            revisedStory,
          )

        const result =
          await updateMemoryStory(
            userId,
            memoryId,
            storyId,
            {
              title:
                'הבית הישן בירושלים',
              content:
                currentStory.content,
              occurredOn:
                currentStory.occurredOn,
              expectedRevision: 2,
            },
          )

        expect(
          mocks.updateStory,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            _id: storyId,
            revision: 2,
          }),
          expect.objectContaining({
            $set:
              expect.objectContaining({
                title:
                  'הבית הישן בירושלים',
                status: 'draft',
                approvedAt: null,
                approvedByUserId:
                  null,
                revision: 3,
              }),
            $push: {
              revisionHistory:
                expect.objectContaining({
                  $slice: -20,
                  $each: [
                    expect.objectContaining({
                      revision: 2,
                      title:
                        'הבית הישן',
                      reviewStatus:
                        'approved',
                    }),
                  ],
                }),
            },
          }),
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )

        expect(result).toMatchObject({
          title:
            'הבית הישן בירושלים',
          status: 'draft',
          revision: 3,
        })
      },
    )

    it(
      'rejects a stale editor revision before changing the story',
      async () => {
        mocks.findStory
          .mockResolvedValue(
            createApprovedStory(),
          )

        await expect(
          updateMemoryStory(
            userId,
            memoryId,
            storyId,
            {
              title:
                'כותרת מעודכנת',
              expectedRevision: 1,
            },
          ),
        ).rejects.toMatchObject({
          code:
            'STORY_REVISION_CONFLICT',
        })

        expect(
          mocks.updateStory,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
