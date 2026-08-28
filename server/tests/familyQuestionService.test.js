import mongoose from 'mongoose'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
      CHAT: 'chat',
      CONTRIBUTE: 'contribute',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/memories/FamilyQuestion.js',
  () => ({
    default: {
      create: mocks.create,
      find: mocks.find,
      findOne: mocks.findOne,
    },
  }),
)

const {
  createFamilyQuestion,
  getFamilyQuestionAnswerPrompt,
  listFamilyQuestions,
} = await import(
  '../src/modules/memories/familyQuestionService.js'
)

function createQuestionDocument({
  memoryId,
  askedByUserId,
  question =
    'מה את זוכרת מהבית שבו גדלת?',
} = {}) {
  const questionId =
    new mongoose.Types.ObjectId()
  const createdAt =
    new Date('2026-08-23T09:00:00.000Z')

  return {
    _id: questionId,
    memoryId,
    askedByUserId,
    question,
    status: 'active',
    createdAt,
    toJSON() {
      return {
        id: questionId.toString(),
        memoryId:
          memoryId.toString(),
        question,
        status: 'active',
        createdAt,
      }
    },
  }
}

describe('family question service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireMemoryPermission
      .mockResolvedValue({})
  })

  it(
    'lets a member with chat permission add a family question',
    async () => {
      const memoryId =
        new mongoose.Types.ObjectId()
          .toString()
      const userId =
        new mongoose.Types.ObjectId()
          .toString()
      const question =
        'מי היה החבר הכי טוב שלך בילדות?'
      const document =
        createQuestionDocument({
          memoryId:
            new mongoose.Types.ObjectId(
              memoryId,
            ),
          askedByUserId:
            new mongoose.Types.ObjectId(
              userId,
            ),
          question,
        })

      mocks.create.mockResolvedValue(
        document,
      )

      const result =
        await createFamilyQuestion(
          userId,
          memoryId,
          {
            question:
              `  ${question}  `,
          },
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'chat',
      )
      expect(
        mocks.create,
      ).toHaveBeenCalledWith({
        memoryId,
        askedByUserId: userId,
        question,
      })
      expect(result).toMatchObject({
        id: document._id.toString(),
        question,
        askedByCurrentUser: true,
      })
      expect(result).not.toHaveProperty(
        'askedByUserId',
      )
    },
  )

  it(
    'lists only active questions after view permission is checked',
    async () => {
      const memoryId =
        new mongoose.Types.ObjectId()
          .toString()
      const userId =
        new mongoose.Types.ObjectId()
          .toString()
      const otherUserId =
        new mongoose.Types.ObjectId()
      const document =
        createQuestionDocument({
          memoryId:
            new mongoose.Types.ObjectId(
              memoryId,
            ),
          askedByUserId: otherUserId,
        })
      const limit = vi
        .fn()
        .mockResolvedValue([document])
      const sort = vi
        .fn()
        .mockReturnValue({ limit })

      mocks.find.mockReturnValue({
        sort,
      })

      const result =
        await listFamilyQuestions(
          userId,
          memoryId,
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'view',
      )
      expect(
        mocks.find,
      ).toHaveBeenCalledWith({
        memoryId,
        status: 'active',
      })
      expect(sort).toHaveBeenCalledWith({
        createdAt: -1,
        _id: -1,
      })
      expect(limit).toHaveBeenCalledWith(
        100,
      )
      expect(result[0]).toMatchObject({
        askedByCurrentUser: false,
      })
    },
  )

  it(
    'stops before reading questions when memory access is denied',
    async () => {
      const memoryId =
        new mongoose.Types.ObjectId()
          .toString()
      const userId =
        new mongoose.Types.ObjectId()
          .toString()
      const accessError = new Error(
        'memory access denied',
      )

      mocks.requireMemoryPermission
        .mockRejectedValue(accessError)

      await expect(
        listFamilyQuestions(
          userId,
          memoryId,
        ),
      ).rejects.toBe(accessError)

      expect(
        mocks.find,
      ).not.toHaveBeenCalled()
    },
  )

  it(
    'returns a trusted prompt snapshot from the same memory',
    async () => {
      const memoryId =
        new mongoose.Types.ObjectId()
          .toString()
      const askedByUserId =
        new mongoose.Types.ObjectId()
      const document =
        createQuestionDocument({
          memoryId:
            new mongoose.Types.ObjectId(
              memoryId,
            ),
          askedByUserId,
        })

      mocks.findOne.mockResolvedValue(
        document,
      )

      const result =
        await getFamilyQuestionAnswerPrompt(
          memoryId,
          document._id.toString(),
        )

      expect(
        mocks.findOne,
      ).toHaveBeenCalledWith({
        _id: document._id.toString(),
        memoryId,
        status: 'active',
      })
      expect(result).toEqual({
        questionId:
          document._id.toString(),
        questionText:
          document.question,
      })
    },
  )
})
