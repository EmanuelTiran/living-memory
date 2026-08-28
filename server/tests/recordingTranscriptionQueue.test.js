import { createHash } from 'node:crypto'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  findRecording: vi.fn(),
  updateRecording: vi.fn(),
  updateRecordingOne: vi.fn(),
  findTranscript: vi.fn(),
  createTranscript: vi.fn(),
  readBuffer: vi.fn(),
  transcribeRecording: vi.fn(),
  enqueueJob: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      CONTRIBUTE: 'contribute',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecording.js',
  () => ({
    default: {
      findOne: mocks.findRecording,
      findOneAndUpdate:
        mocks.updateRecording,
      updateOne:
        mocks.updateRecordingOne,
    },
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecordingTranscript.js',
  () => ({
    RECORDING_TRANSCRIPT_MAX_LENGTH:
      500_000,
    default: {
      findOne: mocks.findTranscript,
      create: mocks.createTranscript,
    },
  }),
)

vi.mock(
  '../src/modules/media/privateRecordingStorage.js',
  () => ({
    privateRecordingStorage: {
      provider: 'local_private',
      readBuffer: mocks.readBuffer,
    },
  }),
)

vi.mock(
  '../src/modules/media/openaiTranscriptionProvider.js',
  () => ({
    transcribeRecordingWithOpenAI:
      mocks.transcribeRecording,
  }),
)

vi.mock(
  '../src/platform/jobs/processingJobService.js',
  () => ({
    enqueueProcessingJob:
      mocks.enqueueJob,
    getProcessingJobId: vi.fn(
      (job) =>
        job.id ??
        job._id?.toString?.(),
    ),
  }),
)

import {
  enqueueMemoryRecordingTranscription,
  recordingTranscriptionProcessingHandler,
} from '../src/modules/media/recordingTranscriptionQueueService.js'

const userId =
  '507f1f77bcf86cd799439010'
const memoryId =
  '507f1f77bcf86cd799439011'
const recordingId =
  '507f1f77bcf86cd799439012'
const transcriptId =
  '507f1f77bcf86cd799439013'
const jobId =
  '507f1f77bcf86cd799439014'
const sourceAudio = Buffer.from([
  0x1a,
  0x45,
  0xdf,
  0xa3,
])
const checksumSha256 =
  createHash('sha256')
    .update(sourceAudio)
    .digest('hex')

function createRecording(
  overrides = {},
) {
  return {
    _id: recordingId,
    memoryId,
    originalFileName:
      'recording.webm',
    mimeType: 'audio/webm',
    sizeBytes: sourceAudio.length,
    languageCode: 'he',
    consent: {
      permittedUses: [
        'transcription',
      ],
    },
    storageStatus: 'stored',
    storageProvider:
      'local_private',
    storageKey:
      'private/recording.webm',
    checksumSha256,
    transcriptionStatus:
      'not_requested',
    transcriptionRequestSequence: 0,
    lifecycleStatus: 'active',
    ...overrides,
  }
}

function selectable(value) {
  return {
    select: vi.fn()
      .mockResolvedValue(value),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireMemoryPermission
    .mockResolvedValue({})
  mocks.findTranscript
    .mockResolvedValue(null)
  mocks.updateRecordingOne
    .mockResolvedValue({
      matchedCount: 1,
    })
})

describe(
  'Recording transcription queue',
  () => {
    it('queues one persistent job and returns immediately', async () => {
      const recording =
        createRecording()
      const queuedRecording =
        createRecording({
          transcriptionStatus:
            'queued',
          transcriptionRequestSequence: 1,
        })

      mocks.findRecording
        .mockReturnValue(
          selectable(recording),
        )
      mocks.updateRecording
        .mockReturnValue(
          selectable(
            queuedRecording,
          ),
        )
      mocks.enqueueJob
        .mockResolvedValue({
          id: jobId,
        })

      await expect(
        enqueueMemoryRecordingTranscription(
          userId,
          memoryId,
          recordingId,
          {
            languageCode: 'he-IL',
          },
        ),
      ).resolves.toEqual({
        transcript: null,
        created: false,
        queued: true,
        jobId,
      })

      expect(mocks.enqueueJob)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            memoryId,
            jobType:
              'recording_transcription',
            idempotencyKey:
              `recording-transcription:${recordingId}:1`,
            resourceType:
              'memory_recording',
            resourceId: recordingId,
            payload: {
              memoryId,
              recordingId,
              requestedByUserId:
                userId,
              languageCode: 'he-IL',
            },
            maxAttempts: 3,
          }),
        )
    })

    it('treats a repeated active request as idempotent', async () => {
      mocks.findRecording
        .mockReturnValue(
          selectable(
            createRecording({
              transcriptionStatus:
                'queued',
              transcriptionJobId:
                jobId,
            }),
          ),
        )

      await expect(
        enqueueMemoryRecordingTranscription(
          userId,
          memoryId,
          recordingId,
        ),
      ).resolves.toEqual({
        transcript: null,
        created: false,
        queued: true,
        jobId,
      })

      expect(mocks.enqueueJob)
        .not.toHaveBeenCalled()
    })

    it('processes queued audio and saves only a draft transcript', async () => {
      const queuedRecording =
        createRecording({
          transcriptionStatus:
            'queued',
          transcriptionJobId:
            jobId,
        })
      const storedBuffer =
        Buffer.from(sourceAudio)
      const publicTranscript = {
        id: transcriptId,
        reviewStatus: 'draft',
      }

      mocks.findRecording
        .mockReturnValue(
          selectable(
            queuedRecording,
          ),
        )
      mocks.updateRecording
        .mockResolvedValueOnce({
          ...queuedRecording,
          transcriptionStatus:
            'processing',
        })
        .mockResolvedValueOnce({
          ...queuedRecording,
          transcriptionStatus:
            'completed',
        })
      mocks.readBuffer
        .mockResolvedValue(
          storedBuffer,
        )
      mocks.transcribeRecording
        .mockResolvedValue({
          content:
            'תמלול לבדיקה.',
          languageCode: 'he',
          provider: 'openai',
          model: 'gpt-transcribe',
          providerResponseId:
            'response-id',
        })
      mocks.createTranscript
        .mockResolvedValue({
          toJSON: () =>
            publicTranscript,
        })

      const updateProgress = vi.fn()
        .mockResolvedValue({})

      await expect(
        recordingTranscriptionProcessingHandler
          .run({
            job: {
              id: jobId,
              payload: {
                memoryId,
                recordingId,
                requestedByUserId:
                  userId,
                languageCode: 'he',
              },
            },
            updateProgress,
          }),
      ).resolves.toEqual({
        transcriptId,
        created: true,
        reviewStatus: 'draft',
      })

      expect(mocks.updateRecordingOne)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            transcriptionStatus: {
              $in: [
                'queued',
                'processing',
              ],
            },
            $or: expect.arrayContaining([
              {
                transcriptionJobId:
                  jobId,
              },
            ]),
          }),
          expect.objectContaining({
            $set: {
              transcriptionJobId:
                jobId,
              transcriptionStatus:
                'queued',
            },
          }),
          expect.any(Object),
        )

      expect(updateProgress.mock.calls)
        .toEqual([
          [10],
          [35],
          [75],
          [90],
        ])
      expect(mocks.createTranscript)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            reviewStatus: 'draft',
            revision: 1,
          }),
        )
      expect(storedBuffer)
        .toEqual(
          Buffer.alloc(
            storedBuffer.length,
          ),
        )
    })

    it('returns a retryable failure to the queue and exposes only a terminal failure', async () => {
      const job = {
        id: jobId,
        payload: {
          memoryId,
          recordingId,
        },
      }

      await recordingTranscriptionProcessingHandler
        .onFailure({
          job,
          settledJob: {
            status: 'queued',
            lastErrorCode:
              'AI_SERVICE_TIMEOUT',
          },
        })

      expect(mocks.updateRecordingOne)
        .toHaveBeenLastCalledWith(
          expect.objectContaining({
            transcriptionJobId:
              jobId,
          }),
          expect.objectContaining({
            $set: {
              transcriptionStatus:
                'queued',
              transcriptionProgress: 0,
            },
          }),
          expect.any(Object),
        )

      await recordingTranscriptionProcessingHandler
        .onFailure({
          job,
          settledJob: {
            status: 'failed',
            lastErrorCode:
              'AI_SERVICE_UNAVAILABLE',
          },
        })

      expect(mocks.updateRecordingOne)
        .toHaveBeenLastCalledWith(
          expect.objectContaining({
            transcriptionJobId:
              jobId,
          }),
          expect.objectContaining({
            $set: {
              transcriptionStatus:
                'failed',
              transcriptionProgress: 0,
              transcriptionFailureCode:
                'AI_SERVICE_UNAVAILABLE',
            },
          }),
          expect.any(Object),
        )
    })
  },
)
