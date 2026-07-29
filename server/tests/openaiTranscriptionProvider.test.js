import {
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'
  import {
    MAX_RECORDING_SIZE_BYTES,
  } from '../src/modules/media/MemoryRecording.js'
  import {
    RECORDING_TRANSCRIPT_MAX_LENGTH,
  } from '../src/modules/media/MemoryRecordingTranscript.js'
  import {
    createOpenAITranscriptionProvider,
  } from '../src/modules/media/openaiTranscriptionProvider.js'

  function createDependencies({
    model = 'gpt-transcribe',
    response = {
      id:
        'transcription-response-id',
      text:
        '  This is the transcript.  ',
      languages: [
        {
          code: 'he',
        },
      ],
    },
  } = {}) {
    const createTranscription =
      vi.fn().mockResolvedValue(
        response,
      )

    const client = {
      audio: {
        transcriptions: {
          create:
            createTranscription,
        },
      },
    }

    const getClient =
      vi.fn(() => client)

    const audioFile = {
      name: 'recording.webm',
    }

    const fileFactory =
      vi.fn().mockResolvedValue(
        audioFile,
      )

    const provider =
      createOpenAITranscriptionProvider({
        getClient,
        fileFactory,
        model,
        timeoutMs: 120000,
      })

    return {
      provider,
      getClient,
      fileFactory,
      createTranscription,
      audioFile,
    }
  }

  function createInput(overrides = {}) {
    return {
      audioBuffer:
        Buffer.from([
          0x1a,
          0x45,
          0xdf,
          0xa3,
        ]),
      originalFileName:
        'recording.webm',
      mimeType: 'audio/webm',
      languageCode: 'he-IL',
      ...overrides,
    }
  }

  describe(
    'OpenAI transcription provider',
    () => {
      it('transcribes audio with the recommended model', async () => {
        const dependencies =
          createDependencies()

        const input = createInput()

        const result =
          await dependencies
            .provider(input)

        expect(
          dependencies.getClient,
        ).toHaveBeenCalledTimes(1)

        expect(
          dependencies.fileFactory,
        ).toHaveBeenCalledWith(
          input.audioBuffer,
          'recording.webm',
          {
            type: 'audio/webm',
          },
        )

        expect(
          dependencies
            .createTranscription,
        ).toHaveBeenCalledWith(
          {
            file:
              dependencies.audioFile,
            model: 'gpt-transcribe',
          },
          {
            timeout: 120000,
            body: {
              file:
                dependencies.audioFile,
              model:
                'gpt-transcribe',
              languages: ['he'],
            },
          },
        )

        expect(result).toEqual({
          content:
            'This is the transcript.',
          languageCode: 'he',
          provider: 'openai',
          model: 'gpt-transcribe',
          providerResponseId:
            'transcription-response-id',
        })
      })

      it('uses the requested language when OpenAI does not detect one', async () => {
        const dependencies =
          createDependencies({
            response: {
              text:
                'Transcript without detected language.',
              languages: [],
            },
          })

        const result =
          await dependencies
            .provider(
              createInput(),
            )

        expect(
          result.languageCode,
        ).toBe('he-IL')

        expect(
          result.providerResponseId,
        ).toBe('')
      })

      it('uses the legacy language field for another configured model', async () => {
        const dependencies =
          createDependencies({
            model:
              'gpt-4o-mini-transcribe',
          })

        await dependencies.provider(
          createInput(),
        )

        expect(
          dependencies
            .createTranscription,
        ).toHaveBeenCalledWith(
          {
            file:
              dependencies.audioFile,
            model:
              'gpt-4o-mini-transcribe',
            language: 'he',
          },
          {
            timeout: 120000,
          },
        )
      })

      it('rejects missing or empty audio before contacting OpenAI', async () => {
        const dependencies =
          createDependencies()

        await expect(
          dependencies.provider(
            createInput({
              audioBuffer: null,
            }),
          ),
        ).rejects.toThrow(
          'Transcription requires a non-empty audio buffer.',
        )

        await expect(
          dependencies.provider(
            createInput({
              audioBuffer:
                Buffer.alloc(0),
            }),
          ),
        ).rejects.toThrow(
          'Transcription requires a non-empty audio buffer.',
        )

        expect(
          dependencies.getClient,
        ).not.toHaveBeenCalled()
      })

      it('rejects audio larger than the configured limit', async () => {
        const dependencies =
          createDependencies()

        await expect(
          dependencies.provider(
            createInput({
              audioBuffer:
                Buffer.alloc(
                  MAX_RECORDING_SIZE_BYTES +
                    1,
                ),
            }),
          ),
        ).rejects.toThrow(
          'Transcription audio must not exceed 25 MB.',
        )

        expect(
          dependencies.getClient,
        ).not.toHaveBeenCalled()
      })

      it('rejects unsupported audio types', async () => {
        const dependencies =
          createDependencies()

        await expect(
          dependencies.provider(
            createInput({
              mimeType:
                'application/octet-stream',
            }),
          ),
        ).rejects.toThrow(
          'Transcription audio type is not supported.',
        )

        expect(
          dependencies.getClient,
        ).not.toHaveBeenCalled()
      })

      it('rejects an invalid language code', async () => {
        const dependencies =
          createDependencies()

        await expect(
          dependencies.provider(
            createInput({
              languageCode: 'he_il',
            }),
          ),
        ).rejects.toThrow(
          'Transcription language code is invalid.',
        )

        expect(
          dependencies.getClient,
        ).not.toHaveBeenCalled()
      })

      it('rejects an empty provider response', async () => {
        const dependencies =
          createDependencies({
            response: {
              text: '   ',
            },
          })

        await expect(
          dependencies.provider(
            createInput(),
          ),
        ).rejects.toMatchObject({
          statusCode: 502,
          code:
            'TRANSCRIPTION_EMPTY_RESPONSE',
          message:
            'The transcription service returned an empty transcript.',
        })
      })

      it('rejects an oversized provider response', async () => {
        const dependencies =
          createDependencies({
            response: {
              text:
                'a'.repeat(
                  RECORDING_TRANSCRIPT_MAX_LENGTH +
                    1,
                ),
            },
          })

        await expect(
          dependencies.provider(
            createInput(),
          ),
        ).rejects.toMatchObject({
          statusCode: 502,
          code:
            'TRANSCRIPTION_RESPONSE_TOO_LARGE',
        })
      })

      it('maps provider timeouts to a safe error', async () => {
        const dependencies =
          createDependencies()

        dependencies
          .createTranscription
          .mockRejectedValue(
            Object.assign(
              new Error('Secret timeout details'),
              {
                name:
                  'APIConnectionTimeoutError',
              },
            ),
          )

        await expect(
          dependencies.provider(
            createInput(),
          ),
        ).rejects.toMatchObject({
          statusCode: 504,
          code:
            'TRANSCRIPTION_PROVIDER_TIMEOUT',
          message:
            'Recording transcription timed out.',
        })
      })

      it('maps temporary provider failures to a safe error', async () => {
        const dependencies =
          createDependencies()

        dependencies
          .createTranscription
          .mockRejectedValue({
            status: 429,
            message:
              'Provider rate-limit details',
          })

        await expect(
          dependencies.provider(
            createInput(),
          ),
        ).rejects.toMatchObject({
          statusCode: 503,
          code:
            'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
          message:
            'The transcription service is temporarily unavailable.',
        })
      })

      it('hides unexpected errors while preserving application errors', async () => {
        const dependencies =
          createDependencies()

        dependencies
          .createTranscription
          .mockRejectedValueOnce(
            new Error(
              'Sensitive provider details',
            ),
          )

        await expect(
          dependencies.provider(
            createInput(),
          ),
        ).rejects.toMatchObject({
          statusCode: 502,
          code:
            'TRANSCRIPTION_PROVIDER_ERROR',
          message:
            'Recording transcription could not be completed.',
        })

        dependencies
          .createTranscription
          .mockRejectedValueOnce(
            new AppError(
              'The AI service is not configured.',
              {
                statusCode: 503,
                code:
                  'AI_SERVICE_NOT_CONFIGURED',
              },
            ),
          )

        await expect(
          dependencies.provider(
            createInput(),
          ),
        ).rejects.toMatchObject({
          statusCode: 503,
          code:
            'AI_SERVICE_NOT_CONFIGURED',
        })
      })
    },
  )
