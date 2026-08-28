import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  createGuidedStoryCard,
} from '../src/modules/media/guidedStoryService.js'

function createStoryFixtures({
  permittedUses = [
    'transcription',
    'memory_grounding',
    'recording_playback',
  ],
} = {}) {
  const recordingId =
    new mongoose.Types.ObjectId()

  return {
    transcript: {
      _id:
        new mongoose.Types.ObjectId(),
      recordingId,
      content:
        'בכל שבת היינו מתכנסים בבית של סבתא. המטבח היה מלא בריחות ובסיפורים.',
      approvedAt:
        new Date('2026-08-23T08:00:00.000Z'),
    },
    recording: {
      _id: recordingId,
      durationMs: 73_000,
      createdAt:
        new Date('2026-08-22T08:00:00.000Z'),
      storageStatus: 'stored',
      interviewContext: {
        promptCategory:
          'relationships',
        promptText:
          'איזו אווירה הייתה בארוחות המשפחתיות?',
      },
      consent: {
        permittedUses,
      },
    },
  }
}

describe('createGuidedStoryCard', () => {
  it(
    'creates a human story card from an approved guided transcript',
    () => {
      const { transcript, recording } =
        createStoryFixtures()

      const story =
        createGuidedStoryCard(
          transcript,
          recording,
        )

      expect(story).toMatchObject({
        recordingId:
          recording._id.toString(),
        title:
          'בכל שבת היינו מתכנסים בבית של סבתא',
        chapter: {
          key: 'relationships',
          label: 'משפחה וקשרים',
        },
        durationMs: 73_000,
        canPlayOriginalAudio: true,
        followUpQuestion:
          'איזה רגע משפחתי נוסף כדאי לשמור לצד הסיפור הזה?',
      })

      expect(story.summary).toContain(
        'המטבח היה מלא',
      )
      expect(story).not.toHaveProperty(
        'storageKey',
      )
    },
  )

  it(
    'does not offer original audio without playback consent',
    () => {
      const { transcript, recording } =
        createStoryFixtures({
          permittedUses: [
            'transcription',
            'memory_grounding',
          ],
        })

      const story =
        createGuidedStoryCard(
          transcript,
          recording,
        )

      expect(
        story.canPlayOriginalAudio,
      ).toBe(false)
    },
  )

  it(
    'places an approved family answer in its own story-map chapter',
    () => {
      const { transcript, recording } =
        createStoryFixtures()
      const familyQuestion =
        'איזה סיפור מהעבודה תמיד הצחיק את המשפחה?'

      recording.interviewContext = null
      recording.familyQuestionContext = {
        questionId:
          new mongoose.Types.ObjectId(),
        questionText:
          familyQuestion,
      }

      const story =
        createGuidedStoryCard(
          transcript,
          recording,
        )

      expect(story).toMatchObject({
        question: familyQuestion,
        chapter: {
          key: 'family_questions',
          label: 'שאלות מהמשפחה',
        },
        followUpQuestion:
          'איזו שאלה נוספת המשפחה הייתה רוצה לשאול?',
      })
    },
  )
})
