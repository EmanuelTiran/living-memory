import {
  BufferSource,
  Input,
  MP4,
} from 'mediabunny'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  createTranscriptionAudioPreparer,
  prepareRecordingForTranscription,
} from '../src/modules/media/transcriptionAudioPreparer.js'

function createAdtsFrame() {
  const frame = Buffer.alloc(519)

  frame.set([
    0xff,
    0xf1,
    0x4c,
    0x80,
    0x40,
    0xff,
    0xfc,
  ])

  return frame
}

function createAdtsBuffer() {
  return Buffer.concat([
    createAdtsFrame(),
    createAdtsFrame(),
  ])
}

describe(
  'Transcription audio preparer',
  () => {
    it('keeps a supported WebM recording unchanged', async () => {
      const audioBuffer =
        Buffer.from([
          0x1a,
          0x45,
          0xdf,
          0xa3,
        ])

      const result =
        await prepareRecordingForTranscription(
          {
            audioBuffer,
            originalFileName:
              'interview.webm',
            mimeType: 'audio/webm',
          },
        )

      expect(result).toMatchObject({
        audioBuffer,
        originalFileName:
          'interview.webm',
        mimeType: 'audio/webm',
        wasNormalized: false,
      })

      result.release()

      expect(audioBuffer).toEqual(
        Buffer.from([
          0x1a,
          0x45,
          0xdf,
          0xa3,
        ]),
      )
    })

    it('losslessly remuxes ADTS AAC into a readable M4A container', async () => {
      const audioBuffer =
        createAdtsBuffer()

      const result =
        await prepareRecordingForTranscription(
          {
            audioBuffer,
            originalFileName:
              'recording.m4a',
            mimeType:
              'audio/x-m4a',
          },
        )

      expect(result).toMatchObject({
        originalFileName:
          'recording.m4a',
        mimeType: 'audio/mp4',
        wasNormalized: true,
      })

      expect(
        result.audioBuffer
          .subarray(4, 8)
          .toString('ascii'),
      ).toBe('ftyp')

      const verificationInput =
        new Input({
          source: new BufferSource(
            result.audioBuffer,
          ),
          formats: [MP4],
        })

      const audioTrack =
        await verificationInput
          .getPrimaryAudioTrack()

      expect(audioTrack).not.toBeNull()

      expect(
        await audioTrack.getCodec(),
      ).toBe('aac')

      expect(
        await audioTrack
          .getSampleRate(),
      ).toBe(48000)

      expect(
        await audioTrack
          .getNumberOfChannels(),
      ).toBe(2)

      expect(audioBuffer[0]).toBe(
        0xff,
      )

      const normalizedBuffer =
        result.audioBuffer

      result.release()
      result.release()

      expect(
        normalizedBuffer.every(
          (value) => value === 0,
        ),
      ).toBe(true)

      expect(audioBuffer[0]).toBe(
        0xff,
      )
    })

    it('rejects audio with an invalid signature', async () => {
      await expect(
        prepareRecordingForTranscription(
          {
            audioBuffer:
              Buffer.from(
                'invalid audio',
              ),
            originalFileName:
              'recording.m4a',
            mimeType:
              'audio/x-m4a',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code:
          'TRANSCRIPTION_AUDIO_FORMAT_INVALID',
      })
    })

    it('rejects an invalid converter dependency', () => {
      expect(() =>
        createTranscriptionAudioPreparer(
          {
            convertAdtsToM4a:
              null,
          },
        ),
      ).toThrow(
        'AAC-to-M4A converter must be a function.',
      )
    })

    it('returns a safe error when AAC normalization produces no output', async () => {
      const prepareAudio =
        createTranscriptionAudioPreparer(
          {
            convertAdtsToM4a:
              async () =>
                Buffer.alloc(0),
          },
        )

      await expect(
        prepareAudio({
          audioBuffer:
            createAdtsBuffer(),
          originalFileName:
            'recording.m4a',
          mimeType:
            'audio/x-m4a',
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code:
          'TRANSCRIPTION_AUDIO_NORMALIZATION_FAILED',
      })
    })

    it('hides converter errors behind a safe application error', async () => {
      const prepareAudio =
        createTranscriptionAudioPreparer(
          {
            convertAdtsToM4a:
              async () => {
                throw new Error(
                  'Sensitive converter details',
                )
              },
          },
        )

      await expect(
        prepareAudio({
          audioBuffer:
            createAdtsBuffer(),
          originalFileName:
            'recording.m4a',
          mimeType:
            'audio/x-m4a',
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code:
          'TRANSCRIPTION_AUDIO_NORMALIZATION_FAILED',
        message:
          'Recording audio could not be normalized for transcription.',
      })
    })
  },
)