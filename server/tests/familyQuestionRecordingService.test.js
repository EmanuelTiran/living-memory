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
  getFamilyQuestionAnswerPrompt:
    vi.fn(),
  startInterviewSession: vi.fn(),
  discardInterviewSession: vi.fn(),
  createRecording: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
      CONTRIBUTE: 'contribute',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/memories/familyQuestionService.js',
  () => ({
    getFamilyQuestionAnswerPrompt:
      mocks.getFamilyQuestionAnswerPrompt,
  }),
)

vi.mock(
  '../src/modules/memories/interviewSessionService.js',
  () => ({
    startInterviewSession:
      mocks.startInterviewSession,
    discardInterviewSession:
      mocks.discardInterviewSession,
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecording.js',
  async (importOriginal) => {
    const original =
      await importOriginal()

    return {
      ...original,
      default: {
        create:
          mocks.createRecording,
      },
    }
  },
)

const {
  createMemoryRecordingMetadata,
} = await import(
  '../src/modules/media/recordingService.js'
)

function createRecordingInput(
  familyQuestionId,
) {
  return {
    displayName:
      'תשובה לשאלה מהמשפחה',
    originalFileName:
      'family-answer.webm',
    mimeType: 'audio/webm',
    sizeBytes: 2048,
    durationMs: 31_000,
    languageCode: 'he',
    familyQuestionId,
    consent: {
      confirmed: true,
      basis: 'subject_consent',
      permittedUses: [
        'transcription',
        'memory_grounding',
        'recording_playback',
      ],
    },
  }
}

describe(
  'family question recording metadata',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mocks.requireMemoryPermission
        .mockResolvedValue({})
    })

    it(
      'stores a trusted family question snapshot after contribute permission',
      async () => {
        const memoryId =
          new mongoose.Types.ObjectId()
            .toString()
        const userId =
          new mongoose.Types.ObjectId()
            .toString()
        const questionId =
          new mongoose.Types.ObjectId()
            .toString()
        const questionText =
          'מה היה הרגע המצחיק ביותר בבית הספר?'
        const serializedRecording = {
          id:
            new mongoose.Types.ObjectId()
              .toString(),
        }

        mocks.getFamilyQuestionAnswerPrompt
          .mockResolvedValue({
            questionId,
            questionText,
          })
        mocks.createRecording
          .mockResolvedValue({
            toJSON() {
              return serializedRecording
            },
          })

        const result =
          await createMemoryRecordingMetadata(
            userId,
            memoryId,
            createRecordingInput(
              questionId,
            ),
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'contribute',
        )
        expect(
          mocks.getFamilyQuestionAnswerPrompt,
        ).toHaveBeenCalledWith(
          memoryId,
          questionId,
        )
        expect(
          mocks.createRecording,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            memoryId,
            uploadedByUserId: userId,
            familyQuestionContext: {
              questionId,
              questionText,
            },
          }),
        )
        expect(
          mocks.startInterviewSession,
        ).not.toHaveBeenCalled()
        expect(result).toBe(
          serializedRecording,
        )
      },
    )
  },
)
