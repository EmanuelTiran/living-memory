import {
    useCallback,
    useMemo,
    useState,
  } from 'react'
  import { ApiError } from '../../api/authApi.js'
  import {
    getBiographyQuestionnaire,
    saveBiographyQuestionnaireAnswer,
  } from '../../api/biographyApi.js'
  import './BiographyQuestionnaire.css'

  const CATEGORY_LABELS = {
    background: 'רקע ומשפחה',
    childhood: 'ילדות',
    education_work: 'לימודים ועבודה',
    relationships: 'משפחה וקשרים',
    personality: 'אופי ואישיות',
    preferences: 'העדפות ותחביבים',
    values: 'ערכים ואמונה',
    life_events: 'תחנות בחיים',
  }

  const CUSTOM_ANSWER_MAX_LENGTH = 4000

  function getErrorMessage(error) {
    if (!(error instanceof ApiError)) {
      return 'אירעה שגיאה בלתי צפויה.'
    }

    const messages = {
      MEMORY_NOT_FOUND:
        'הזיכרון לא נמצא או שאין לכם הרשאה לנהל את השאלון.',
      BIOGRAPHY_QUESTION_NOT_FOUND:
        'השאלה אינה זמינה יותר. רעננו את השאלון ונסו שוב.',
      BIOGRAPHY_OPTION_INVALID:
        'האפשרות שנבחרה אינה תקינה.',
      BIOGRAPHY_ANSWER_CONFLICT:
        'התשובה השתנתה בבקשה אחרת. רעננו את השאלון ונסו שוב.',
      VALIDATION_ERROR:
        'התשובה אינה תקינה. בחרו אפשרות או כתבו תשובה אישית.',
      AUTHENTICATION_REQUIRED:
        'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
      NETWORK_ERROR:
        'לא הצלחנו להתחבר לשרת.',
    }

    return (
      messages[error.code] ??
      'לא הצלחנו להשלים את הפעולה.'
    )
  }

  function createEmptyDraft() {
    return {
      mode: '',
      optionKey: '',
      customAnswer: '',
    }
  }

  function createAnswerDraft(answer) {
    if (answer.selectedOptionKey) {
      return {
        mode: 'option',
        optionKey:
          answer.selectedOptionKey,
        customAnswer: '',
      }
    }

    return {
      mode: 'custom',
      optionKey: '',
      customAnswer:
        answer.answer ?? '',
    }
  }

  function QuestionResponseForm({
    question,
    draft,
    isSaving,
    hasSavedAnswer,
    onDraftChange,
    onSubmit,
  }) {
    const customAnswerLength =
      draft.customAnswer.length

    return (
      <form
        className="biography-question-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(question)
        }}
        aria-busy={isSaving}
      >
        <fieldset disabled={isSaving}>
          <legend className="biography-question-title">
            {question.question}
          </legend>

          <p className="biography-question-category">
            {CATEGORY_LABELS[
              question.category
            ] ?? 'שאלת חיים'}
          </p>

          <div className="biography-options">
            {question.options.map(
              (option) => (
                <label
                  className={`biography-option ${
                    draft.mode ===
                      'option' &&
                    draft.optionKey ===
                      option.key
                      ? 'biography-option-selected'
                      : ''
                  }`}
                  key={option.key}
                >
                  <input
                    type="radio"
                    name={`biography-${question.key}`}
                    value={option.key}
                    checked={
                      draft.mode ===
                        'option' &&
                      draft.optionKey ===
                        option.key
                    }
                    onChange={() =>
                      onDraftChange(
                        question.key,
                        {
                          mode: 'option',
                          optionKey:
                            option.key,
                        },
                      )
                    }
                  />

                  <span>{option.label}</span>
                </label>
              ),
            )}

            <label
              className={`biography-option biography-custom-option ${
                draft.mode === 'custom'
                  ? 'biography-option-selected'
                  : ''
              }`}
            >
              <input
                type="radio"
                name={`biography-${question.key}`}
                value="custom"
                checked={
                  draft.mode === 'custom'
                }
                onChange={() =>
                  onDraftChange(
                    question.key,
                    {
                      mode: 'custom',
                      optionKey: '',
                    },
                  )
                }
              />

              <span>
                תשובה אחרת בניסוח שלי
              </span>
            </label>
          </div>

          {draft.mode === 'custom' && (
            <label className="biography-custom-field">
              <span>
                כתבו את התשובה המדויקת
              </span>

              <textarea
                value={draft.customAnswer}
                onChange={(event) =>
                  onDraftChange(
                    question.key,
                    {
                      mode: 'custom',
                      optionKey: '',
                      customAnswer:
                        event.target.value,
                    },
                  )
                }
                maxLength={
                  CUSTOM_ANSWER_MAX_LENGTH
                }
                rows={4}
                required
              />

              <small>
                {customAnswerLength}/
                {CUSTOM_ANSWER_MAX_LENGTH}
              </small>
            </label>
          )}
        </fieldset>

        <button
          className="primary-button biography-save-button"
          type="submit"
          disabled={
            isSaving ||
            draft.mode === '' ||
            (draft.mode === 'option' &&
              !draft.optionKey) ||
            (draft.mode === 'custom' &&
              !draft.customAnswer.trim())
          }
        >
          {isSaving
            ? 'שומרים את התשובה...'
            : hasSavedAnswer
              ? 'עדכון התשובה'
              : 'שמירת התשובה'}
        </button>
      </form>
    )
  }

  function BiographyQuestionnaire({
    memoryId,
    subjectName,
    runAuthenticatedRequest,
  }) {
    const [
      isExpanded,
      setIsExpanded,
    ] = useState(false)

    const [
      questionnaire,
      setQuestionnaire,
    ] = useState(null)

    const [drafts, setDrafts] =
      useState({})

    const [
      savedQuestionKeys,
      setSavedQuestionKeys,
    ] = useState(() => new Set())

    const [
      editingQuestionKey,
      setEditingQuestionKey,
    ] = useState('')

    const [
      showSavedAnswers,
      setShowSavedAnswers,
    ] = useState(false)

    const [isLoading, setIsLoading] =
      useState(false)

    const [
      savingQuestionKey,
      setSavingQuestionKey,
    ] = useState('')

    const [errorMessage, setErrorMessage] =
      useState('')

    const [
      successMessage,
      setSuccessMessage,
    ] = useState('')

    const loadQuestionnaire =
      useCallback(async () => {
        setIsLoading(true)
        setErrorMessage('')
        setSuccessMessage('')

        try {
          const result =
            await runAuthenticatedRequest(
              (accessToken) =>
                getBiographyQuestionnaire(
                  accessToken,
                  memoryId,
                ),
            )

          const nextDrafts = {}

          for (
            const question
            of result.questions
          ) {
            nextDrafts[question.key] =
              createEmptyDraft()
          }

          setQuestionnaire(result)
          setDrafts(nextDrafts)
          setSavedQuestionKeys(
            new Set(),
          )
          setEditingQuestionKey('')
        } catch (error) {
          setErrorMessage(
            getErrorMessage(error),
          )
        } finally {
          setIsLoading(false)
        }
      }, [
        memoryId,
        runAuthenticatedRequest,
      ])

    const currentQuestionKeys =
      useMemo(
        () =>
          new Set(
            questionnaire?.questions.map(
              (question) =>
                question.key,
            ) ?? [],
          ),
        [questionnaire],
      )

    const previousAnswers =
      useMemo(
        () =>
          questionnaire?.answers.filter(
            (answer) =>
              !currentQuestionKeys.has(
                answer.questionKey,
              ),
          ) ?? [],
        [
          currentQuestionKeys,
          questionnaire,
        ],
      )

    const currentBatchIsComplete =
      Boolean(
        questionnaire?.questions.length,
      ) &&
      questionnaire.questions.every(
        (question) =>
          savedQuestionKeys.has(
            question.key,
          ),
      )

    async function handleToggle() {
      const nextExpanded = !isExpanded

      setIsExpanded(nextExpanded)

      if (
        nextExpanded &&
        !questionnaire &&
        !isLoading
      ) {
        await loadQuestionnaire()
      }
    }

    function handleDraftChange(
      questionKey,
      changes,
    ) {
      setDrafts((current) => ({
        ...current,
        [questionKey]: {
          ...(current[questionKey] ??
            createEmptyDraft()),
          ...changes,
        },
      }))

      setErrorMessage('')
      setSuccessMessage('')
    }

    async function handleSave(question) {
      const draft =
        drafts[question.key] ??
        createEmptyDraft()

      let input

      if (
        draft.mode === 'option' &&
        draft.optionKey
      ) {
        input = {
          optionKey: draft.optionKey,
        }
      } else if (
        draft.mode === 'custom' &&
        draft.customAnswer.trim()
      ) {
        input = {
          customAnswer:
            draft.customAnswer,
        }
      } else {
        setErrorMessage(
          'בחרו אחת מהאפשרויות או כתבו תשובה אישית.',
        )

        return
      }

      setSavingQuestionKey(
        question.key,
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const biographyAnswer =
          await runAuthenticatedRequest(
            (accessToken) =>
              saveBiographyQuestionnaireAnswer(
                accessToken,
                memoryId,
                question.key,
                input,
              ),
          )

        setQuestionnaire((current) => {
          if (!current) {
            return current
          }

          const existingAnswerIndex =
            current.answers.findIndex(
              (answer) =>
                answer.questionKey ===
                question.key,
            )

          const answers = [
            ...current.answers,
          ]

          if (
            existingAnswerIndex === -1
          ) {
            answers.unshift(
              biographyAnswer,
            )
          } else {
            answers[
              existingAnswerIndex
            ] = biographyAnswer
          }

          const isNewAnswer =
            existingAnswerIndex === -1

          const completedCount =
            current.progress
              .completedCount +
            (isNewAnswer ? 1 : 0)

          return {
            ...current,
            answers,
            progress: {
              ...current.progress,
              completedCount,
              remainingCount:
                Math.max(
                  0,
                  current.progress
                    .totalCount -
                    completedCount,
                ),
              isComplete:
                completedCount ===
                current.progress
                  .totalCount,
            },
          }
        })

        setSavedQuestionKeys(
          (current) => {
            const next = new Set(current)
            next.add(question.key)
            return next
          },
        )

        setDrafts((current) => ({
          ...current,
          [question.key]:
            createAnswerDraft(
              biographyAnswer,
            ),
        }))

        setEditingQuestionKey('')

        setSuccessMessage(
          'התשובה נשמרה ואושרה כמקור ביוגרפי.',
        )
      } catch (error) {
        setErrorMessage(
          getErrorMessage(error),
        )
      } finally {
        setSavingQuestionKey('')
      }
    }

    function startEditingAnswer(answer) {
      const question =
        answer.questionDefinition

      if (!question) {
        return
      }

      setDrafts((current) => ({
        ...current,
        [question.key]:
          createAnswerDraft(answer),
      }))

      setEditingQuestionKey(
        question.key,
      )
      setErrorMessage('')
      setSuccessMessage('')
    }

    function cancelEditingAnswer() {
      setEditingQuestionKey('')
      setErrorMessage('')
    }

    const progress =
      questionnaire?.progress

    const progressPercentage =
      progress?.totalCount
        ? Math.round(
            (
              progress.completedCount /
              progress.totalCount
            ) * 100,
          )
        : 0

    return (
      <section
        className="biography-questionnaire"
        aria-labelledby="biography-questionnaire-title"
      >
        <div className="biography-introduction">
          <div>
            <p className="panel-kicker">
              מקור ביוגרפי מודרך
            </p>

            <h2 id="biography-questionnaire-title">
              שאלות על החיים של{' '}
              {subjectName}
            </h2>

            <p>
              ענו בכל פעם על עד חמש שאלות
              קצרות. כל תשובה שתשמרו
              תאושר כמקור ותוכל לסייע
              לשיחה עם הזיכרון.
            </p>
          </div>

          <button
            className="primary-button biography-toggle-button"
            type="button"
            onClick={handleToggle}
            aria-expanded={isExpanded}
          >
            {isExpanded
              ? 'סגירת השאלון'
              : questionnaire
                ? 'המשך השאלון'
                : 'התחלת שאלון ביוגרפי'}
          </button>
        </div>

        {isExpanded && (
          <div className="biography-questionnaire-content">
            {isLoading && (
              <div
                className="biography-loading"
                aria-live="polite"
              >
                <span
                  className="loading-indicator"
                  aria-hidden="true"
                />

                <p>טוענים שאלות...</p>
              </div>
            )}

            {errorMessage && (
              <p
                className="form-error biography-message"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p
                className="story-success biography-message"
                role="status"
              >
                {successMessage}
              </p>
            )}

            {!isLoading &&
              !questionnaire &&
              errorMessage && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={
                    loadQuestionnaire
                  }
                >
                  ניסיון נוסף
                </button>
              )}

            {!isLoading &&
              questionnaire && (
                <>
                  <div className="biography-progress">
                    <div className="biography-progress-heading">
                      <strong>
                        {progress.completedCount}{' '}
                        מתוך{' '}
                        {progress.totalCount}{' '}
                        שאלות הושלמו
                      </strong>

                      <span>
                        {progressPercentage}%
                      </span>
                    </div>

                    <div
                      className="biography-progress-track"
                      role="progressbar"
                      aria-valuemin="0"
                      aria-valuemax={
                        progress.totalCount
                      }
                      aria-valuenow={
                        progress.completedCount
                      }
                      aria-label="התקדמות בשאלון הביוגרפי"
                    >
                      <span
                        style={{
                          width:
                            `${progressPercentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  {progress.isComplete ? (
                    <div className="biography-complete">
                      <span aria-hidden="true">
                        ✓
                      </span>

                      <div>
                        <h3>
                          השאלון הושלם
                        </h3>

                        <p>
                          כל השאלות נשמרו
                          כמקורות ביוגרפיים
                          מאושרים. אפשר לערוך
                          אותן בכל עת.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="biography-question-list">
                      {questionnaire.questions
                        .map(
                          (question) => (
                            <article
                              className={`biography-question-card ${
                                savedQuestionKeys.has(
                                  question.key,
                                )
                                  ? 'biography-question-saved'
                                  : ''
                              }`}
                              key={
                                question.key
                              }
                            >
                              {savedQuestionKeys.has(
                                question.key,
                              ) && (
                                <p className="biography-saved-mark">
                                  התשובה נשמרה
                                </p>
                              )}

                              <QuestionResponseForm
                                question={
                                  question
                                }
                                draft={
                                  drafts[
                                    question.key
                                  ] ??
                                  createEmptyDraft()
                                }
                                isSaving={
                                  savingQuestionKey ===
                                  question.key
                                }
                                hasSavedAnswer={savedQuestionKeys.has(
                                  question.key,
                                )}
                                onDraftChange={
                                  handleDraftChange
                                }
                                onSubmit={
                                  handleSave
                                }
                              />
                            </article>
                          ),
                        )}

                      {currentBatchIsComplete && (
                        <div className="biography-next-batch">
                          <p>
                            מצוין. חמש התשובות
                            נשמרו ואפשר לעצור
                            כאן או להמשיך.
                          </p>

                          <button
                            className="primary-button"
                            type="button"
                            onClick={
                              loadQuestionnaire
                            }
                            disabled={
                              isLoading
                            }
                          >
                            שאלו אותי עוד 5
                            שאלות
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {questionnaire.answers
                    .length > 0 && (
                    <section className="biography-saved-answers">
                      <button
                        className="biography-saved-toggle"
                        type="button"
                        onClick={() =>
                          setShowSavedAnswers(
                            (current) =>
                              !current,
                          )
                        }
                        aria-expanded={
                          showSavedAnswers
                        }
                      >
                        <span>
                          תשובות שכבר נשמרו
                        </span>

                        <strong>
                          {
                            questionnaire
                              .answers
                              .length
                          }
                        </strong>
                      </button>

                      {showSavedAnswers && (
                        <div className="biography-answer-list">
                          {previousAnswers
                            .length === 0 ? (
                            <p className="biography-no-previous-answers">
                              התשובות מהמחזור
                              הנוכחי מוצגות
                              למעלה.
                            </p>
                          ) : (
                            previousAnswers.map(
                              (answer) => {
                                const question =
                                  answer.questionDefinition

                                if (!question) {
                                  return (
                                    <article
                                      className="biography-answer-card"
                                      key={
                                        answer.id
                                      }
                                    >
                                      <h3>
                                        {
                                          answer.question
                                        }
                                      </h3>

                                      <p>
                                        {
                                          answer.answer
                                        }
                                      </p>
                                    </article>
                                  )
                                }

                                const isEditing =
                                  editingQuestionKey ===
                                  question.key

                                return (
                                  <article
                                    className="biography-answer-card"
                                    key={
                                      answer.id
                                    }
                                  >
                                    {isEditing ? (
                                      <>
                                        <QuestionResponseForm
                                          question={
                                            question
                                          }
                                          draft={
                                            drafts[
                                              question
                                                .key
                                            ] ??
                                            createAnswerDraft(
                                              answer,
                                            )
                                          }
                                          isSaving={
                                            savingQuestionKey ===
                                            question.key
                                          }
                                          hasSavedAnswer
                                          onDraftChange={
                                            handleDraftChange
                                          }
                                          onSubmit={
                                            handleSave
                                          }
                                        />

                                        <button
                                          className="secondary-button biography-cancel-edit"
                                          type="button"
                                          disabled={
                                            savingQuestionKey ===
                                            question.key
                                          }
                                          onClick={
                                            cancelEditingAnswer
                                          }
                                        >
                                          ביטול העריכה
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <p className="biography-answer-category">
                                          {CATEGORY_LABELS[
                                            question
                                              .category
                                          ] ??
                                            'שאלת חיים'}
                                        </p>

                                        <h3>
                                          {
                                            answer.question
                                          }
                                        </h3>

                                        <p>
                                          {
                                            answer.answer
                                          }
                                        </p>

                                        <button
                                          className="story-action-button story-action-edit"
                                          type="button"
                                          onClick={() =>
                                            startEditingAnswer(
                                              answer,
                                            )
                                          }
                                        >
                                          עריכת התשובה
                                        </button>
                                      </>
                                    )}
                                  </article>
                                )
                              },
                            )
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
          </div>
        )}
      </section>
    )
  }

  export default BiographyQuestionnaire
