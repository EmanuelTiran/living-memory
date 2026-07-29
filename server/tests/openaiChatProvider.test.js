import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import {
    INSUFFICIENT_CONTEXT_RESPONSE,
  } from '../src/modules/chat/chatContextService.js'
  import {
    createSafetyIdentifier,
    generateGroundedChatReply,
    generateMemoryChatReply,
  } from '../src/modules/chat/openaiChatProvider.js'
  import {
    createOpenAIClient,
  } from '../src/modules/chat/openaiClient.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const sourceId =
    '507f1f77bcf86cd799439012'

  const source = {
    sourceType: 'memory_story',
    sourceId,
    title: 'המקצוע של שרה',
    content:
      'שרה עבדה כמורה בבית ספר.',
    approvedAt: null,
    sourceVersion:
      '2026-07-27T10:00:00.000Z',
  }

  function createClient(response) {
    return {
      responses: {
        parse: vi
          .fn()
          .mockResolvedValue(response),
      },
    }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OpenAI chat provider', () => {
    it('keeps the previous provider export as a compatible alias', () => {
      expect(
        generateGroundedChatReply,
      ).toBe(generateMemoryChatReply)
    })

    it('returns a grounded answer with verified citations', async () => {
      const client = createClient({
        id: 'resp_grounded',
        output_parsed: {
          groundingStatus: 'grounded',
          answer:
            'לפי הסיפור המאושר, שרה עבדה כמורה בבית ספר.',
          usedSourceIds: [sourceId],
        },
      })

      const result =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'במה שרה עבדה?',
            sources: [source],
            history: [],
          },
          {
            client,
            model:
              'gpt-5.6-terra',
            maxOutputTokens: 4000,
          },
        )

      expect(result).toEqual({
        content:
          'לפי הסיפור המאושר, שרה עבדה כמורה בבית ספר.',
        groundingStatus: 'grounded',
        citations: [
          {
            sourceType:
              'memory_story',
            sourceId,
            title:
              'המקצוע של שרה',
            excerpt:
              'שרה עבדה כמורה בבית ספר.',
            approvedAt: null,
            sourceVersion:
              '2026-07-27T10:00:00.000Z',
          },
        ],
        provider: 'openai',
        model: 'gpt-5.6-terra',
        providerResponseId:
          'resp_grounded',
      })

      const request =
        client.responses.parse
          .mock.calls[0][0]

      expect(request).toMatchObject({
        model: 'gpt-5.6-terra',
        reasoning: {
          effort: 'low',
        },
        max_output_tokens: 4000,
        store: false,
        safety_identifier:
          createSafetyIdentifier(userId),
      })

      expect(
        request.instructions,
      ).toEqual(expect.any(String))

      expect(
        request.text.format,
      ).toBeDefined()

      const payload = JSON.parse(
        request.input[0].content,
      )

      expect(payload.requestMode).toBe(
        'balanced',
      )

      expect(payload.question).toBe(
        'במה שרה עבדה?',
      )

      expect(
        payload.approvedSources,
      ).toHaveLength(1)
    })

    it('returns an inferred answer with supporting citations', async () => {
      const client = createClient({
        id: 'resp_inferred',
        output_parsed: {
          groundingStatus: 'inferred',
          answer:
            'ייתכן שההוראה הייתה חלק מרכזי בחייה, אך זו הסקה מהסיפור.',
          usedSourceIds: [sourceId],
        },
      })

      const result =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'האם שרה אהבה ללמד?',
            sources: [source],
          },
          {
            client,
            model:
              'gpt-5.6-terra',
          },
        )

      expect(result).toMatchObject({
        groundingStatus: 'inferred',
        citations: [
          {
            sourceId,
          },
        ],
        provider: 'openai',
        model: 'gpt-5.6-terra',
        providerResponseId:
          'resp_inferred',
      })
    })

    it('returns general knowledge without presenting it as personal history', async () => {
      const client = createClient({
        id: 'resp_general',
        output_parsed: {
          groundingStatus:
            'general_knowledge',
          answer:
            'באופן כללי, מורים מכינים שיעורים ומלווים תלמידים.',
          usedSourceIds: [],
        },
      })

      const result =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'מה מורים עושים בדרך כלל?',
            sources: [],
          },
          {
            client,
            model:
              'gpt-5.6-terra',
          },
        )

      expect(
        client.responses.parse,
      ).toHaveBeenCalledTimes(1)

      expect(result).toEqual({
        content:
          'באופן כללי, מורים מכינים שיעורים ומלווים תלמידים.',
        groundingStatus:
          'general_knowledge',
        citations: [],
        provider: 'openai',
        model: 'gpt-5.6-terra',
        providerResponseId:
          'resp_general',
      })
    })

    it('returns a creative answer only after an explicit creative request', async () => {
      const client = createClient({
        id: 'resp_creative',
        output_parsed: {
          groundingStatus: 'creative',
          answer:
            'בהדמיה יצירתית אפשר לדמיין שהיא הייתה בוחרת בכחול.',
          usedSourceIds: [],
        },
      })

      const result =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'איזה צבע היא אולי הייתה אוהבת?',
            sources: [source],
            responseMode: 'creative',
          },
          {
            client,
            model:
              'gpt-5.6-terra',
          },
        )

      expect(result).toEqual({
        content:
          'בהדמיה יצירתית אפשר לדמיין שהיא הייתה בוחרת בכחול.',
        groundingStatus: 'creative',
        citations: [],
        provider: 'openai',
        model: 'gpt-5.6-terra',
        providerResponseId:
          'resp_creative',
      })

      const request =
        client.responses.parse
          .mock.calls[0][0]

      const payload = JSON.parse(
        request.input[0].content,
      )

      expect(payload.requestMode).toBe(
        'creative',
      )
    })

    it('rejects a creative answer during balanced mode', async () => {
      const client = createClient({
        id: 'resp_unrequested_creative',
        output_parsed: {
          groundingStatus: 'creative',
          answer:
            'Invented answer.',
          usedSourceIds: [],
        },
      })

      await expect(
        generateMemoryChatReply(
          {
            userId,
            message:
              'What was her favorite color?',
            sources: [source],
          },
          {
            client,
          },
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 502,
        code: 'AI_INVALID_RESPONSE',
      })
    })

    it('uses the standard fallback when the model reports insufficient context', async () => {
      const client = createClient({
        id: 'resp_insufficient',
        output_parsed: {
          groundingStatus:
            'insufficient_context',
          answer:
            'An untrusted fallback.',
          usedSourceIds: [],
        },
      })

      const result =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'מה היה הצבע האהוב עליה?',
            sources: [source],
          },
          {
            client,
            model:
              'gpt-5.6-terra',
          },
        )

      expect(result).toEqual({
        content:
          INSUFFICIENT_CONTEXT_RESPONSE,
        groundingStatus:
          'insufficient_context',
        citations: [],
        provider: 'openai',
        model: 'gpt-5.6-terra',
        providerResponseId:
          'resp_insufficient',
      })
    })

    it('rejects hallucinated source identifiers', async () => {
      const client = createClient({
        id: 'resp_unknown_source',
        output_parsed: {
          groundingStatus: 'grounded',
          answer:
            'Unsupported answer.',
          usedSourceIds: [
            'unknown-source-id',
          ],
        },
      })

      const result =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'במה שרה עבדה?',
            sources: [source],
          },
          {
            client,
            model:
              'gpt-5.6-terra',
          },
        )

      expect(result).toMatchObject({
        content:
          INSUFFICIENT_CONTEXT_RESPONSE,
        groundingStatus:
          'insufficient_context',
        citations: [],
      })
    })

    it('rejects source identifiers on source-free answers', async () => {
      const client = createClient({
        id: 'resp_invalid_general',
        output_parsed: {
          groundingStatus:
            'general_knowledge',
          answer:
            'A general answer.',
          usedSourceIds: [sourceId],
        },
      })

      await expect(
        generateMemoryChatReply(
          {
            userId,
            message:
              'What do teachers do?',
            sources: [source],
          },
          {
            client,
          },
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 502,
        code: 'AI_INVALID_RESPONSE',
      })
    })

    it('returns a safe operational error when OpenAI fails', async () => {
      const client = {
        responses: {
          parse: vi
            .fn()
            .mockRejectedValue(
              new Error(
                'Sensitive provider error',
              ),
            ),
        },
      }

      await expect(
        generateMemoryChatReply(
          {
            userId,
            message:
              'במה שרה עבדה?',
            sources: [source],
          },
          {
            client,
          },
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
        message:
          'The AI service is temporarily unavailable.',
      })
    })

    it('rejects an invalid structured response', async () => {
      const client = createClient({
        id: 'resp_invalid',
        output_parsed: null,
      })

      await expect(
        generateMemoryChatReply(
          {
            userId,
            message:
              'במה שרה עבדה?',
            sources: [source],
          },
          {
            client,
          },
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 502,
        code: 'AI_INVALID_RESPONSE',
      })
    })

    it('validates inputs before calling OpenAI', async () => {
      const client = createClient({
        id: 'unused',
        output_parsed: null,
      })

      await expect(
        generateMemoryChatReply(
          {
            userId: '',
            message:
              'Valid question',
            sources: [source],
          },
          {
            client,
          },
        ),
      ).rejects.toThrow(
        'User ID must be a non-empty string.',
      )

      await expect(
        generateMemoryChatReply(
          {
            userId,
            message: '   ',
            sources: [source],
          },
          {
            client,
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      await expect(
        generateMemoryChatReply(
          {
            userId,
            message:
              'Valid question',
            sources: [source],
            responseMode:
              'unsupported',
          },
          {
            client,
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        client.responses.parse,
      ).not.toHaveBeenCalled()
    })

    it('creates a stable privacy-preserving safety identifier', () => {
      const firstIdentifier =
        createSafetyIdentifier(userId)

      const secondIdentifier =
        createSafetyIdentifier(userId)

      const otherIdentifier =
        createSafetyIdentifier(memoryId)

      expect(firstIdentifier).toHaveLength(
        64,
      )

      expect(secondIdentifier).toBe(
        firstIdentifier,
      )

      expect(otherIdentifier).not.toBe(
        firstIdentifier,
      )

      expect(firstIdentifier).not.toContain(
        userId,
      )
    })

    it('rejects an unconfigured API key before creating a client', () => {
      expect(() =>
        createOpenAIClient({
          apiKey: '',
        }),
      ).toThrow(
        expect.objectContaining({
          name: 'AppError',
          statusCode: 503,
          code:
            'AI_SERVICE_NOT_CONFIGURED',
        }),
      )
    })
  })
