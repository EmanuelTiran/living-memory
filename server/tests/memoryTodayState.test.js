import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  deriveMemoryTodayState,
  MEMORY_TODAY_ACTION_KINDS,
} from '../../client/src/features/memories/memoryTodayState.js'

const olderDate =
  '2026-08-20T08:00:00.000Z'
const newerDate =
  '2026-08-22T08:00:00.000Z'

describe('memory today state', () => {
  it('uses the approved priority order when every state is present', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'owner',
      familyQuestions: [
        {
          id: 'question-1',
          question: 'מה היה החג האהוב?',
          createdAt: newerDate,
        },
      ],
      stories: [
        {
          id: 'story-1',
          title: 'טיוטת ילדות',
          status: 'draft',
          updatedAt: newerDate,
        },
      ],
      biographyProgress: {
        completedCount: 2,
        isComplete: false,
      },
    })

    expect(state.primaryAction).toMatchObject({
      kind:
        MEMORY_TODAY_ACTION_KINDS.answerFamilyQuestion,
      priority: 1,
      targetId: 'question-1',
    })
  })

  it('selects the most recently updated item within a priority', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'owner',
      familyQuestions: [
        {
          id: 'older-question',
          question: 'שאלה ישנה',
          updatedAt: olderDate,
        },
        {
          id: 'newer-question',
          question: 'שאלה חדשה',
          updatedAt: newerDate,
        },
      ],
    })

    expect(
      state.primaryAction.targetId,
    ).toBe('newer-question')
  })

  it('ignores a family question after its stored answer exists', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'owner',
      familyQuestions: [
        {
          id: 'question-1',
          question: 'שאלה שנענתה',
        },
      ],
      recordings: [
        {
          id: 'recording-1',
          storageStatus: 'stored',
          familyQuestionContext: {
            questionId: 'question-1',
          },
        },
      ],
    })

    expect(state.primaryAction.kind).toBe(
      MEMORY_TODAY_ACTION_KINDS.addMemory,
    )
    expect(
      state.counts.pendingFamilyQuestions,
    ).toBe(0)
  })

  it('offers the newest draft to a role that can edit', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'editor',
      stories: [
        {
          id: 'draft-1',
          title: 'סיפור לבדיקה',
          status: 'draft',
          updatedAt: newerDate,
        },
      ],
    })

    expect(state.primaryAction).toMatchObject({
      kind:
        MEMORY_TODAY_ACTION_KINDS.reviewDraftStory,
      priority: 2,
      targetId: 'draft-1',
    })
  })

  it('does not offer inaccessible review or interview actions to a contributor', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'contributor',
      stories: [
        {
          id: 'draft-1',
          title: 'טיוטה',
          status: 'draft',
        },
      ],
      biographyProgress: {
        completedCount: 1,
        isComplete: false,
      },
    })

    expect(state.primaryAction).toMatchObject({
      kind:
        MEMORY_TODAY_ACTION_KINDS.addMemory,
      priority: 4,
      hash: '#stories-title',
    })
  })

  it('continues a partial interview for a managing role', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'steward',
      biographyProgress: {
        completedCount: 3,
        isComplete: false,
      },
    })

    expect(state.primaryAction).toMatchObject({
      kind:
        MEMORY_TODAY_ACTION_KINDS.continueInterview,
      priority: 3,
      startGuidedInterview: true,
    })
  })

  it('gives a viewer a safe action instead of a documentation action', () => {
    const withStories = deriveMemoryTodayState({
      authorizationRole: 'viewer',
      stories: [
        {
          id: 'story-1',
          title: 'סיפור מאושר',
          status: 'approved',
        },
      ],
    })
    const withoutStories =
      deriveMemoryTodayState({
        authorizationRole: 'viewer',
      })

    expect(
      withStories.primaryAction.kind,
    ).toBe(
      MEMORY_TODAY_ACTION_KINDS.viewStories,
    )
    expect(
      withoutStories.primaryAction.kind,
    ).toBe(
      MEMORY_TODAY_ACTION_KINDS.askQuestion,
    )
  })

  it('welcomes a managing role with a first conversation in an empty archive', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'owner',
    })

    expect(state).toMatchObject({
      isNewArchive: true,
      primaryAction: {
        kind:
          MEMORY_TODAY_ACTION_KINDS.addMemory,
        label: 'התחלת שיחה ראשונה',
        hash: '#guided-interview',
        startGuidedInterview: true,
      },
    })
  })

  it('does not describe an archive with a recording as new', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'owner',
      recordings: [
        {
          id: 'recording-1',
          storageStatus: 'stored',
        },
      ],
    })

    expect(state.isNewArchive).toBe(false)
  })

  it('returns only the three most recent items and non-negative counts', () => {
    const state = deriveMemoryTodayState({
      authorizationRole: 'owner',
      stories: [
        {
          id: 'story-1',
          title: 'סיפור',
          status: 'approved',
          updatedAt: olderDate,
        },
      ],
      recordings: [
        {
          id: 'recording-1',
          displayName: 'הקלטה',
          storageStatus: 'stored',
          updatedAt: newerDate,
        },
      ],
      familyQuestions: [
        {
          id: 'question-1',
          question: 'שאלה ראשונה',
          createdAt:
            '2026-08-21T08:00:00.000Z',
        },
        {
          id: 'question-2',
          question: 'שאלה שנייה',
          createdAt:
            '2026-08-19T08:00:00.000Z',
        },
      ],
    })

    expect(state.recentItems).toHaveLength(3)
    expect(state.recentItems[0]).toMatchObject({
      id: 'recording-1',
      type: 'recording',
    })
    expect(state.counts).toEqual({
      approvedStories: 1,
      draftStories: 0,
      pendingFamilyQuestions: 2,
    })
  })
})
