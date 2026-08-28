import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import MemoryRecording from './MemoryRecording.js'
import MemoryRecordingTranscript from './MemoryRecordingTranscript.js'
import {
  memoryRecordingMemoryParamsSchema,
} from './recordingValidation.js'

const CHAPTER_LABELS = Object.freeze({
  background: 'רקע ומשפחה',
  childhood: 'ילדות',
  education_work: 'לימודים ועבודה',
  relationships: 'משפחה וקשרים',
  personality: 'אופי ואישיות',
  preferences: 'העדפות ותחביבים',
  values: 'ערכים ואמונה',
  life_events: 'תחנות בחיים',
  family_questions:
    'שאלות מהמשפחה',
})

const FOLLOW_UP_QUESTIONS =
  Object.freeze({
    background:
      'מי עוד זוכר את הבית או המקום הזה?',
    childhood:
      'איזה רגע נוסף מהילדות עולה כשחושבים על הסיפור הזה?',
    education_work:
      'מי השפיע במיוחד על הדרך בלימודים או בעבודה?',
    relationships:
      'איזה רגע משפחתי נוסף כדאי לשמור לצד הסיפור הזה?',
    personality:
      'מתי התכונה הזאת באה לידי ביטוי בצורה הכי חזקה?',
    preferences:
      'איך התחביב או ההעדפה הזאת נכנסו לחיים?',
    values:
      'איזה סיפור ממחיש את הערך הזה בצורה הטובה ביותר?',
    life_events:
      'מה השתנה בחיים בעקבות האירוע הזה?',
    family_questions:
      'איזו שאלה נוספת המשפחה הייתה רוצה לשאול?',
  })

const STORY_SUMMARY_MAX_LENGTH = 260
const STORY_TITLE_MAX_LENGTH = 100

function normalizeText(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : ''
}

function createStoryTitle(
  transcriptContent,
  chapterLabel,
) {
  const content =
    normalizeText(transcriptContent)

  const firstSentence =
    content.split(/[.!?]\s/u)[0]

  if (firstSentence.length >= 12) {
    return firstSentence
      .slice(0, STORY_TITLE_MAX_LENGTH)
      .trim()
  }

  return `סיפור מתוך ${chapterLabel}`
}

function createStorySummary(content) {
  const normalized = normalizeText(content)

  if (
    normalized.length <=
    STORY_SUMMARY_MAX_LENGTH
  ) {
    return normalized
  }

  return `${normalized
    .slice(
      0,
      STORY_SUMMARY_MAX_LENGTH - 1,
    )
    .trim()}…`
}

function hasPermittedUse(
  recording,
  permittedUse,
) {
  return Boolean(
    recording.consent?.permittedUses
      ?.includes(permittedUse),
  )
}

export function createGuidedStoryCard(
  transcript,
  recording,
) {
  const isFamilyQuestion = Boolean(
    recording.familyQuestionContext,
  )

  const chapterKey = isFamilyQuestion
    ? 'family_questions'
    : recording.interviewContext
        .promptCategory

  const promptText = isFamilyQuestion
    ? recording.familyQuestionContext
        .questionText
    : recording.interviewContext
        .promptText

  const chapterLabel =
    CHAPTER_LABELS[chapterKey] ??
    'פרק חיים'

  return {
    id: transcript._id.toString(),
    recordingId:
      recording._id.toString(),
    title: createStoryTitle(
      transcript.content,
      chapterLabel,
    ),
    summary: createStorySummary(
      transcript.content,
    ),
    question: promptText,
    chapter: {
      key: chapterKey,
      label: chapterLabel,
    },
    durationMs:
      recording.durationMs ?? null,
    recordedAt:
      recording.createdAt ?? null,
    approvedAt:
      transcript.approvedAt ?? null,
    canPlayOriginalAudio:
      recording.storageStatus ===
        'stored' &&
      hasPermittedUse(
        recording,
        'recording_playback',
      ),
    followUpQuestion:
      FOLLOW_UP_QUESTIONS[
        chapterKey
      ] ??
      'איזה פרט נוסף כדאי לשמור לצד הסיפור הזה?',
  }
}

function getRecordingIds(transcripts) {
  return transcripts
    .map((transcript) =>
      transcript.recordingId
        ?.toString(),
    )
    .filter(Boolean)
}

export async function listGuidedStories(
  userId,
  memoryId,
) {
  const validatedParams =
    memoryRecordingMemoryParamsSchema
      .parse({
        memoryId,
      })

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const transcripts =
    await MemoryRecordingTranscript
      .find({
        memoryId:
          validatedParams.memoryId,
        reviewStatus: 'approved',
        lifecycleStatus: 'active',
      })
      .sort({
        approvedAt: -1,
        _id: -1,
      })
      .limit(100)
      .lean()

  const recordingIds =
    getRecordingIds(transcripts)

  if (recordingIds.length === 0) {
    return []
  }

  const recordings =
    await MemoryRecording.find({
      _id: {
        $in: recordingIds,
      },
      memoryId:
        validatedParams.memoryId,
      lifecycleStatus: 'active',
      storageStatus: 'stored',
      transcriptionStatus:
        'completed',
      $or: [
        {
          interviewContext: {
            $ne: null,
          },
        },
        {
          familyQuestionContext: {
            $ne: null,
          },
        },
      ],
      'consent.permittedUses':
        'memory_grounding',
    }).lean()

  const recordingsById = new Map(
    recordings.map((recording) => [
      recording._id.toString(),
      recording,
    ]),
  )

  return transcripts.flatMap(
    (transcript) => {
      const recording =
        recordingsById.get(
          transcript.recordingId
            .toString(),
        )

      return recording
        ? [
            createGuidedStoryCard(
              transcript,
              recording,
            ),
          ]
        : []
    },
  )
}
