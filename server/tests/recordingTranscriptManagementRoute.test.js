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
  getTranscript: vi.fn(),
  updateTranscript: vi.fn(),
  approveTranscript: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/media/recordingTranscriptManagementService.js',
  () => ({
    getMemoryRecordingTranscript:
      mocks.getTranscript,
    updateMemoryRecordingTranscript:
      mocks.updateTranscript,
    approveMemoryRecordingTranscript:
      mocks.approveTranscript,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const recordingId =
  '507f1f77bcf86cd799439012'

const transcript = {
  id:
    '507f1f77bcf86cd799439013',
  memoryId,
  recordingId,
  content:
    'Corrected transcript.',
  reviewStatus: 'draft',
  revision: 2,
  lifecycleStatus: 'active',
}

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.verifyAccessToken
    .mockResolvedValue(
      authentication,
    )

  mocks.getTranscript
    .mockResolvedValue(
      transcript,
    )

  mocks.updateTranscript
    .mockResolvedValue(
      transcript,
    )

  mocks.approveTranscript
    .mockResolvedValue({
      transcript: {
        ...transcript,
        reviewStatus: 'approved',
      },
      approved: true,
    })
})

describe(
  'Recording transcript management routes',
  () => {
    it('returns a recording transcript', async () => {
      const response =
        await request(app)
          .get(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )

      expect(response.status).toBe(200)

      expect(
        mocks.getTranscript,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        recordingId,
      )

      expect(response.body).toEqual({
        success: true,
        data: {
          transcript,
        },
      })
    })

    it('updates a draft transcript', async () => {
      const response =
        await request(app)
          .patch(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({
            content:
              '  Corrected transcript.  ',
            expectedRevision: 1,
          })

      expect(response.status).toBe(200)

      expect(
        mocks.updateTranscript,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        recordingId,
        {
          content:
            'Corrected transcript.',
          expectedRevision: 1,
        },
      )
    })

    it('approves source use explicitly', async () => {
      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript/approval`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({
            expectedRevision: 2,
            confirmSourceUse: true,
          })

      expect(response.status).toBe(200)

      expect(
        mocks.approveTranscript,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        recordingId,
        {
          expectedRevision: 2,
          confirmSourceUse: true,
        },
      )

      expect(
        response.body.data.approved,
      ).toBe(true)
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
          .get(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript`,
          )

      expect(response.status).toBe(401)

      expect(
        mocks.getTranscript,
      ).not.toHaveBeenCalled()
    })

    it('rejects invalid transcript updates', async () => {
      const response =
        await request(app)
          .patch(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({
            content: ' ',
            expectedRevision: 0,
          })

      expect(response.status).toBe(400)

      expect(
        mocks.updateTranscript,
      ).not.toHaveBeenCalled()
    })

    it('requires explicit confirmation for source approval', async () => {
      const response =
        await request(app)
          .post(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript/approval`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )
          .send({
            expectedRevision: 2,
            confirmSourceUse: false,
          })

      expect(response.status).toBe(400)

      expect(
        mocks.approveTranscript,
      ).not.toHaveBeenCalled()
    })

    it('returns a safe permission error', async () => {
      mocks.getTranscript
        .mockRejectedValue(
          new AppError(
            'Memory profile was not found.',
            {
              statusCode: 404,
              code:
                'MEMORY_NOT_FOUND',
            },
          ),
        )

      const response =
        await request(app)
          .get(
            `/api/memories/${memoryId}/recordings/${recordingId}/transcript`,
          )
          .set(
            'Authorization',
            'Bearer valid-access-token',
          )

      expect(response.status).toBe(404)

      expect(
        response.body.error,
      ).toMatchObject({
        code: 'MEMORY_NOT_FOUND',
        message:
          'Memory profile was not found.',
        requestId:
          expect.any(String),
      })
    })
  },
)