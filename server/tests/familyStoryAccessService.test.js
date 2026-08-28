import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => {
  const stories = [
    {
      toJSON: () => ({
        id: '507f1f77bcf86cd799439012',
        title: 'סיפור משפחתי',
      }),
    },
  ]
  const sort = vi.fn().mockResolvedValue(
    stories,
  )

  return {
    requireMemoryPermission: vi.fn(),
    storyCreate: vi.fn(),
    storyFind: vi.fn(() => ({ sort })),
    storyFindOneAndUpdate: vi.fn(),
    sort,
  }
})

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
      CHAT: 'chat',
      CONTRIBUTE: 'contribute',
      EDIT: 'edit',
      MANAGE: 'manage',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/memories/MemoryStory.js',
  () => ({
    default: {
      create: mocks.storyCreate,
      find: mocks.storyFind,
      findOneAndUpdate:
        mocks.storyFindOneAndUpdate,
    },
  }),
)

import {
  createAccessibleMemoryStory,
  listAccessibleMemoryStories,
  updateAccessibleMemoryStory,
} from '../src/modules/memories/familyStoryAccessService.js'

const userId = '507f1f77bcf86cd799439010'
const memoryId = '507f1f77bcf86cd799439011'
const storyId = '507f1f77bcf86cd799439012'

describe('Family story access service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireMemoryPermission
      .mockResolvedValue({
        authorization: {
          role: 'owner',
        },
      })
  })

  it('uses view permission when listing family stories', async () => {
    const stories =
      await listAccessibleMemoryStories(
        userId,
        memoryId,
      )

    expect(mocks.requireMemoryPermission)
      .toHaveBeenCalledWith(
        userId,
        memoryId,
        'view',
      )
    expect(mocks.storyFind)
      .toHaveBeenCalledWith({
        memoryId,
        status: {
          $in: ['draft', 'approved'],
        },
      })
    expect(stories).toEqual([
      {
        id: storyId,
        title: 'סיפור משפחתי',
      },
    ])
  })

  it('uses contribution permission for a new story', async () => {
    mocks.storyCreate.mockResolvedValue({
      toJSON: () => ({
        id: storyId,
        status: 'draft',
      }),
    })

    await createAccessibleMemoryStory(
      userId,
      memoryId,
      {
        title: 'הבית הראשון',
        content:
          'זהו סיפור משפחתי מלא ומאושר לבדיקה.',
      },
    )

    expect(mocks.requireMemoryPermission)
      .toHaveBeenCalledWith(
        userId,
        memoryId,
        'contribute',
      )
    expect(mocks.storyCreate)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId,
          authorId: userId,
        }),
      )
  })

  it('stops story editing when edit permission is denied', async () => {
    mocks.requireMemoryPermission
      .mockRejectedValue(
        new AppError(
          'Memory profile was not found.',
          {
            statusCode: 404,
            code: 'MEMORY_NOT_FOUND',
          },
        ),
      )

    await expect(
      updateAccessibleMemoryStory(
        userId,
        memoryId,
        storyId,
        {
          title: 'כותרת חדשה',
        },
      ),
    ).rejects.toMatchObject({
      code: 'MEMORY_NOT_FOUND',
    })

    expect(mocks.storyFindOneAndUpdate)
      .not.toHaveBeenCalled()
  })
})
