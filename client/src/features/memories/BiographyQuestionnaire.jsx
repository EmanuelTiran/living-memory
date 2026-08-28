  import {
    useCallback,
    useEffect,
    useMemo,
    useState,
  } from 'react'
  import { ApiError } from '../../api/authApi.js'
  import {
    getBiographyQuestionnaire,
    saveBiographyQuestionnaireAnswer,
  } from '../../api/biographyApi.js'
  import GuidedInterviewRecorder from './GuidedInterviewRecorder.jsx'
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

  function normalizePromptSearch(value) {
    return value
      .trim()
      .toLocaleLowerCase('he-IL')
  }

  function QuestionResponseForm({
    question,
    draft,
    isSaving,
    hasSavedAnswer,
    memoryId,
    subjectName,
    runAuthenticatedRequest,
    onVoiceRecorderBusyChange,
    onVoiceAnswerStored,
    showVoiceRecorder = false,
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

          {showVoiceRecorder && (
            <GuidedInterviewRecorder
              memoryId={memoryId}
              question={question}
              subjectName={subjectName}
              runAuthenticatedRequest={
                runAuthenticatedRequest
              }
              onBusyChange={
                onVoiceRecorderBusyChange
              }
              onAnswerStored={
                onVoiceAnswerStored
              }
            />
          )}

          <details
            className="biography-written-answer"
            open={!showVoiceRecorder}
          >
            <summary>
              {showVoiceRecorder
                ? 'מעדיפים לענות בקצרה בכתב?'
                : 'עריכת התשובה הכתובה'}
            </summary>

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
          </details>
        </fieldset>
      </form>
    )
  }

  function BiographyQuestionnaire({
    memoryId,
    subjectName,
    runAuthenticatedRequest,
    initiallyExpanded = false,
  }) {
    const [
      isExpanded,
      setIsExpanded,
    ] = useState(initiallyExpanded)

    const [
      questionnaire,
      setQuestionnaire,
    ] = useState(null)

    const [drafts, setDrafts] =
      useState({})

    const [
      activeQuestionIndex,
      setActiveQuestionIndex,
    ] = useState(0)

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

    const [
      repeatPromptSearch,
      setRepeatPromptSearch,
    ] = useState('')

    const [
      repeatQuestionKey,
      setRepeatQuestionKey,
    ] = useState('')

    const [isLoading, setIsLoading] =
      useState(initiallyExpanded)

    const [
      isVoiceRecorderBusy,
      setIsVoiceRecorderBusy,
    ] = useState(false)

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
          setActiveQuestionIndex(0)
          setSavedQuestionKeys(
            new Set(),
          )
          setEditingQuestionKey('')
          setRepeatPromptSearch('')
          setRepeatQuestionKey('')

          return true
        } catch (error) {
          setErrorMessage(
            getErrorMessage(error),
          )

          return false
        } finally {
          setIsLoading(false)
        }
      }, [
        memoryId,
        runAuthenticatedRequest,
      ])

    useEffect(() => {
      if (!initiallyExpanded) {
        return undefined
      }

      let isActive = true

      void runAuthenticatedRequest(
        (accessToken) =>
          getBiographyQuestionnaire(
            accessToken,
            memoryId,
          ),
      )
        .then((result) => {
          if (!isActive) {
            return
          }

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
          setActiveQuestionIndex(0)
          setSavedQuestionKeys(
            new Set(),
          )
          setEditingQuestionKey('')
          setRepeatPromptSearch('')
          setRepeatQuestionKey('')
        })
        .catch((error) => {
          if (isActive) {
            setErrorMessage(
              getErrorMessage(error),
            )
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false)
          }
        })

      return () => {
        isActive = false
      }
    }, [
      initiallyExpanded,
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

    const repeatSearchResults =
      useMemo(() => {
        const normalizedSearch =
          normalizePromptSearch(
            repeatPromptSearch,
          )

        if (normalizedSearch.length < 2) {
          return []
        }

        return (
          questionnaire
            ?.answeredQuestions
            ?.filter((question) => {
              const searchableText =
                normalizePromptSearch(
                  `${question.question} ${CATEGORY_LABELS[question.category] ?? ''}`,
                )

              return searchableText.includes(
                normalizedSearch,
              )
            })
            .slice(0, 6) ?? []
        )
      }, [
        questionnaire,
        repeatPromptSearch,
      ])

    const repeatQuestion =
      useMemo(
        () =>
          questionnaire
            ?.answeredQuestions
            ?.find(
              (question) =>
                question.key ===
                repeatQuestionKey,
            ) ?? null,
        [
          questionnaire,
          repeatQuestionKey,
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

          const wasAlreadyAnswered =
            current.answeredQuestions
              ?.some(
                (answeredQuestion) =>
                  answeredQuestion.key ===
                  question.key,
              ) ?? false

          const answeredQuestions =
            wasAlreadyAnswered
              ? current.answeredQuestions
              : [
                  ...(current.answeredQuestions ?? []),
                  question,
                ]

          const completedCount =
            current.progress
              .completedCount +
            (isNewAnswer &&
            !wasAlreadyAnswered
              ? 1
              : 0)

          return {
            ...current,
            answers,
            answeredQuestions,
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

        if (
          repeatQuestionKey ===
          question.key
        ) {
          setRepeatPromptSearch('')
          setRepeatQuestionKey('')
        }

        setSuccessMessage(
          'התשובה נשמרה ואושרה כמקור ביוגרפי.',
        )

        const currentQuestionIndex =
          questionnaire?.questions.findIndex(
            (currentQuestion) =>
              currentQuestion.key ===
              question.key,
          ) ?? -1

        if (
          currentQuestionIndex >= 0 &&
          currentQuestionIndex <
            questionnaire.questions.length - 1
        ) {
          setActiveQuestionIndex(
            currentQuestionIndex + 1,
          )
        }
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

    function selectQuestionToRepeat(
      question,
    ) {
      setDrafts((current) => ({
        ...current,
        [question.key]:
          createEmptyDraft(),
      }))
      setRepeatQuestionKey(
        question.key,
      )
      setRepeatPromptSearch('')
      setErrorMessage('')
      setSuccessMessage('')
    }

    function cancelQuestionRepeat() {
      setRepeatQuestionKey('')
      setErrorMessage('')
      setSuccessMessage('')
    }

    function handleVoiceAnswerStored() {
      setRepeatPromptSearch('')
      setRepeatQuestionKey('')

      void loadQuestionnaire().then(
        (wasLoaded) => {
          if (wasLoaded) {
            setSuccessMessage(
              'התשובה הקולית נשמרה. בפעם הבאה תוצע שאלה שעדיין לא נענתה.',
            )
          }
        },
      )
    }

    const progress = questionnaire?.progress

    const suggestedQuestion =
      questionnaire?.questions[
        activeQuestionIndex
      ] ?? null

    const currentQuestion =
      repeatQuestion ??
      suggestedQuestion

    const isRepeatingQuestion =
      Boolean(repeatQuestion)

    return (
      <section
        id="guided-interview"
        className="biography-questionnaire"
        aria-labelledby="biography-questionnaire-title"
      >
        <div className="biography-introduction">
          <div>
            <p className="panel-kicker">
              ראיון חיים מודרך
            </p>

            <h2 id="biography-questionnaire-title">
              שיחה קצרה עם{' '}
              {subjectName}
            </h2>

            <p>
              בכל פעם מופיעה שאלה אנושית אחת.
              אין צורך להשלים שאלון או לענות
              על הכול ברצף.
            </p>
          </div>

          <button
            className="primary-button biography-toggle-button"
            type="button"
            onClick={handleToggle}
            disabled={isVoiceRecorderBusy}
            aria-expanded={isExpanded}
          >
            {isExpanded
              ? 'סיום לעכשיו'
              : questionnaire
                ? 'המשך הראיון'
                : 'התחלת ראיון קצר'}
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
                  <div className="guided-interview-context">
                    <strong>
                      שאלה אחת, בקצב שלכם
                    </strong>

                    <p>
                      התשובות שכבר נשמרו נשארות
                      זמינות לעריכה. מאגר השאלות
                      עובד מאחורי הקלעים ואינו
                      דורש מכם “לסיים” אותו.
                    </p>
                  </div>

                  {questionnaire
                    .answeredQuestions
                    ?.length > 0 && (
                    <section
                      className="guided-repeat-search"
                      aria-labelledby="guided-repeat-search-title"
                    >
                      <div className="guided-repeat-search-heading">
                        <div>
                          <h3 id="guided-repeat-search-title">
                            רוצים לחזור לשאלה שכבר נענתה?
                          </h3>

                          <p>
                            שאלות שנענו לא יוצעו שוב אוטומטית. אפשר לחפש ולבחור אחת
                            מהן במפורש.
                          </p>
                        </div>

                        <span>
                          {
                            questionnaire
                              .answeredQuestions
                              .length
                          }
                        </span>
                      </div>

                      <label className="guided-repeat-search-field">
                        <span>חיפוש בשאלות שכבר נענו</span>

                        <input
                          type="search"
                          value={repeatPromptSearch}
                          disabled={isVoiceRecorderBusy}
                          onChange={(event) => {
                            setRepeatPromptSearch(
                              event.target.value,
                            )
                            setRepeatQuestionKey('')
                          }}
                          placeholder="לדוגמה: ילדות, משפחה או עבודה"
                        />
                      </label>

                      {normalizePromptSearch(
                        repeatPromptSearch,
                      ).length === 1 && (
                        <p className="guided-repeat-search-hint">
                          כתבו לפחות שני תווים לחיפוש.
                        </p>
                      )}

                      {normalizePromptSearch(
                        repeatPromptSearch,
                      ).length >= 2 && (
                        repeatSearchResults.length > 0 ? (
                          <div className="guided-repeat-results">
                            {repeatSearchResults.map(
                              (question) => (
                                <button
                                  type="button"
                                  key={question.key}
                                  disabled={isVoiceRecorderBusy}
                                  onClick={() =>
                                    selectQuestionToRepeat(
                                      question,
                                    )
                                  }
                                >
                                  <span>
                                    {question.question}
                                  </span>

                                  <small>
                                    {CATEGORY_LABELS[
                                      question.category
                                    ] ?? 'שאלת חיים'}
                                    {' · '}
                                    כבר נענתה
                                  </small>

                                  <strong>
                                    לענות שוב
                                  </strong>
                                </button>
                              ),
                            )}
                          </div>
                        ) : (
                          <p className="guided-repeat-no-results">
                            לא נמצאה שאלה שנענתה ומתאימה לחיפוש.
                          </p>
                        )
                      )}
                    </section>
                  )}

                  {progress.isComplete &&
                  !isRepeatingQuestion ? (
                    <div className="biography-complete">
                      <span aria-hidden="true">
                        ✓
                      </span>

                      <div>
                        <h3>
                          יש לנו בסיס מצוין לסיפור
                        </h3>

                        <p>
                          השאלות שנענו נשמרו
                          כמקורות ביוגרפיים מאושרים.
                          אפשר לחזור אליהן ולערוך
                          אותן בכל עת.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="biography-question-list">
                      {currentQuestion &&
                        (isRepeatingQuestion ||
                          !currentBatchIsComplete) && (
                          <article
                            className={`biography-question-card ${
                              isRepeatingQuestion ||
                              savedQuestionKeys.has(
                                currentQuestion.key,
                              )
                                ? 'biography-question-saved'
                                : ''
                            }`}
                          >
                            {(isRepeatingQuestion ||
                              savedQuestionKeys.has(
                                currentQuestion.key,
                              )) && (
                              <p className="biography-saved-mark">
                                {isRepeatingQuestion
                                  ? 'השאלה כבר נענתה — בחרתם לענות שוב'
                                  : 'התשובה נשמרה'}
                              </p>
                            )}

                            <QuestionResponseForm
                              key={`${currentQuestion.key}-${
                                isRepeatingQuestion
                                  ? 'repeat'
                                  : 'suggested'
                              }`}
                              question={currentQuestion}
                              draft={
                                drafts[
                                  currentQuestion.key
                                ] ??
                                createEmptyDraft()
                              }
                              isSaving={
                                savingQuestionKey ===
                                currentQuestion.key
                              }
                              hasSavedAnswer={
                                isRepeatingQuestion ||
                                savedQuestionKeys.has(
                                  currentQuestion.key,
                                )
                              }
                              memoryId={memoryId}
                              subjectName={subjectName}
                              runAuthenticatedRequest={
                                runAuthenticatedRequest
                              }
                              onVoiceRecorderBusyChange={
                                setIsVoiceRecorderBusy
                              }
                              onVoiceAnswerStored={
                                handleVoiceAnswerStored
                              }
                              showVoiceRecorder
                              onDraftChange={
                                handleDraftChange
                              }
                              onSubmit={handleSave}
                            />

                            {isRepeatingQuestion ? (
                              <nav
                                className="guided-question-navigation guided-repeat-navigation"
                                aria-label="חזרה לשאלה המוצעת"
                              >
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={
                                    Boolean(savingQuestionKey) ||
                                    isVoiceRecorderBusy
                                  }
                                  onClick={cancelQuestionRepeat}
                                >
                                  חזרה לשאלה המוצעת
                                </button>
                              </nav>
                            ) : (
                              <nav
                                className="guided-question-navigation"
                                aria-label="מעבר בין שאלות מוצעות"
                              >
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={
                                    activeQuestionIndex === 0 ||
                                    Boolean(savingQuestionKey) ||
                                    isVoiceRecorderBusy
                                  }
                                  onClick={() =>
                                    setActiveQuestionIndex(
                                      (current) =>
                                        Math.max(0, current - 1),
                                    )
                                  }
                                >
                                  שאלה קודמת
                                </button>

                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={
                                    activeQuestionIndex >=
                                      questionnaire.questions.length - 1 ||
                                    Boolean(savingQuestionKey) ||
                                    isVoiceRecorderBusy
                                  }
                                  onClick={() =>
                                    setActiveQuestionIndex(
                                      (current) =>
                                        Math.min(
                                          questionnaire.questions.length - 1,
                                          current + 1,
                                        ),
                                    )
                                  }
                                >
                                  שאלה אחרת
                                </button>
                              </nav>
                            )}
                          </article>
                        )}

                      {currentBatchIsComplete &&
                        !isRepeatingQuestion && (
                        <div className="biography-next-batch">
                          <p>
                            מצוין. התשובות מהשיחה
                            הזאת נשמרו, ואפשר לעצור
                            כאן או לקבל שאלה נוספת.
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
                            קבלת שאלה נוספת
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
