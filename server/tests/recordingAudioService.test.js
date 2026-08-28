import {
  createHash,
} from 'node:crypto'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission:
    vi.fn(),
  findOne: vi.fn(),
  readBuffer: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecording.js',
  async (importOriginal) => {
    const actual =
      await importOriginal()

    return {
      ...actual,
      default: {
        findOne: mocks.findOne,
      },
    }
  },
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

const {
  getMemoryRecordingAudio,
} = await import(
  '../src/modules/media/recordingAudioService.js'
)

const userId =
  '507f1f77bcf86cd799439011'
const memoryId =
  '507f1f77bcf86cd799439012'
const recordingId =
  '507f1f77bcf86cd799439013'

function createRecording(
  permittedUses = [
    'recording_playback',
  ],
) {
  const audioBuffer = Buffer.from(
    'private audio fixture',
  )

  return {
    audioBuffer,
    recording: {
      storageStatus: 'stored',
      storageProvider:
        'local_private',
      storageKey:
        `${memoryId}/${recordingId}/fixture.webm`,
      checksumSha256: createHash(
        'sha256',
      )
        .update(audioBuffer)
        .digest('hex'),
      sizeBytes: audioBuffer.length,
      mimeType: 'audio/webm',
      consent: {
        permittedUses,
      },
    },
  }
}

describe(
  'getMemoryRecordingAudio',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mocks.requireMemoryPermission
        .mockResolvedValue({})
    })

    it(
      'checks memory view permission and returns an integrity-verified buffer',
      async () => {
        const { audioBuffer, recording } =
          createRecording()

        const select = vi.fn()
          .mockResolvedValue(recording)

        mocks.findOne.mockReturnValue({
          select,
        })
        mocks.readBuffer
          .mockResolvedValue(audioBuffer)

        const result =
          await getMemoryRecordingAudio(
            userId,
            memoryId,
            recordingId,
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'view',
        )
        expect(mocks.findOne)
          .toHaveBeenCalledWith({
            _id: recordingId,
            memoryId,
            lifecycleStatus: 'active',
          })
        expect(result).toEqual({
          audioBuffer,
          mimeType: 'audio/webm',
        })
      },
    )

    it(
      'refuses playback without explicit consent',
      async () => {
        const { recording } =
          createRecording([
            'transcription',
          ])

        mocks.findOne.mockReturnValue({
          select: vi.fn()
            .mockResolvedValue(
              recording,
            ),
        })

        await expect(
          getMemoryRecordingAudio(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 403,
          code:
            'RECORDING_PLAYBACK_NOT_CONSENTED',
        })

        expect(
          mocks.readBuffer,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'does not query recording storage when memory access is denied',
      async () => {
        mocks.requireMemoryPermission
          .mockRejectedValue(
            new Error(
              'memory access denied',
            ),
          )

        await expect(
          getMemoryRecordingAudio(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toThrow(
          'memory access denied',
        )

        expect(
          mocks.findOne,
        ).not.toHaveBeenCalled()
        expect(
          mocks.readBuffer,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'refuses a file whose checksum no longer matches',
      async () => {
        const { recording } =
          createRecording()

        mocks.findOne.mockReturnValue({
          select: vi.fn()
            .mockResolvedValue(
              recording,
            ),
        })
        mocks.readBuffer.mockResolvedValue(
          Buffer.from(
            'different audio bytes',
          ),
        )

        await expect(
          getMemoryRecordingAudio(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          code:
            'RECORDING_INTEGRITY_FAILED',
        })
      },
    )
  },
)
