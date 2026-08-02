import {
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'
  import {
    AI_GENERATED_SPEECH_DISCLOSURE,
    SPEECH_TEXT_MAX_LENGTH,
    generateSpeechAudio,
  } from '../src/modules/voice/openaiSpeechProvider.js'

  const userId =
    '507f1f77bcf86cd799439010'

  function createMp3Bytes() {
    return Uint8Array.from([
      0x49,
      0x44,
      0x33,
      0x04,
      0x00,
      0x00,
    ])
  }

  function createAudioResponse(
    bytes = createMp3Bytes(),
  ) {
    return {
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset +
              bytes.byteLength,
          ),
        ),
    }
  }

  function createClient(response) {
    return {
      audio: {
        speech: {
          create: vi
            .fn()
            .mockResolvedValue(response),
        },
      },
    }
  }

  function createInput(overrides = {}) {
    return {
      userId,
      text:
        'שרה עבדה כמורה בבית ספר.',
      ...overrides,
    }
  }

  function createOptions(
    client,
    overrides = {},
  ) {
    return {
      client,
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      timeoutMs: 60000,
      ...overrides,
    }
  }

  describe(
    'OpenAI speech provider',
    () => {
      it('generates validated MP3 audio with a general synthetic voice', async () => {
        const response =
          createAudioResponse()

        const client =
          createClient(response)

        const result =
          await generateSpeechAudio(
            createInput(),
            createOptions(client),
          )

        expect(
          client.audio.speech.create,
        ).toHaveBeenCalledTimes(1)

        expect(
          client.audio.speech.create,
        ).toHaveBeenCalledWith(
          {
            model:
              'gpt-4o-mini-tts',
            voice: 'marin',
            input:
              'שרה עבדה כמורה בבית ספר.',
            instructions:
              expect.stringContaining(
                'Do not imitate a specific person.',
              ),
            response_format: 'mp3',
          },
          {
            timeout: 60000,
          },
        )

        expect(
          Buffer.isBuffer(
            result.audioBuffer,
          ),
        ).toBe(true)

        expect(result).toMatchObject({
          byteLength:
            createMp3Bytes().byteLength,
          contentType: 'audio/mpeg',
          fileExtension: 'mp3',
          provider: 'openai',
          model: 'gpt-4o-mini-tts',
          voice: 'marin',
          isAiGenerated: true,
          disclosure:
            AI_GENERATED_SPEECH_DISCLOSURE,
        })

        expect(
          response.arrayBuffer,
        ).toHaveBeenCalledTimes(1)
      })

      it('trims speech text before sending it to OpenAI', async () => {
        const client = createClient(
          createAudioResponse(),
        )

        await generateSpeechAudio(
          createInput({
            text:
              '  תשובה עם רווחים.  ',
          }),
          createOptions(client),
        )

        const request =
          client.audio.speech.create
            .mock.calls[0][0]

        expect(request.input).toBe(
          'תשובה עם רווחים.',
        )
      })

      it('rejects an invalid user identifier before calling OpenAI', async () => {
        const client = createClient(
          createAudioResponse(),
        )

        await expect(
          generateSpeechAudio(
            createInput({
              userId: '   ',
            }),
            createOptions(client),
          ),
        ).rejects.toMatchObject({
          name: 'ZodError',
        })

        expect(
          client.audio.speech.create,
        ).not.toHaveBeenCalled()
      })

      it('rejects empty and oversized speech text before calling OpenAI', async () => {
        const client = createClient(
          createAudioResponse(),
        )

        const invalidTexts = [
          '   ',
          'a'.repeat(
            SPEECH_TEXT_MAX_LENGTH + 1,
          ),
        ]

        for (const text of invalidTexts) {
          await expect(
            generateSpeechAudio(
              createInput({
                text,
              }),
              createOptions(client),
            ),
          ).rejects.toMatchObject({
            name: 'ZodError',
          })
        }

        expect(
          client.audio.speech.create,
        ).not.toHaveBeenCalled()
      })

      it('rejects unsupported provider configuration before calling OpenAI', async () => {
        const client = createClient(
          createAudioResponse(),
        )

        await expect(
          generateSpeechAudio(
            createInput(),
            createOptions(
              client,
              {
                voice:
                  'unsupported-voice',
              },
            ),
          ),
        ).rejects.toMatchObject({
          name: 'ZodError',
        })

        expect(
          client.audio.speech.create,
        ).not.toHaveBeenCalled()
      })

      it('returns a safe operational error when OpenAI fails', async () => {
        const client = {
          audio: {
            speech: {
              create: vi
                .fn()
                .mockRejectedValue(
                  new Error(
                    'Sensitive provider details',
                  ),
                ),
            },
          },
        }

        await expect(
          generateSpeechAudio(
            createInput(),
            createOptions(client),
          ),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 502,
          code:
            'AI_SPEECH_PROVIDER_ERROR',
          message:
            'The speech service is temporarily unavailable.',
        })
      })

      it('preserves an existing application error', async () => {
        const applicationError =
          new AppError(
            'The AI service is not configured.',
            {
              statusCode: 503,
              code:
                'AI_SERVICE_NOT_CONFIGURED',
            },
          )

        const client = {
          audio: {
            speech: {
              create: vi
                .fn()
                .mockRejectedValue(
                  applicationError,
                ),
            },
          },
        }

        await expect(
          generateSpeechAudio(
            createInput(),
            createOptions(client),
          ),
        ).rejects.toBe(
          applicationError,
        )
      })

      it('rejects a provider response without readable audio', async () => {
        const client =
          createClient({})

        await expect(
          generateSpeechAudio(
            createInput(),
            createOptions(client),
          ),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 502,
          code:
            'AI_SPEECH_INVALID_RESPONSE',
        })
      })

      it('rejects empty or malformed MP3 output', async () => {
        const invalidAudioOutputs = [
          new Uint8Array(),
          Uint8Array.from([
            0x00,
            0x01,
            0x02,
            0x03,
          ]),
        ]

        for (
          const bytes of
          invalidAudioOutputs
        ) {
          const client = createClient(
            createAudioResponse(bytes),
          )

          await expect(
            generateSpeechAudio(
              createInput(),
              createOptions(client),
            ),
          ).rejects.toMatchObject({
            name: 'AppError',
            statusCode: 502,
            code:
              'AI_SPEECH_INVALID_RESPONSE',
          })
        }
      })

      it('rejects speech audio that exceeds the configured memory limit', async () => {
        const client = createClient(
          createAudioResponse(),
        )

        await expect(
          generateSpeechAudio(
            createInput(),
            createOptions(
              client,
              {
                maxAudioBytes: 5,
              },
            ),
          ),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 502,
          code:
            'AI_SPEECH_INVALID_RESPONSE',
        })
      })
    },
  )
