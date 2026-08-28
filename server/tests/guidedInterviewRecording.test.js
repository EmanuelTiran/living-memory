import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import InterviewSession from '../src/modules/memories/InterviewSession.js'
import { createMemoryRecordingSchema } from '../src/modules/media/recordingValidation.js'

function createRecordingInput(
  overrides = {},
) {
  return {
    displayName:
      'תשובה על בית הילדות',
    originalFileName:
      'guided-childhood.webm',
    mimeType: 'audio/webm',
    sizeBytes: 2048,
    languageCode: 'he',
    consent: {
      confirmed: true,
      basis: 'subject_consent',
      permittedUses: [
        'transcription',
        'memory_grounding',
      ],
    },
    ...overrides,
  }
}

describe(
  'guided interview recording validation',
  () => {
    it(
      'accepts a trusted prompt key and duration',
      () => {
        const result =
          createMemoryRecordingSchema.parse(
            createRecordingInput({
              durationMs: 42_000,
              interviewPrompt: {
                questionKey:
                  'childhood_environment',
              },
            }),
          )

        expect(result.durationMs).toBe(
          42_000,
        )
        expect(
          result.interviewPrompt,
        ).toEqual({
          questionKey:
            'childhood_environment',
        })
      },
    )

    it(
      'keeps legacy recording metadata backward compatible',
      () => {
        const result =
          createMemoryRecordingSchema.parse(
            createRecordingInput(),
          )

        expect(result.durationMs).toBeUndefined()
        expect(
          result.interviewPrompt,
        ).toBeUndefined()
      },
    )

    it(
      'accepts a family question as the recording prompt source',
      () => {
        const familyQuestionId =
          new mongoose.Types.ObjectId()
            .toString()

        const result =
          createMemoryRecordingSchema.parse(
            createRecordingInput({
              familyQuestionId,
            }),
          )

        expect(
          result.familyQuestionId,
        ).toBe(familyQuestionId)
      },
    )

    it(
      'rejects two prompt sources on one recording',
      () => {
        expect(() =>
          createMemoryRecordingSchema.parse(
            createRecordingInput({
              familyQuestionId:
                new mongoose.Types.ObjectId()
                  .toString(),
              interviewPrompt: {
                questionKey:
                  'childhood_environment',
              },
            }),
          ),
        ).toThrow()
      },
    )

    it(
      'rejects an unsafe interview prompt key',
      () => {
        expect(() =>
          createMemoryRecordingSchema.parse(
            createRecordingInput({
              interviewPrompt: {
                questionKey:
                  '../another-memory',
              },
            }),
          ),
        ).toThrow()
      },
    )
  },
)

describe('InterviewSession', () => {
  function createSession(
    overrides = {},
  ) {
    return new InterviewSession({
      memoryId:
        new mongoose.Types.ObjectId(),
      startedByUserId:
        new mongoose.Types.ObjectId(),
      promptSnapshot: {
        key: 'childhood_environment',
        category: 'background',
        question:
          'באיזו סביבה עברו רוב שנות הילדות?',
      },
      ...overrides,
    })
  }

  it(
    'validates an active session without a completion timestamp',
    async () => {
      const session = createSession()

      await expect(
        session.validate(),
      ).resolves.toBeUndefined()
    },
  )

  it(
    'requires a completion timestamp for a completed session',
    async () => {
      const session = createSession({
        status: 'completed',
      })

      await expect(
        session.validate(),
      ).rejects.toMatchObject({
        errors: {
          completedAt: expect.anything(),
        },
      })
    },
  )
})
