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
  createMemoryRecordingMetadata:
    vi.fn(),
  listMemoryRecordings: vi.fn(),
  getMemoryRecording: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/media/recordingService.js',
  () => ({
    createMemoryRecordingMetadata:
      mocks.createMemoryRecordingMetadata,
    listMemoryRecordings:
      mocks.listMemoryRecordings,
    getMemoryRecording:
      mocks.getMemoryRecording,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const recordingId =
  '507f1f77bcf86cd799439012'

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const publicRecording = {
  id: recordingId,
  memoryId,
  uploadedByUserId: userId,
  displayName:
    'Interview with Sarah',
  originalFileName:
    'sarah-interview.webm',
  mimeType: 'audio/webm',
  sizeBytes: 2048,
  languageCode: 'he',
  storageStatus: 'pending',
  transcriptionStatus:
    'not_requested',
  lifecycleStatus: 'active',
  consent: {
    basis: 'subject_consent',
    permittedUses: [
      'transcription',
      'memory_grounding',
    ],
    confirmedAt:
      '2026-07-28T14:00:00.000Z',
    statementVersion:
      'recording-consent-v1',
  },
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.verifyAccessToken
    .mockResolvedValue(
      authentication,
    )
})

describe('Recording routes', () => {
  it('creates recording metadata with validated input', async () => {
    mocks
      .createMemoryRecordingMetadata
      .mockResolvedValue(
        publicRecording,
      )

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/recordings`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        displayName:
          '  Interview with Sarah  ',
        originalFileName:
          '  sarah-interview.webm  ',
        mimeType: 'audio/webm',
        sizeBytes: 2048,
        consent: {
          confirmed: true,
          basis:
            'subject_consent',
          permittedUses: [
            'transcription',
            'memory_grounding',
          ],
        },
      })

    expect(response.status).toBe(201)

    expect(
      mocks
        .createMemoryRecordingMetadata,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      {
        displayName:
          'Interview with Sarah',
        originalFileName:
          'sarah-interview.webm',
        mimeType: 'audio/webm',
        sizeBytes: 2048,
        languageCode: 'he',
        consent: {
          confirmed: true,
          basis:
            'subject_consent',
          permittedUses: [
            'transcription',
            'memory_grounding',
          ],
        },
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        recording: publicRecording,
      },
    })
  })

  it('lists recordings for an authenticated user', async () => {
    mocks.listMemoryRecordings
      .mockResolvedValue([
        publicRecording,
      ])

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/recordings`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.listMemoryRecordings,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        recordings: [
          publicRecording,
        ],
      },
    })
  })

  it('returns a recording for an authenticated user', async () => {
    mocks.getMemoryRecording
      .mockResolvedValue(
        publicRecording,
      )

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/recordings/${recordingId}`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.getMemoryRecording,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      recordingId,
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        recording: publicRecording,
      },
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

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/recordings`,
      )

    expect(response.status).toBe(401)

    expect(
      mocks.listMemoryRecordings,
    ).not.toHaveBeenCalled()
  })

  it('rejects an invalid memory identifier', async () => {
    const response = await request(app)
      .get(
        '/api/memories/invalid-memory/recordings',
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(400)

    expect(
      response.body.error,
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
      message:
        'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(
      mocks.listMemoryRecordings,
    ).not.toHaveBeenCalled()
  })

  it('rejects an invalid recording identifier', async () => {
    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/recordings/invalid-recording`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(400)

    expect(
      mocks.getMemoryRecording,
    ).not.toHaveBeenCalled()
  })

  it('rejects invalid recording metadata', async () => {
    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/recordings`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        displayName: 'A',
        originalFileName:
          '../secret.webm',
        mimeType: 'audio/flac',
        sizeBytes: 0,
        consent: {
          confirmed: false,
          basis:
            'subject_consent',
          permittedUses: [],
        },
      })

    expect(response.status).toBe(400)

    expect(
      response.body.error,
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
      message:
        'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(
      mocks
        .createMemoryRecordingMetadata,
    ).not.toHaveBeenCalled()
  })

  it('returns a safe response when access is denied', async () => {
    mocks.listMemoryRecordings
      .mockRejectedValue(
        new AppError(
          'Memory profile was not found.',
          {
            statusCode: 404,
            code: 'MEMORY_NOT_FOUND',
          },
        ),
      )

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/recordings`,
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
      requestId: expect.any(String),
    })
  })
})