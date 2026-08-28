import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApprovedSource,
} from '../src/modules/chat/approvedSource.js'
import {
  INSUFFICIENT_CONTEXT_RESPONSE,
} from '../src/modules/chat/chatContextService.js'

vi.mock(
  '../src/config/env.js',
  () => ({
    env: {
      openaiApiKey: '',
      openaiMaxOutputTokens: 256,
      openaiModel: 'test-model',
      openaiTimeoutMs: 45_000,
    },
  }),
)

const {
  generateMemoryChatReply,
} = await import(
  '../src/modules/chat/openaiChatProvider.js'
)

const userId =
  '507f1f77bcf86cd799439011'
const memoryId =
  '507f1f77bcf86cd799439012'

function createClient(outputParsed) {
  return {
    responses: {
      parse: vi.fn()
        .mockResolvedValue({
          id: 'response-archive-1',
          output_parsed: outputParsed,
        }),
    },
  }
}

function createRecordingSource() {
  return createApprovedSource({
    sourceType:
      'recording_transcript',
    sourceId:
      new mongoose.Types.ObjectId()
        .toString(),
    title:
      'ארוחת השבת אצל סבתא',
    content:
      'בכל שבת היינו מתכנסים בבית של סבתא.',
    approvedAt:
      new Date(
        '2026-08-23T08:00:00.000Z',
      ),
    sourceVersion:
      'revision:1:chunk:1',
    sourceRoute:
      `/app/memories/${memoryId}#recordings-title`,
    recordingId:
      new mongoose.Types.ObjectId()
        .toString(),
    recordedAt:
      new Date(
        '2026-08-22T08:00:00.000Z',
      ),
    canPlayOriginalAudio: true,
  })
}

describe('archive chat policy', () => {
  it(
    'returns a verified answer with visible source provenance',
    async () => {
      const source =
        createRecordingSource()
      const client = createClient({
        groundingStatus: 'grounded',
        answer:
          'המשפחה התכנסה אצל סבתא בכל שבת.',
        usedSourceIds: [
          source.sourceId,
        ],
      })

      const reply =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'איפה נפגשה המשפחה בשבת?',
            sources: [source],
            responseMode: 'archive',
          },
          {
            client,
            model: 'test-model',
            maxOutputTokens: 256,
          },
        )

      expect(reply).toMatchObject({
        groundingStatus: 'grounded',
        citations: [
          {
            sourceType:
              'recording_transcript',
            sourceId: source.sourceId,
            sourceRoute:
              source.sourceRoute,
            recordingId:
              source.recordingId,
            recordedAt:
              source.recordedAt,
            canPlayOriginalAudio:
              true,
          },
        ],
      })

      const request =
        client.responses.parse
          .mock.calls[0][0]
      const payload = JSON.parse(
        request.input[0].content,
      )

      expect(payload.requestMode)
        .toBe('archive')
      expect(
        payload.approvedSources[0],
      ).not.toHaveProperty(
        'recordingId',
      )
    },
  )

  it(
    'converts an unsupported provider mode into UNKNOWN without invented content',
    async () => {
      const source =
        createRecordingSource()
      const client = createClient({
        groundingStatus:
          'general_knowledge',
        answer:
          'משפחות רבות נוהגות להיפגש בשבת.',
        usedSourceIds: [],
      })

      const reply =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'מה הוא חשב על פוליטיקה?',
            sources: [source],
            responseMode: 'archive',
          },
          {
            client,
            model: 'test-model',
            maxOutputTokens: 256,
          },
        )

      expect(reply).toMatchObject({
        content:
          INSUFFICIENT_CONTEXT_RESPONSE,
        groundingStatus:
          'insufficient_context',
        citations: [],
      })
      expect(reply.content).not.toContain(
        'משפחות רבות',
      )
    },
  )

  it(
    'requires more than one approved source for an archive inference',
    async () => {
      const source =
        createRecordingSource()
      const client = createClient({
        groundingStatus: 'inferred',
        answer:
          'נראה שארוחות השבת היו חשובות למשפחה.',
        usedSourceIds: [
          source.sourceId,
        ],
      })

      const reply =
        await generateMemoryChatReply(
          {
            userId,
            message:
              'מה הייתה החשיבות של ארוחות השבת?',
            sources: [source],
            responseMode: 'archive',
          },
          {
            client,
            model: 'test-model',
            maxOutputTokens: 256,
          },
        )

      expect(reply).toMatchObject({
        content:
          INSUFFICIENT_CONTEXT_RESPONSE,
        groundingStatus:
          'insufficient_context',
        citations: [],
      })
    },
  )

  it(
    'rejects external provenance links',
    () => {
      expect(() =>
        createApprovedSource({
          sourceType:
            'written_story',
          sourceId:
            new mongoose.Types.ObjectId()
              .toString(),
          title: 'סיפור',
          content: 'תוכן מאושר',
          approvedAt:
            new Date(),
          sourceVersion: 'revision:1',
          sourceRoute:
            'https://example.com/source',
        }),
      ).toThrow(
        'Source route must point to a memory profile.',
      )
    },
  )
})
