import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryRecording, {
  MAX_RECORDING_SIZE_BYTES,
  RECORDING_CONSENT_VERSION,
} from '../src/modules/media/MemoryRecording.js'

const memoryId =
  new mongoose.Types.ObjectId()

const userId =
  new mongoose.Types.ObjectId()

function createRecordingInput(
  overrides = {},
) {
  return {
    memoryId,
    uploadedByUserId: userId,
    displayName:
      'Interview with Sarah',
    originalFileName:
      'sarah-interview.webm',
    mimeType: 'audio/webm',
    sizeBytes: 1024,
    languageCode: 'he',
    consent: {
      basis: 'subject_consent',
      permittedUses: [
        'transcription',
        'memory_grounding',
      ],
      confirmedByUserId: userId,
      confirmedAt: new Date(
        '2026-07-28T12:00:00.000Z',
      ),
      statementVersion:
        RECORDING_CONSENT_VERSION,
    },
    ...overrides,
  }
}

describe('MemoryRecording model', () => {
  it('accepts valid pending recording metadata', async () => {
    const recording =
      new MemoryRecording(
        createRecordingInput(),
      )

    await expect(
      recording.validate(),
    ).resolves.toBeUndefined()

    expect(recording).toMatchObject({
      storageStatus: 'pending',
      transcriptionStatus:
        'not_requested',
      lifecycleStatus: 'active',
      languageCode: 'he',
    })
  })

  it('requires explicit and unique permitted uses', async () => {
    const missingUses =
      new MemoryRecording(
        createRecordingInput({
          consent: {
            basis:
              'subject_consent',
            permittedUses: [],
            confirmedByUserId:
              userId,
            confirmedAt: new Date(),
            statementVersion:
              RECORDING_CONSENT_VERSION,
          },
        }),
      )

    await expect(
      missingUses.validate(),
    ).rejects.toThrow(
      'Recording consent requires at least one permitted use.',
    )

    const duplicateUses =
      new MemoryRecording(
        createRecordingInput({
          consent: {
            basis:
              'subject_consent',
            permittedUses: [
              'transcription',
              'transcription',
            ],
            confirmedByUserId:
              userId,
            confirmedAt: new Date(),
            statementVersion:
              RECORDING_CONSENT_VERSION,
          },
        }),
      )

    await expect(
      duplicateUses.validate(),
    ).rejects.toThrow(
      'Recording consent uses must be unique.',
    )
  })

  it('rejects unsupported files and oversized recordings', async () => {
    const unsupportedRecording =
      new MemoryRecording(
        createRecordingInput({
          mimeType:
            'application/octet-stream',
        }),
      )

    await expect(
      unsupportedRecording.validate(),
    ).rejects.toThrow()

    const oversizedRecording =
      new MemoryRecording(
        createRecordingInput({
          sizeBytes:
            MAX_RECORDING_SIZE_BYTES +
            1,
        }),
      )

    await expect(
      oversizedRecording.validate(),
    ).rejects.toThrow()
  })

  it('requires storage metadata for a stored recording', async () => {
    const recording =
      new MemoryRecording(
        createRecordingInput({
          storageStatus: 'stored',
        }),
      )

    await expect(
      recording.validate(),
    ).rejects.toThrow(
      'Stored recordings require storage metadata.',
    )
  })

  it('requires complete transcription metadata', async () => {
    const recording =
      new MemoryRecording(
        createRecordingInput({
          storageStatus: 'stored',
          storageProvider: 'local',
          storageKey:
            'private/memory/recording.webm',
          transcriptionStatus:
            'completed',
        }),
      )

    await expect(
      recording.validate(),
    ).rejects.toThrow(
      'Requested transcription requires a provider.',
    )

    recording.transcriptionProvider =
      'openai'

    recording.transcriptionModel =
      'gpt-4o-transcribe'

    await expect(
      recording.validate(),
    ).rejects.toThrow(
      'Completed transcription requires a completion timestamp.',
    )

    recording.transcriptionCompletedAt =
      new Date(
        '2026-07-28T12:30:00.000Z',
      )

    await expect(
      recording.validate(),
    ).resolves.toBeUndefined()
  })

  it('requires an archive timestamp for archived recordings', async () => {
    const recording =
      new MemoryRecording(
        createRecordingInput({
          lifecycleStatus:
            'archived',
        }),
      )

    await expect(
      recording.validate(),
    ).rejects.toThrow(
      'Archived recordings require an archive timestamp.',
    )

    recording.archivedAt =
      new Date(
        '2026-07-28T13:00:00.000Z',
      )

    await expect(
      recording.validate(),
    ).resolves.toBeUndefined()
  })

  it('does not expose private storage or consent identifiers', async () => {
    const recording =
      new MemoryRecording(
        createRecordingInput({
          storageStatus: 'stored',
          storageProvider: 'local',
          storageKey:
            'private/memory/recording.webm',
          checksumSha256:
            'a'.repeat(64),
        }),
      )

    await recording.validate()

    const publicRecording =
      recording.toJSON()

    expect(publicRecording.id).toBe(
      recording._id.toString(),
    )

    expect(publicRecording)
      .not.toHaveProperty(
        'storageKey',
      )

    expect(publicRecording)
      .not.toHaveProperty(
        'checksumSha256',
      )

    expect(
      publicRecording.consent,
    ).not.toHaveProperty(
      'confirmedByUserId',
    )

    expect(
      publicRecording.consent,
    ).toMatchObject({
      basis: 'subject_consent',
      permittedUses: [
        'transcription',
        'memory_grounding',
      ],
      statementVersion:
        RECORDING_CONSENT_VERSION,
    })
  })
})