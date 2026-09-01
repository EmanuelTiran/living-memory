import {
  getMemoryProfileCapabilities,
  MEMORY_PROFILE_TAB_IDS,
} from './memoryProfileTabs.js'

export const MEMORY_TODAY_ACTION_KINDS = {
  answerFamilyQuestion:
    'answer-family-question',
  reviewDraftStory:
    'review-draft-story',
  continueInterview:
    'continue-interview',
  addMemory: 'add-memory',
  viewStories: 'view-stories',
  askQuestion: 'ask-question',
}

function getTimestamp(item) {
  const timestamp = new Date(
    item?.updatedAt ??
      item?.createdAt ??
      0,
  ).getTime()

  return Number.isNaN(timestamp)
    ? 0
    : timestamp
}

function sortMostRecent(items) {
  return items
    .slice()
    .sort(
      (first, second) =>
        getTimestamp(second) -
        getTimestamp(first),
    )
}

function getAnsweredFamilyQuestionIds(
  recordings,
) {
  return new Set(
    recordings
      .filter(
        (recording) =>
          recording.storageStatus ===
            'stored' &&
          recording.familyQuestionContext
            ?.questionId,
      )
      .map((recording) =>
        recording.familyQuestionContext
          .questionId.toString(),
      ),
  )
}

function createRecentItems({
  stories,
  recordings,
  familyQuestions,
}) {
  return sortMostRecent([
    ...stories.map((story) => ({
      id: story.id,
      type: 'story',
      typeLabel: 'סיפור',
      title: story.title,
      status: story.status,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      tab: MEMORY_PROFILE_TAB_IDS.archive,
      hash: `#memory-story-${story.id}`,
    })),
    ...recordings
      .filter(
        (recording) =>
          recording.storageStatus ===
          'stored',
      )
      .map((recording) => ({
        id: recording.id,
        type: 'recording',
        typeLabel: 'הקלטה',
        title: recording.displayName,
        createdAt: recording.createdAt,
        updatedAt: recording.updatedAt,
        tab:
          MEMORY_PROFILE_TAB_IDS.archive,
        hash:
          `#memory-recording-${recording.id}`,
      })),
    ...familyQuestions.map(
      (familyQuestion) => ({
        id: familyQuestion.id,
        type: 'family-question',
        typeLabel: 'שאלת משפחה',
        title: familyQuestion.question,
        createdAt:
          familyQuestion.createdAt,
        updatedAt:
          familyQuestion.updatedAt,
        tab:
          MEMORY_PROFILE_TAB_IDS.family,
        hash:
          `#family-question-${familyQuestion.id}`,
      }),
    ),
  ]).slice(0, 3)
}

function createDefaultAction({
  capabilities,
  hasStories,
}) {
  if (!capabilities.canContribute) {
    if (hasStories) {
      return {
        kind:
          MEMORY_TODAY_ACTION_KINDS.viewStories,
        priority: 4,
        label: 'צפייה בסיפורים',
        description:
          'פותחים את הארכיון וממשיכים אל הסיפורים שכבר נשמרו.',
        tab:
          MEMORY_PROFILE_TAB_IDS.archive,
        hash: '#saved-stories-title',
      }
    }

    return {
      kind:
        MEMORY_TODAY_ACTION_KINDS.askQuestion,
      priority: 4,
      label: 'שאלת שאלה למשפחה',
      description:
        'משאירים שאלה קצרה שתוכל לפתוח סיפור משפחתי חדש.',
      tab: MEMORY_PROFILE_TAB_IDS.family,
      hash: '#family-questions',
    }
  }

  if (!hasStories) {
    return {
      kind:
        MEMORY_TODAY_ACTION_KINDS.addMemory,
      priority: 4,
      label: capabilities.canManage
        ? 'התחלת שיחה ראשונה'
        : 'כתיבת סיפור ראשון',
      description: capabilities.canManage
        ? 'כמה דקות, שאלה אנושית אחת, ובקצב שמתאים לכם.'
        : 'כותבים זיכרון קצר ושומרים אותו כטיוטה משפחתית.',
      tab:
        MEMORY_PROFILE_TAB_IDS.documentation,
      hash: capabilities.canManage
        ? '#guided-interview'
        : '#stories-title',
      startGuidedInterview:
        capabilities.canManage,
    }
  }

  return {
    kind:
      MEMORY_TODAY_ACTION_KINDS.addMemory,
    priority: 4,
    label: 'הוספת זיכרון חדש',
    description: capabilities.canManage
      ? 'פותחים שאלה אנושית אחת ושומרים עוד רגע בקצב שלכם.'
      : 'כותבים סיפור קצר ושומרים עוד רגע בארכיון המשפחתי.',
    tab:
      MEMORY_PROFILE_TAB_IDS.documentation,
    hash: capabilities.canManage
      ? '#guided-interview'
      : '#stories-title',
    startGuidedInterview:
      capabilities.canManage,
  }
}

export function deriveMemoryTodayState({
  authorizationRole,
  stories = [],
  recordings = [],
  familyQuestions = [],
  biographyProgress = null,
}) {
  const capabilities =
    getMemoryProfileCapabilities(
      authorizationRole,
    )
  const answeredQuestionIds =
    getAnsweredFamilyQuestionIds(
      recordings,
    )
  const pendingFamilyQuestions =
    sortMostRecent(
      familyQuestions.filter(
        (familyQuestion) =>
          !answeredQuestionIds.has(
            familyQuestion.id.toString(),
          ),
      ),
    )
  const draftStories = sortMostRecent(
    stories.filter(
      (story) =>
        story.status === 'draft',
    ),
  )
  const approvedStories =
    stories.filter(
      (story) =>
        story.status === 'approved',
    )
  const unfinishedInterviewRecordings =
    sortMostRecent(
      recordings.filter(
        (recording) =>
          recording.interviewContext &&
          recording.storageStatus !==
            'stored',
      ),
    )
  const hasIncompleteQuestionnaire =
    Boolean(
      biographyProgress &&
      biographyProgress.completedCount > 0 &&
      !biographyProgress.isComplete,
    )

  let primaryAction

  if (
    capabilities.canContribute &&
    pendingFamilyQuestions.length > 0
  ) {
    const familyQuestion =
      pendingFamilyQuestions[0]

    primaryAction = {
      kind:
        MEMORY_TODAY_ACTION_KINDS.answerFamilyQuestion,
      priority: 1,
      label: 'מענה לשאלת המשפחה',
      description:
        familyQuestion.question,
      tab: MEMORY_PROFILE_TAB_IDS.family,
      hash:
        `#family-question-${familyQuestion.id}`,
      targetId: familyQuestion.id,
    }
  } else if (
    capabilities.canEdit &&
    draftStories.length > 0
  ) {
    const draftStory = draftStories[0]

    primaryAction = {
      kind:
        MEMORY_TODAY_ACTION_KINDS.reviewDraftStory,
      priority: 2,
      label:
        'בדיקה ואישור של הסיפור',
      description: draftStory.title,
      tab:
        MEMORY_PROFILE_TAB_IDS.archive,
      hash:
        `#memory-story-${draftStory.id}`,
      targetId: draftStory.id,
    }
  } else if (
    capabilities.canManage &&
    (
      unfinishedInterviewRecordings.length >
        0 ||
      hasIncompleteQuestionnaire
    )
  ) {
    const unfinishedRecording =
      unfinishedInterviewRecordings[0]

    primaryAction = unfinishedRecording
      ? {
          kind:
            MEMORY_TODAY_ACTION_KINDS.continueInterview,
          priority: 3,
          label: 'המשך השיחה',
          description:
            'הקלטת הראיון ממתינה להשלמת השמירה.',
          tab:
            MEMORY_PROFILE_TAB_IDS.archive,
          hash:
            `#memory-recording-${unfinishedRecording.id}`,
          targetId:
            unfinishedRecording.id,
        }
      : {
          kind:
            MEMORY_TODAY_ACTION_KINDS.continueInterview,
          priority: 3,
          label: 'המשך השיחה',
          description:
            'ממשיכים מהשאלה הבאה שעדיין לא נשמרה.',
          tab:
            MEMORY_PROFILE_TAB_IDS.documentation,
          hash: '#guided-interview',
          startGuidedInterview: true,
        }
  } else {
    primaryAction = createDefaultAction({
      capabilities,
      hasStories: stories.length > 0,
    })
  }

  return {
    primaryAction,
    isNewArchive:
      stories.length === 0 &&
      recordings.length === 0,
    counts: {
      approvedStories:
        approvedStories.length,
      draftStories: draftStories.length,
      pendingFamilyQuestions:
        pendingFamilyQuestions.length,
    },
    recentItems: createRecentItems({
      stories,
      recordings,
      familyQuestions,
    }),
  }
}
