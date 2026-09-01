import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router'
import BiographyQuestionnaire from './BiographyQuestionnaire.jsx'
import MemoryStoryComposer from './MemoryStoryComposer.jsx'
import {
  createMemoryProfileTabSearch,
  MEMORY_PROFILE_TAB_IDS,
} from './memoryProfileTabs.js'
import {
  getDocumentationToolHash,
  getVisibleDocumentationTools,
  MEMORY_DOCUMENTATION_TOOL_IDS,
  resolveDocumentationTool,
} from './memoryDocumentationTools.js'
import './MemoryDocumentationPanel.css'

function MemoryDocumentationPanel({
  canManage,
  lastCreatedStoryId,
  memoryId,
  runAuthenticatedRequest,
  storyErrorMessage,
  storyForm,
  storySuccessMessage,
  subjectGender,
  subjectName,
  isSubmitting,
  onStoryChange,
  onStorySubmit,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const visibleTools =
    getVisibleDocumentationTools(
      canManage,
    )
  const selectedTool =
    resolveDocumentationTool({
      canManage,
      hash: location.hash,
      startGuidedInterview:
        location.state
          ?.startGuidedInterview === true,
    })
  const biographyToolIsSelected = [
    MEMORY_DOCUMENTATION_TOOL_IDS.conversation,
    MEMORY_DOCUMENTATION_TOOL_IDS.topics,
  ].includes(selectedTool)
  const profilePath =
    `/app/memories/${encodeURIComponent(memoryId)}`

  function selectTool(toolId) {
    const nextState = {
      ...(location.state ?? {}),
    }

    delete nextState.memoryTodayTarget
    delete nextState.startGuidedInterview

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash:
          getDocumentationToolHash(
            toolId,
          ),
      },
      {
        state: nextState,
      },
    )
  }

  return (
    <div className="memory-documentation">
      <header className="memory-documentation-heading">
        <p className="panel-kicker">
          מוסיפים מקור לארכיון
        </p>

        <h2>איך תרצו לתעד היום?</h2>

        <p>
          בוחרים דרך אחת בלבד. אפשר לעצור בכל שלב ולחזור אליה בביקור הבא.
        </p>
      </header>

      <div
        className={`memory-documentation-tools ${
          visibleTools.length === 1
            ? 'memory-documentation-tools-single'
            : ''
        }`}
        aria-label="בחירת דרך לתיעוד"
      >
        {visibleTools.map((tool) => (
          <button
            className="memory-documentation-tool"
            type="button"
            data-aura-tooltip={tool.tooltip}
            aria-pressed={
              selectedTool === tool.id
            }
            key={tool.id}
            onClick={() =>
              selectTool(tool.id)
            }
          >
            <span>
              {tool.badge ?? 'אפשרות'}
            </span>
            <strong>{tool.label}</strong>
            <small>
              {tool.description}
            </small>
          </button>
        ))}
      </div>

      {!canManage && (
        <p className="memory-documentation-permission-note">
          הראיון המודרך ובחירת הנושא מנוהלים בידי בעל הזיכרון או הנאמן המשפחתי.
          בהרשאה שלכם אפשר להוסיף סיפור כתוב.
        </p>
      )}

      {canManage && !selectedTool && (
        <div className="memory-documentation-choice-prompt">
          <strong>
            בחרו אחת משלוש הדרכים למעלה
          </strong>
          <p>
            רק הכלי שתבחרו ייפתח, כדי שהעמוד יישאר רגוע וברור.
          </p>
        </div>
      )}

      {canManage && (
        <div hidden={!biographyToolIsSelected}>
          <BiographyQuestionnaire
            key={`${memoryId}:${subjectGender ?? 'unspecified'}`}
            expansionRequestId={
              biographyToolIsSelected
                ? `${location.key}:${selectedTool}`
                : ''
            }
            memoryId={memoryId}
            subjectName={subjectName}
            runAuthenticatedRequest={
              runAuthenticatedRequest
            }
            initiallyExpanded={
              biographyToolIsSelected
            }
            viewMode={
              selectedTool ===
              MEMORY_DOCUMENTATION_TOOL_IDS.topics
                ? 'topics'
                : 'conversation'
            }
            onTopicQuestionSelected={() =>
              selectTool(
                MEMORY_DOCUMENTATION_TOOL_IDS.conversation,
              )
            }
            onTopicPickerRequested={() =>
              selectTool(
                MEMORY_DOCUMENTATION_TOOL_IDS.topics,
              )
            }
          />
        </div>
      )}

      <section
        className="story-workspace story-workspace-single"
        aria-labelledby="stories-title"
        hidden={
          selectedTool !==
          MEMORY_DOCUMENTATION_TOOL_IDS.story
        }
      >
        <MemoryStoryComposer
          errorMessage={storyErrorMessage}
          isSubmitting={isSubmitting}
          onChange={onStoryChange}
          onSubmit={onStorySubmit}
          storyForm={storyForm}
          successMessage={
            storySuccessMessage
          }
        />

        {lastCreatedStoryId && (
          <nav
            className="memory-documentation-completion-actions"
            aria-label="הפעולה הבאה לאחר שמירת הסיפור"
          >
            <Link
              className="primary-button"
              data-aura-tooltip="לבדוק ולאשר את הסיפור שנשמר"
              to={{
                pathname: profilePath,
                search:
                  createMemoryProfileTabSearch(
                    location.search,
                    MEMORY_PROFILE_TAB_IDS.archive,
                  ),
                hash:
                  `#memory-story-${lastCreatedStoryId}`,
              }}
              state={{
                memoryTodayTarget: {
                  type:
                    'review-draft-story',
                  id: lastCreatedStoryId,
                },
              }}
            >
              בדיקה ואישור
            </Link>

            <Link
              className="secondary-button"
              data-aura-tooltip="לחזור למסך היום בזיכרון"
              to={{
                pathname: profilePath,
                search:
                  createMemoryProfileTabSearch(
                    location.search,
                    MEMORY_PROFILE_TAB_IDS.today,
                  ),
                hash: '',
              }}
            >
              סיום להיום
            </Link>
          </nav>
        )}
      </section>
    </div>
  )
}

export default MemoryDocumentationPanel
