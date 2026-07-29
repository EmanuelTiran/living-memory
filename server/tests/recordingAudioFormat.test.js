import {
    describe,
    expect,
    it,
  } from 'vitest'
  import {
    detectRecordingAudioFormat,
    isRecordingContentCompatibleWithMimeType,
    RECORDING_AUDIO_FORMATS,
  } from '../src/modules/media/recordingAudioFormat.js'

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

  function createMp4Buffer() {
    const buffer = Buffer.alloc(24)

    buffer.writeUInt32BE(24, 0)
    buffer.write('ftyp', 4, 'ascii')
    buffer.write('M4A ', 8, 'ascii')
    buffer.writeUInt32BE(0, 12)
    buffer.write('M4A ', 16, 'ascii')
    buffer.write('isom', 20, 'ascii')

    return buffer
  }

  describe(
    'Recording audio format',
    () => {
      it('detects supported recording signatures', () => {
        expect(
          detectRecordingAudioFormat(
            Buffer.from([
              0x1a,
              0x45,
              0xdf,
              0xa3,
            ]),
          ),
        ).toBe(
          RECORDING_AUDIO_FORMATS.WEBM,
        )

        expect(
          detectRecordingAudioFormat(
            Buffer.from(
              'RIFF0000WAVE',
              'ascii',
            ),
          ),
        ).toBe(
          RECORDING_AUDIO_FORMATS.WAV,
        )

        expect(
          detectRecordingAudioFormat(
            createMp4Buffer(),
          ),
        ).toBe(
          RECORDING_AUDIO_FORMATS
            .ISO_BASE_MEDIA,
        )

        expect(
          detectRecordingAudioFormat(
            Buffer.from([
              0xff,
              0xfb,
              0x90,
              0x64,
            ]),
          ),
        ).toBe(
          RECORDING_AUDIO_FORMATS.MP3,
        )

        expect(
          detectRecordingAudioFormat(
            createAdtsBuffer(),
          ),
        ).toBe(
          RECORDING_AUDIO_FORMATS
            .AAC_ADTS,
        )
      })

      it('accepts an ADTS stream uploaded as an M4A-compatible recording', () => {
        const buffer =
          createAdtsBuffer()

        expect(
          isRecordingContentCompatibleWithMimeType(
            'audio/x-m4a',
            buffer,
          ),
        ).toBe(true)

        expect(
          isRecordingContentCompatibleWithMimeType(
            'audio/mp4',
            buffer,
          ),
        ).toBe(true)
      })

      it('does not misclassify ADTS content as MP3', () => {
        expect(
          isRecordingContentCompatibleWithMimeType(
            'audio/mpeg',
            createAdtsBuffer(),
          ),
        ).toBe(false)
      })

      it('rejects a truncated ADTS stream', () => {
        const buffer =
          createAdtsBuffer()

        expect(
          isRecordingContentCompatibleWithMimeType(
            'audio/x-m4a',

            buffer.subarray(
              0,
              buffer.length - 1,
            ),
          ),
        ).toBe(false)
      })

      it('does not accept an embedded ftyp string outside a valid MP4 box', () => {
        const buffer = Buffer.from(
          'not-an-mp4-ftyp-payload',
          'ascii',
        )

        expect(
          detectRecordingAudioFormat(
            buffer,
          ),
        ).toBeNull()
      })
    },
  )
