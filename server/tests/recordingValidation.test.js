import {
    describe,
    expect,
    it,
  } from 'vitest'
  import {
    createMemoryRecordingSchema,
    memoryRecordingParamsSchema,
  } from '../src/modules/media/recordingValidation.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const recordingId =
    '507f1f77bcf86cd799439011'

  function createValidInput(
    overrides = {},
  ) {
    return {
      displayName:
        '  Interview with Sarah  ',
      originalFileName:
        '  sarah-interview.webm  ',
      mimeType: 'audio/webm',
      sizeBytes: 2048,
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

  describe('Recording validation', () => {
    it('normalizes valid recording metadata', () => {
      const result =
        createMemoryRecordingSchema.parse(
          createValidInput(),
        )

      expect(result).toEqual({
        displayName:
          'Interview with Sarah',
        originalFileName:
          'sarah-interview.webm',
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
      })
    })

    it('requires explicit consent confirmation', () => {
      const result =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            consent: {
              confirmed: false,
              basis:
                'subject_consent',
              permittedUses: [
                'transcription',
              ],
            },
          }),
        )

      expect(result.success).toBe(false)
    })

    it('rejects unsafe original file names', () => {
      const windowsPathResult =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            originalFileName:
              '..\\secret.webm',
          }),
        )

      const unixPathResult =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            originalFileName:
              '../secret.webm',
          }),
        )

      expect(
        windowsPathResult.success,
      ).toBe(false)

      expect(
        unixPathResult.success,
      ).toBe(false)
    })

    it('rejects unsupported and oversized recordings', () => {
      const unsupportedResult =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            mimeType: 'audio/flac',
          }),
        )

      const oversizedResult =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            sizeBytes:
              25 * 1024 * 1024 + 1,
          }),
        )

      expect(
        unsupportedResult.success,
      ).toBe(false)

      expect(
        oversizedResult.success,
      ).toBe(false)
    })

    it('rejects duplicate consent uses', () => {
      const result =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            consent: {
              confirmed: true,
              basis:
                'subject_consent',
              permittedUses: [
                'transcription',
                'transcription',
              ],
            },
          }),
        )

      expect(result.success).toBe(false)
    })

    it('accepts voice imitation only when explicitly selected', () => {
      const result =
        createMemoryRecordingSchema.parse(
          createValidInput({
            consent: {
              confirmed: true,
              basis: 'self',
              permittedUses: [
                'transcription',
                'voice_imitation',
              ],
            },
          }),
        )

      expect(
        result.consent.permittedUses,
      ).toContain('voice_imitation')
    })

    it('rejects voice imitation for someone else’s recording', () => {
      const result =
        createMemoryRecordingSchema.safeParse(
          createValidInput({
            consent: {
              confirmed: true,
              basis:
                'rights_holder',
              permittedUses: [
                'transcription',
                'voice_imitation',
              ],
            },
          }),
        )

      expect(result.success).toBe(false)
    })

    it('validates memory and recording identifiers', () => {
      expect(
        memoryRecordingParamsSchema.parse({
          memoryId,
          recordingId,
        }),
      ).toEqual({
        memoryId,
        recordingId,
      })

      expect(() =>
        memoryRecordingParamsSchema.parse({
          memoryId: 'invalid-memory',
          recordingId,
        }),
      ).toThrow()

      expect(() =>
        memoryRecordingParamsSchema.parse({
          memoryId,
          recordingId:
            'invalid-recording',
        }),
      ).toThrow()
    })
  })
