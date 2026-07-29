import {
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import {
    INSUFFICIENT_CONTEXT_RESPONSE,
    MAX_CHAT_CONTEXT_CHARACTERS,
    MAX_CHAT_CONTEXT_SOURCES,
    buildChatContext,
  } from '../src/modules/chat/chatContextService.js'

  const memoryId =
    '507f1f77bcf86cd799439011'

  function createSource({
    sourceType = 'memory_story',
    sourceId =
      '507f1f77bcf86cd799439012',
    title = 'Approved source',
    content =
      'Approved source content.',
    sourceVersion =
      '2026-07-27T10:00:00.000Z',
  } = {}) {
    return {
      sourceType,
      sourceId,
      title,
      content,
      approvedAt: null,
      sourceVersion,
    }
  }

  function createProvider(sources) {
    return {
      listApprovedSources: vi
        .fn()
        .mockResolvedValue(sources),
    }
  }

  describe('Chat context service', () => {
    it('selects a relevant source without depending on its source type', async () => {
      const storySource = createSource({
        title: 'הטיול לירושלים',
        content:
          'המשפחה נסעה לירושלים בחג.',
      })

      const biographicalSource =
        createSource({
          sourceType:
            'biographical_fact',
          sourceId:
            '507f1f77bcf86cd799439013',
          title: 'מקצוע',
          content:
            'שרה עבדה כמורה בבית ספר.',
        })

      const provider = createProvider([
        storySource,
        biographicalSource,
      ])

      const result = await buildChatContext(
        {
          memoryId,
          message:
            'מה היה המקצוע של שרה?',
        },
        {
          sourceProviders: [provider],
        },
      )

      expect(result.groundingStatus).toBe(
        'grounded',
      )

      expect(result.sources).toEqual([
        biographicalSource,
      ])

      expect(result.fallbackResponse).toBeNull()

      expect(
        provider.listApprovedSources,
      ).toHaveBeenCalledWith(
        memoryId,
        {
          limit: 40,
        },
      )
    })

    it('returns a safe fallback when no approved sources exist', async () => {
      const provider = createProvider([])

      const result = await buildChatContext(
        {
          memoryId,
          message:
            'ספר לי על הילדות שלה.',
        },
        {
          sourceProviders: [provider],
        },
      )

      expect(result).toEqual({
        groundingStatus:
          'insufficient_context',
        message:
          'ספר לי על הילדות שלה.',
        sources: [],
        fallbackResponse:
          INSUFFICIENT_CONTEXT_RESPONSE,
      })
    })

    it('returns a safe fallback when approved sources are unrelated', async () => {
      const provider = createProvider([
        createSource({
          title: 'הטיול לירושלים',
          content:
            'המשפחה טיילה בעיר העתיקה.',
        }),
      ])

      const result = await buildChatContext(
        {
          memoryId,
          message:
            'מה היה המקצוע שלה?',
        },
        {
          sourceProviders: [provider],
        },
      )

      expect(result.groundingStatus).toBe(
        'insufficient_context',
      )

      expect(result.sources).toEqual([])

      expect(result.fallbackResponse).toBe(
        INSUFFICIENT_CONTEXT_RESPONSE,
      )
    })

    it('limits the number and total size of selected sources', async () => {
      const sources = Array.from(
        {
          length: 10,
        },
        (_value, index) =>
          createSource({
            sourceId:
              `source-${index}`,
            title:
              `ירושלים ${index}`,
            content:
              `ירושלים ${'א'.repeat(3000)}`,
          }),
      )

      const provider =
        createProvider(sources)

      const result = await buildChatContext(
        {
          memoryId,
          message:
            'מה קרה בירושלים?',
        },
        {
          sourceProviders: [provider],
        },
      )

      const contextCharacters =
        result.sources.reduce(
          (total, source) =>
            total +
            source.title.length +
            source.content.length,
          0,
        )

      expect(
        result.sources.length,
      ).toBeLessThanOrEqual(
        MAX_CHAT_CONTEXT_SOURCES,
      )

      expect(
        contextCharacters,
      ).toBeLessThanOrEqual(
        MAX_CHAT_CONTEXT_CHARACTERS,
      )
    })

    it('rejects invalid output from a source provider', async () => {
      const provider = createProvider([
        {
          sourceType: 'memory_story',
          sourceId:
            '507f1f77bcf86cd799439012',
          title: 'Invalid source',
          content:
            'This source has no version.',
          approvedAt: null,
          sourceVersion: '',
        },
      ])

      await expect(
        buildChatContext(
          {
            memoryId,
            message:
              'What does the source say?',
          },
          {
            sourceProviders: [provider],
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })
    })

    it('validates input before loading sources', async () => {
      const provider = createProvider([])

      await expect(
        buildChatContext(
          {
            memoryId: 'invalid-id',
            message: 'Valid message',
          },
          {
            sourceProviders: [provider],
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      await expect(
        buildChatContext(
          {
            memoryId,
            message: '   ',
          },
          {
            sourceProviders: [provider],
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        provider.listApprovedSources,
      ).not.toHaveBeenCalled()
    })
  })
