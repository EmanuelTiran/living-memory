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
  findTranscript: vi.fn(),
  updateTranscript: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      EDIT: 'edit',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecording.js',
  () => ({
    default: {
      findOne: vi.fn(),
    },
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecordingTranscript.js',
  () => ({
    RECORDING_TRANSCRIPT_MAX_LENGTH:
      500_000,
    default: {
      findOne:
        mocks.findTranscript,
      findOneAndUpdate:
        mocks.updateTranscript,
    },
  }),
)

import {
  reviseApprovedMemoryRecordingTranscript,
} from '../src/modules/media/recordingTranscriptManagementService.js'

const userId =
  '507f1f77bcf86cd799439010'
const memoryId =
  '507f1f77bcf86cd799439011'
const recordingId =
  '507f1f77bcf86cd799439012'
const transcriptId =
  '507f1f77bcf86cd799439013'

function createTranscript(
  reviewStatus = 'approved',
) {
  return {
    _id: transcriptId,
    memoryId,
    recordingId,
    content:
      'התוכן המאושר הקודם.',
    reviewStatus,
    approvedAt:
      new Date(
        '2026-08-23T08:00:00.000Z',
      ),
    approvedByUserId: userId,
    revision: 2,
  }
}

describe(
  'Approved transcript revision service',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mocks.requireMemoryPermission
        .mockResolvedValue({})
    })

    it(
      'stores the approved version and returns the edited transcript to draft',
      async () => {
        const transcript =
          createTranscript()
        const revisedTranscript = {
          ...transcript,
          content:
            'התוכן המתוקן.',
          reviewStatus: 'draft',
          approvedAt: null,
          approvedByUserId: null,
          revision: 3,
        }

        mocks.findTranscript
          .mockResolvedValue(
            transcript,
          )
        mocks.updateTranscript
          .mockResolvedValue(
            revisedTranscript,
          )

        const result =
          await reviseApprovedMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              content:
                'התוכן המתוקן.',
              expectedRevision: 2,
            },
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'edit',
        )

        expect(
          mocks.updateTranscript,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            _id: transcriptId,
            reviewStatus:
              'approved',
            revision: 2,
          }),
          expect.objectContaining({
            $set:
              expect.objectContaining({
                content:
                  'התוכן המתוקן.',
                reviewStatus:
                  'draft',
                approvedAt: null,
                approvedByUserId:
                  null,
              }),
            $inc: {
              revision: 1,
            },
            $push: {
              revisionHistory:
                expect.objectContaining({
                  $slice: -20,
                  $each: [
                    expect.objectContaining({
                      revision: 2,
                      content:
                        'התוכן המאושר הקודם.',
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

        expect(result).toEqual(
          revisedTranscript,
        )
      },
    )

    it(
      'does not revise a transcript that is already a draft',
      async () => {
        mocks.findTranscript
          .mockResolvedValue(
            createTranscript('draft'),
          )

        await expect(
          reviseApprovedMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              content:
                'תוכן מתוקן.',
              expectedRevision: 2,
            },
          ),
        ).rejects.toMatchObject({
          code:
            'RECORDING_TRANSCRIPT_NOT_APPROVED',
        })

        expect(
          mocks.updateTranscript,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
