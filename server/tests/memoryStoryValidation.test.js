import {
    describe,
    expect,
    it,
  } from 'vitest'
  import { createMemoryStorySchema } from '../src/modules/memories/validation.js'

  describe('memory story validation', () => {
    it('normalizes valid story input', () => {
      const result =
        createMemoryStorySchema.parse({
          title: '  ילדות בשכונה  ',
          content:
            '  זהו סיפור מלא על תקופת הילדות בשכונה.  ',
          occurredOn: '1985-04-18',
        })

      expect(result).toEqual({
        title: 'ילדות בשכונה',
        content:
          'זהו סיפור מלא על תקופת הילדות בשכונה.',
        occurredOn: '1985-04-18',
      })
    })

    it('allows an omitted occurred date', () => {
      const result =
        createMemoryStorySchema.parse({
          title: 'סיפור משפחתי',
          content:
            'זהו סיפור משפחתי ללא תאריך מדויק.',
        })

      expect(result.occurredOn).toBeUndefined()
    })

    it('normalizes an empty occurred date', () => {
      const result =
        createMemoryStorySchema.parse({
          title: 'סיפור משפחתי',
          content:
            'זהו סיפור משפחתי ללא תאריך ידוע.',
          occurredOn: '   ',
        })

      expect(result.occurredOn).toBeUndefined()
    })

    it('rejects a short title', () => {
      expect(() =>
        createMemoryStorySchema.parse({
          title: 'א',
          content:
            'זהו תוכן ארוך מספיק עבור הסיפור.',
        }),
      ).toThrow()
    })

    it('rejects short story content', () => {
      expect(() =>
        createMemoryStorySchema.parse({
          title: 'כותרת תקינה',
          content: 'קצר',
        }),
      ).toThrow()
    })

    it('rejects an impossible date', () => {
      expect(() =>
        createMemoryStorySchema.parse({
          title: 'כותרת תקינה',
          content:
            'זהו תוכן ארוך מספיק עבור הסיפור.',
          occurredOn: '2025-02-31',
        }),
      ).toThrow()
    })

    it('rejects unknown properties', () => {
      expect(() =>
        createMemoryStorySchema.parse({
          title: 'כותרת תקינה',
          content:
            'זהו תוכן ארוך מספיק עבור הסיפור.',
          memoryId: 'not-allowed-here',
        }),
      ).toThrow()
    })
  })
