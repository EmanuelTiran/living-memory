import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  transcribeMemoryRecording:
    vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/media/recordingTranscriptionService.js',
  () => ({
    transcribeMemoryRecording:
      mocks.transcribeMemoryRecording,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const recordingId =
  '507f1f77bcf86cd799439012'

const transcriptId =
  '507f1f77bcf86cd799439013'

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const transcript = {
  id: transcriptId,
  memoryId,
  recordingId,
  content:
    'This is the transcript.',
  languageCode: 'he',
  transcriptionProvider:
    'openai',
  transcriptionModel:
    'gpt-transcribe',
  reviewStatus: 'draft',
  revision: 1,
  lifecycleStatus: 'active',
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.verifyAccessToken
    .mockResolvedValue(
      authentication,
    )

  mocks.transcribeMemoryRecording
    .mockResolvedValue({
      transcript,
      created: true,
    })
})

describe(
  'Recording transcription route',
  () => {
    it('creates a draft transcript for an authenticated user', async () => {
      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcription`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({
            languageCode:
              '  he-IL  ',
          })

      expect(response.status).toBe(201)

      expect(
        mocks.transcribeMemoryRecording,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        recordingId,
        {
          languageCode: 'he-IL',
        },
      )

      expect(response.body).toEqual({
        success: true,
        data: {
          transcript,
          created: true,
        },
      })
    })

    it('returns an existing transcript without creating another one', async () => {
      mocks.transcribeMemoryRecording
        .mockResolvedValue({
          transcript,
          created: false,
        })

      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcription`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({})

      expect(response.status).toBe(200)

      expect(response.body.data)
        .toEqual({
          transcript,
          created: false,
        })
    })

    it('requires authentication', async () => {
      mocks.verifyAccessToken
        .mockRejectedValue(
          new AppError(
            'Authentication is required.',
            {
              statusCode: 401,
              code:
                'AUTHENTICATION_REQUIRED',
            },
          ),
        )

      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcription`,
          )
          .send({})

      expect(response.status).toBe(401)

      expect(
        mocks.transcribeMemoryRecording,
      ).not.toHaveBeenCalled()
    })

    it('rejects invalid identifiers before calling the service', async () => {
      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/invalid-recording/transcription`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({})

      expect(response.status).toBe(400)

      expect(
        mocks.transcribeMemoryRecording,
      ).not.toHaveBeenCalled()
    })

    it('rejects an invalid language before calling the service', async () => {
      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcription`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({
            languageCode:
              'invalid_language',
          })

      expect(response.status).toBe(400)

      expect(
        mocks.transcribeMemoryRecording,
      ).not.toHaveBeenCalled()
    })

    it('returns a safe response when transcription consent is missing', async () => {
      mocks.transcribeMemoryRecording
        .mockRejectedValue(
          new AppError(
            'Transcription consent was not granted for this recording.',
            {
              statusCode: 409,
              code:
                'RECORDING_TRANSCRIPTION_NOT_CONSENTED',
            },
          ),
        )

      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcription`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({})

      expect(response.status).toBe(409)

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'RECORDING_TRANSCRIPTION_NOT_CONSENTED',
        message:
          'Transcription consent was not granted for this recording.',
        requestId:
          expect.any(String),
      })
    })
  },
)