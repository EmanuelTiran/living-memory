import ChatMessageSpeechButton from './ChatMessageSpeechButton.jsx'
import {
  useChatSpeechPlayback,
} from './useChatSpeechPlayback.js'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import {
  ApiError,
  refreshSession,
} from '../../api/authApi.js'
import {
  promoteCreativeChatReply,
} from '../../api/biographyApi.js'
import {
  createMemoryChatConversation,
  getMemoryChatHistory,
  sendMemoryChatMessage,
} from '../../api/chatApi.js'
import './MemoryChatPage.css'

const CHAT_MESSAGE_MAX_LENGTH = 2000

const BIOGRAPHY_QUESTION_MAX_LENGTH = 300

const BIOGRAPHY_ANSWER_MAX_LENGTH = 4000

const CREATIVE_REQUEST_PREFIX =
  'הצג הדמיה יצירתית עבור השאלה: '

const initialPagination = {
  limit: 50,
  hasMore: false,
  nextBeforeMessageId: null,
}

const answerClassifications =
  Object.freeze({
    grounded: {
      label: 'מבוסס על מקורות',
      description:
        'התשובה נתמכת ישירות במקורות מאושרים.',
    },

    inferred: {
      label: 'הסקה ממקורות',
      description:
        'זוהי הסקה זהירה המבוססת על מקורות מאושרים.',
    },

    general_knowledge: {
      label: 'מידע כללי',
      description:
        'זהו מידע כללי שאינו מוצג כעובדה על האדם.',
    },

    creative: {
      label: 'הדמיה יצירתית',
      description:
        'זוהי אפשרות דמיונית ולא מידע שהופיע במקורות.',
    },

    insufficient_context: {
      label: 'אין מידע מספיק',
      description:
        'במקורות המאושרים אין מידע שמאפשר לענות בוודאות.',
    },
  })

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    CHAT_MESSAGE_NOT_FOUND:
      'הודעת הצ׳אט לא נמצאה או שאינה זמינה להשמעה.',
    CHAT_MESSAGE_NOT_SPEAKABLE:
      'התשובה ארוכה מדי או שאינה מתאימה להשמעה.',
    AI_SPEECH_RATE_LIMITED:
      'בוצעו יותר מדי בקשות השמעה בזמן קצר. המתינו מעט ונסו שוב.',
    AI_SPEECH_PROVIDER_ERROR:
      'שירות הקול אינו זמין כרגע. נסו שוב מאוחר יותר.',
    AI_SPEECH_INVALID_RESPONSE:
      'שירות הקול החזיר קובץ אודיו לא תקין.',
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לבצע את הפעולה.',
    CHAT_CONVERSATION_NOT_FOUND:
      'השיחה לא נמצאה או שאינה זמינה יותר.',
    CREATIVE_CHAT_MESSAGE_NOT_FOUND:
      'התשובה היצירתית לא נמצאה או שאינה זמינה לשמירה.',
    BIOGRAPHY_SOURCE_EXISTS:
      'התשובה כבר נשמרה במאגר המקורות.',
    INVALID_CHAT_HISTORY_CURSOR:
      'לא ניתן לטעון את החלק הקודם של השיחה.',
    CHAT_RATE_LIMITED:
      'נשלחו יותר מדי הודעות בזמן קצר. המתינו מעט ונסו שוב.',
    AI_PROVIDER_ERROR:
      'שירות הבינה המלאכותית אינו זמין כרגע. נסו שוב מאוחר יותר.',
    AI_INVALID_RESPONSE:
      'התקבלה תשובה לא תקינה משירות הבינה המלאכותית.',
    VALIDATION_ERROR:
      'המידע שנשלח אינו תקין.',
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

function formatMessageTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date)
}

function mergeEarlierMessages(
  earlierMessages,
  currentMessages,
) {
  const currentIds = new Set(
    currentMessages.map(
      (chatMessage) => chatMessage.id,
    ),
  )

  return [
    ...earlierMessages.filter(
      (chatMessage) =>
        !currentIds.has(chatMessage.id),
    ),
    ...currentMessages,
  ]
}

function findPreviousUserQuestion(
  messages,
  messageIndex,
) {
  for (
    let index = messageIndex - 1;
    index >= 0;
    index -= 1
  ) {
    const previousMessage =
      messages[index]

    if (previousMessage.role !== 'user') {
      continue
    }

    const content =
      previousMessage.content.trim()

    if (
      content.startsWith(
        CREATIVE_REQUEST_PREFIX,
      )
    ) {
      return content
        .slice(
          CREATIVE_REQUEST_PREFIX.length,
        )
        .trim()
    }

    return content
  }

  return ''
}

function getAssistantName(
  groundingStatus,
  subjectName,
) {
  if (
    groundingStatus ===
    'general_knowledge'
  ) {
    return 'מידע כללי'
  }

  if (groundingStatus === 'creative') {
    return 'הדמיית AI'
  }

  if (
    groundingStatus ===
    'insufficient_context'
  ) {
    return 'זיכרון חי'
  }

  return subjectName
}

function getClassificationClassName(
  groundingStatus,
) {
  return groundingStatus
    .replaceAll('_', '-')
}

function MemoryChatPage({
  authentication,
  onAuthenticationChange,
}) {
  const {
    memoryId,
    conversationId,
  } = useParams()

  const location = useLocation()
  const navigate = useNavigate()

  const messageEndRef = useRef(null)

  const conversationCreationRef =
    useRef({
      memoryId: null,
      request: null,
    })

  const [conversation, setConversation] =
    useState(null)

  const [messages, setMessages] =
    useState([])

  const [pagination, setPagination] =
    useState(initialPagination)

  const [message, setMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSending, setIsSending] =
    useState(false)

  const [
    isLoadingEarlier,
    setIsLoadingEarlier,
  ] = useState(false)

  const [
    creativeRequestMessageId,
    setCreativeRequestMessageId,
  ] = useState(null)

  const [
    creativeRequestError,
    setCreativeRequestError,
  ] = useState(null)

  const [
    promotionForm,
    setPromotionForm,
  ] = useState(null)

  const [
    promotedMessageIds,
    setPromotedMessageIds,
  ] = useState(() => new Set())

  const [errorMessage, setErrorMessage] =
    useState('')

  const [
    sendErrorMessage,
    setSendErrorMessage,
  ] = useState('')

  const subjectName =
    typeof location.state?.subjectName ===
      'string' &&
      location.state.subjectName.trim()
      ? location.state.subjectName.trim()
      : 'הזיכרון'

  const runAuthenticatedRequest = useCallback(
    async (operation) => {
      try {
        return await operation(
          authentication.accessToken,
        )
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          error.statusCode !== 401
        ) {
          throw error
        }

        try {
          const restoredAuthentication =
            await refreshSession()

          onAuthenticationChange(
            restoredAuthentication,
          )

          return await operation(
            restoredAuthentication.accessToken,
          )
        } catch (refreshError) {
          onAuthenticationChange(null)

          navigate('/login', {
            replace: true,
          })

          throw refreshError
        }
      }
    },
    [
      authentication.accessToken,
      navigate,
      onAuthenticationChange,
    ],
  )
  const {
    speechState,
    toggleSpeech,
  } = useChatSpeechPlayback({
    memoryId,
    conversationId:
      conversation?.id ??
      conversationId,
    runAuthenticatedRequest,
    getErrorMessage,
  })

  useEffect(() => {
    let isActive = true

    async function loadConversation() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        let loadedConversation
        let loadedMessages = []
        let loadedPagination =
          initialPagination

        if (conversationId) {
          const history =
            await runAuthenticatedRequest(
              (accessToken) =>
                getMemoryChatHistory(
                  accessToken,
                  memoryId,
                  conversationId,
                ),
            )

          loadedConversation =
            history.conversation

          loadedMessages =
            history.messages

          loadedPagination =
            history.pagination
        } else {
          if (
            conversationCreationRef
              .current.memoryId !==
            memoryId ||
            !conversationCreationRef
              .current.request
          ) {
            conversationCreationRef.current = {
              memoryId,
              request:
                runAuthenticatedRequest(
                  (accessToken) =>
                    createMemoryChatConversation(
                      accessToken,
                      memoryId,
                    ),
                ),
            }
          }

          loadedConversation =
            await conversationCreationRef
              .current.request
        }

        if (!isActive) {
          return
        }

        setConversation(
          loadedConversation,
        )
        setMessages(loadedMessages)
        setPagination(loadedPagination)

        if (!conversationId) {
          navigate(
            `/app/memories/${encodeURIComponent(memoryId)}/chat/${encodeURIComponent(loadedConversation.id)}`,
            {
              replace: true,
              state: {
                subjectName,
              },
            },
          )
        }
      } catch (error) {
        if (
          !conversationId &&
          conversationCreationRef
            .current.memoryId === memoryId
        ) {
          conversationCreationRef.current = {
            memoryId: null,
            request: null,
          }
        }

        if (isActive) {
          setErrorMessage(
            getErrorMessage(error),
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadConversation()

    return () => {
      isActive = false
    }
  }, [
    conversationId,
    memoryId,
    navigate,
    runAuthenticatedRequest,
    subjectName,
  ])

  const lastMessageId =
    messages.length > 0
      ? messages[messages.length - 1].id
      : null

  useEffect(() => {
    if (!lastMessageId) {
      return
    }

    messageEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [lastMessageId])

  function appendExchange(exchange) {
    setConversation(
      exchange.conversation,
    )

    setMessages((current) => [
      ...current,
      exchange.userMessage,
      exchange.assistantMessage,
    ])
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const normalizedMessage =
      message.trim()

    if (
      !normalizedMessage ||
      !conversation ||
      isSending
    ) {
      return
    }

    setIsSending(true)
    setSendErrorMessage('')

    try {
      const exchange =
        await runAuthenticatedRequest(
          (accessToken) =>
            sendMemoryChatMessage(
              accessToken,
              memoryId,
              conversation.id,
              normalizedMessage,
            ),
        )

      appendExchange(exchange)
      setMessage('')
    } catch (error) {
      setSendErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setIsSending(false)
    }
  }

  async function handleCreativeRequest(
    insufficientMessage,
    question,
  ) {
    if (
      !conversation ||
      !question ||
      isSending
    ) {
      return
    }

    const availableQuestionLength =
      CHAT_MESSAGE_MAX_LENGTH -
      CREATIVE_REQUEST_PREFIX.length

    const boundedQuestion =
      question
        .slice(
          0,
          availableQuestionLength,
        )
        .trim()

    if (!boundedQuestion) {
      return
    }

    setIsSending(true)
    setCreativeRequestMessageId(
      insufficientMessage.id,
    )
    setCreativeRequestError(null)

    try {
      const exchange =
        await runAuthenticatedRequest(
          (accessToken) =>
            sendMemoryChatMessage(
              accessToken,
              memoryId,
              conversation.id,
              `${CREATIVE_REQUEST_PREFIX}${boundedQuestion}`,
              {
                responseMode: 'creative',
              },
            ),
        )

      appendExchange(exchange)
    } catch (error) {
      setCreativeRequestError({
        messageId:
          insufficientMessage.id,
        text: getErrorMessage(error),
      })
    } finally {
      setCreativeRequestMessageId(null)
      setIsSending(false)
    }
  }

  function openPromotionForm(
    creativeMessage,
    question,
  ) {
    setPromotionForm({
      messageId: creativeMessage.id,
      question:
        question
          .slice(
            0,
            BIOGRAPHY_QUESTION_MAX_LENGTH,
          )
          .trim() ||
        'מידע ביוגרפי מתוך השיחה',
      answer:
        creativeMessage.content
          .slice(
            0,
            BIOGRAPHY_ANSWER_MAX_LENGTH,
          )
          .trim(),
      confirmed: false,
      isSaving: false,
      error: '',
    })
  }

  function closePromotionForm() {
    setPromotionForm(null)
  }

  function updatePromotionForm(
    field,
    value,
  ) {
    setPromotionForm((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [field]: value,
        error: '',
      }
    })
  }

  function markMessageAsPromoted(
    messageId,
  ) {
    setPromotedMessageIds(
      (current) => {
        const updated = new Set(current)
        updated.add(messageId)
        return updated
      },
    )
  }

  async function handlePromotionSubmit(
    event,
  ) {
    event.preventDefault()

    if (
      !promotionForm ||
      promotionForm.isSaving
    ) {
      return
    }

    const normalizedQuestion =
      promotionForm.question.trim()

    const normalizedAnswer =
      promotionForm.answer.trim()

    if (
      !normalizedQuestion ||
      !normalizedAnswer ||
      !promotionForm.confirmed
    ) {
      setPromotionForm(
        (current) => ({
          ...current,
          error:
            'יש לערוך לפי הצורך ולאשר שהמידע תואם למציאות.',
        }),
      )

      return
    }

    setPromotionForm(
      (current) => ({
        ...current,
        isSaving: true,
        error: '',
      }),
    )

    try {
      await runAuthenticatedRequest(
        (accessToken) =>
          promoteCreativeChatReply(
            accessToken,
            memoryId,
            promotionForm.messageId,
            {
              question:
                normalizedQuestion,
              answer:
                normalizedAnswer,
            },
          ),
      )

      markMessageAsPromoted(
        promotionForm.messageId,
      )

      setPromotionForm(null)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code ===
        'BIOGRAPHY_SOURCE_EXISTS'
      ) {
        markMessageAsPromoted(
          promotionForm.messageId,
        )

        setPromotionForm(null)
        return
      }

      setPromotionForm(
        (current) => ({
          ...current,
          isSaving: false,
          error: getErrorMessage(error),
        }),
      )
    }
  }

  async function handleLoadEarlier() {
    if (
      !conversation ||
      !pagination.hasMore ||
      !pagination.nextBeforeMessageId ||
      isLoadingEarlier
    ) {
      return
    }

    setIsLoadingEarlier(true)
    setSendErrorMessage('')

    try {
      const history =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryChatHistory(
              accessToken,
              memoryId,
              conversation.id,
              {
                limit: pagination.limit,
                beforeMessageId:
                  pagination
                    .nextBeforeMessageId,
              },
            ),
        )

      setMessages((current) =>
        mergeEarlierMessages(
          history.messages,
          current,
        ),
      )

      setPagination(
        history.pagination,
      )
    } catch (error) {
      setSendErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setIsLoadingEarlier(false)
    }
  }

  function handleComposerKeyDown(event) {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }

    event.preventDefault()

    if (
      message.trim() &&
      !isSending
    ) {
      event.currentTarget.form
        ?.requestSubmit()
    }
  }

  if (isLoading) {
    return (
      <main className="chat-page-shell">
        <section
          className="chat-state-card"
          aria-live="polite"
        >
          <span
            className="chat-loading-indicator"
            aria-hidden="true"
          />

          <p>פותחים את השיחה...</p>
        </section>
      </main>
    )
  }

  if (
    errorMessage &&
    !conversation
  ) {
    return (
      <main className="chat-page-shell">
        <section className="chat-state-card">
          <h1>לא ניתן לפתוח את השיחה</h1>

          <p role="alert">
            {errorMessage}
          </p>

          <Link
            className="chat-secondary-link"
            to={`/app/memories/${encodeURIComponent(memoryId)}`}
          >
            חזרה לזיכרון
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="chat-page-shell">
      <section
        className="memory-chat-page"
        aria-labelledby="memory-chat-title"
      >
        <header className="chat-page-header">
          <div>
            <Link
              className="chat-back-link"
              to={`/app/memories/${encodeURIComponent(memoryId)}`}
            >
              חזרה לזיכרון
            </Link>

            <p className="chat-eyebrow">
              זיכרון חי
            </p>

            <h1 id="memory-chat-title">
              שיחה עם {subjectName}
            </h1>
          </div>

          <span className="chat-text-badge">
            טקסט וקול AI
          </span>
        </header>

        <aside
          className="chat-ai-disclosure"
          aria-label="הבהרה חשובה"
        >
          <span aria-hidden="true">AI</span>

          <p>
            זוהי הדמיה מבוססת בינה מלאכותית
            הנשענת על חומרים שנמסרו ואושרו.
            אין מדובר באדם עצמו. אפשר להשמיע
            את התשובות בקול AI כללי ומלאכותי;
            אין זה קולו האמיתי או חיקוי קולו
            של האדם. תשובות המסומנות כהדמיה
            יצירתית אינן עובדות עד שהמשתמש
            בודק ומאשר אותן.
          </p>
        </aside>

        <section
          className="chat-window"
          aria-label="הודעות השיחה"
        >
          {pagination.hasMore && (
            <button
              className="load-earlier-button"
              type="button"
              disabled={isLoadingEarlier}
              onClick={handleLoadEarlier}
            >
              {isLoadingEarlier
                ? 'טוענים...'
                : 'טעינת הודעות קודמות'}
            </button>
          )}

          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <span aria-hidden="true">
                ✦
              </span>

              <h2>אפשר להתחיל לשאול</h2>

              <p>
                המערכת תבחין בין מידע
                המבוסס על מקורות, הסקה
                זהירה, מידע כללי והדמיה
                יצירתית.
              </p>
            </div>
          ) : (
            <ol
              className="chat-message-list"
              aria-live="polite"
            >
              {messages.map(
                (
                  chatMessage,
                  messageIndex,
                ) => {
                  const classification =
                    answerClassifications[
                    chatMessage
                      .groundingStatus
                    ]

                  const statusClassName =
                    classification
                      ? getClassificationClassName(
                        chatMessage
                          .groundingStatus,
                      )
                      : ''

                  const previousQuestion =
                    findPreviousUserQuestion(
                      messages,
                      messageIndex,
                    )

                  const canRequestCreative =
                    chatMessage.role ===
                    'assistant' &&
                    chatMessage
                      .groundingStatus ===
                    'insufficient_context' &&
                    previousQuestion.length > 0

                  const isCreative =
                    chatMessage.role ===
                    'assistant' &&
                    chatMessage
                      .groundingStatus ===
                    'creative'

                  const isPromoted =
                    promotedMessageIds.has(
                      chatMessage.id,
                    )

                  const isPromotionOpen =
                    promotionForm
                      ?.messageId ===
                    chatMessage.id

                  return (
                    <li
                      className={[
                        'chat-message',
                        `chat-message-${chatMessage.role}`,
                        statusClassName
                          ? `chat-answer-state-${statusClassName}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={chatMessage.id}
                    >
                      <div className="chat-message-heading">
                        <strong>
                          {chatMessage.role ===
                            'user'
                            ? 'אתם'
                            : getAssistantName(
                              chatMessage
                                .groundingStatus,
                              subjectName,
                            )}
                        </strong>

                        <time
                          dateTime={
                            chatMessage.createdAt
                          }
                        >
                          {formatMessageTime(
                            chatMessage.createdAt,
                          )}
                        </time>
                      </div>

                      {classification && (
                        <span
                          className={`chat-answer-badge chat-answer-badge-${statusClassName}`}
                          title={
                            classification.description
                          }
                        >
                          {classification.label}
                        </span>
                      )}

                      <p>
                        {chatMessage.content}
                      </p>

                      {chatMessage.role ===
                        'assistant' && (
                          <ChatMessageSpeechButton
                            messageId={
                              chatMessage.id
                            }
                            speechState={
                              speechState
                            }
                            onToggle={
                              toggleSpeech
                            }
                          />
                        )}

                      {chatMessage.role ===
                        'assistant' &&
                        chatMessage.citations
                          ?.length > 0 && (
                          <details className="chat-citations">
                            <summary>
                              המקורות לתשובה
                            </summary>

                            <ul>
                              {chatMessage.citations.map(
                                (
                                  citation,
                                  index,
                                ) => (
                                  <li
                                    key={`${citation.sourceType}:${citation.sourceId}:${index}`}
                                  >
                                    <strong>
                                      {
                                        citation.title
                                      }
                                    </strong>

                                    {citation.excerpt && (
                                      <p>
                                        {
                                          citation.excerpt
                                        }
                                      </p>
                                    )}
                                  </li>
                                ),
                              )}
                            </ul>
                          </details>
                        )}

                      {canRequestCreative && (
                        <div className="chat-message-actions">
                          <p className="chat-action-note">
                            אפשר לבקש אפשרות
                            דמיונית. היא לא
                            תיחשב לעובדה ולא
                            תשמש כמקור בלי
                            אישור מפורש.
                          </p>

                          <button
                            className="chat-action-button"
                            type="button"
                            disabled={isSending}
                            onClick={() =>
                              handleCreativeRequest(
                                chatMessage,
                                previousQuestion,
                              )
                            }
                          >
                            {creativeRequestMessageId ===
                              chatMessage.id
                              ? 'יוצרים הדמיה...'
                              : 'הצגת הדמיה יצירתית'}
                          </button>

                          {creativeRequestError
                            ?.messageId ===
                            chatMessage.id && (
                              <p
                                className="chat-action-error"
                                role="alert"
                              >
                                {
                                  creativeRequestError.text
                                }
                              </p>
                            )}
                        </div>
                      )}

                      {isCreative &&
                        !isPromoted &&
                        !isPromotionOpen && (
                          <div className="chat-message-actions">
                            <p className="chat-action-note">
                              האם התשובה תואמת
                              למה שאתם יודעים?
                              אפשר לערוך ולאשר
                              אותה כמקור
                              ביוגרפי.
                            </p>

                            <button
                              className="chat-action-button chat-action-button-creative"
                              type="button"
                              onClick={() =>
                                openPromotionForm(
                                  chatMessage,
                                  previousQuestion,
                                )
                              }
                            >
                              הוספה למאגר המקורות
                            </button>
                          </div>
                        )}

                      {isCreative &&
                        isPromoted && (
                          <p
                            className="chat-promoted-notice"
                            role="status"
                          >
                            נוסף למקורות
                            הביוגרפיים המאושרים
                          </p>
                        )}

                      {isPromotionOpen && (
                        <form
                          className="creative-source-form"
                          onSubmit={
                            handlePromotionSubmit
                          }
                        >
                          <div className="creative-source-heading">
                            <strong>
                              בדיקה לפני הוספה
                              למקורות
                            </strong>

                            <p>
                              הטקסט נוצר
                              כהדמיה. ערכו אותו
                              כך שישקף מידע
                              אמיתי בלבד.
                            </p>
                          </div>

                          <label>
                            כותרת או שאלה
                            ביוגרפית

                            <input
                              type="text"
                              value={
                                promotionForm.question
                              }
                              maxLength={
                                BIOGRAPHY_QUESTION_MAX_LENGTH
                              }
                              disabled={
                                promotionForm.isSaving
                              }
                              onChange={(
                                event,
                              ) =>
                                updatePromotionForm(
                                  'question',
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </label>

                          <label>
                            המידע שיישמר כמקור

                            <textarea
                              value={
                                promotionForm.answer
                              }
                              rows={5}
                              maxLength={
                                BIOGRAPHY_ANSWER_MAX_LENGTH
                              }
                              disabled={
                                promotionForm.isSaving
                              }
                              onChange={(
                                event,
                              ) =>
                                updatePromotionForm(
                                  'answer',
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </label>

                          <label className="creative-source-confirmation">
                            <input
                              type="checkbox"
                              checked={
                                promotionForm.confirmed
                              }
                              disabled={
                                promotionForm.isSaving
                              }
                              onChange={(
                                event,
                              ) =>
                                updatePromotionForm(
                                  'confirmed',
                                  event.target
                                    .checked,
                                )
                              }
                            />

                            <span>
                              בדקתי את הנוסח
                              ואני מאשר שהמידע
                              תואם למציאות.
                            </span>
                          </label>

                          {promotionForm.error && (
                            <p
                              className="chat-action-error"
                              role="alert"
                            >
                              {
                                promotionForm.error
                              }
                            </p>
                          )}

                          <div className="creative-source-actions">
                            <button
                              className="chat-action-button chat-action-button-creative"
                              type="submit"
                              disabled={
                                promotionForm.isSaving ||
                                !promotionForm.confirmed ||
                                !promotionForm
                                  .question
                                  .trim() ||
                                !promotionForm
                                  .answer
                                  .trim()
                              }
                            >
                              {promotionForm.isSaving
                                ? 'שומרים...'
                                : 'אישור ושמירה כמקור'}
                            </button>

                            <button
                              className="chat-action-button chat-action-button-secondary"
                              type="button"
                              disabled={
                                promotionForm.isSaving
                              }
                              onClick={
                                closePromotionForm
                              }
                            >
                              ביטול
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  )
                },
              )}
            </ol>
          )}

          <div ref={messageEndRef} />
        </section>

        <form
          className="chat-composer"
          onSubmit={handleSendMessage}
          aria-busy={isSending}
        >
          <label htmlFor="chat-message">
            כתיבת הודעה
          </label>

          <textarea
            id="chat-message"
            value={message}
            rows={3}
            maxLength={
              CHAT_MESSAGE_MAX_LENGTH
            }
            placeholder="כתבו שאלה על הזיכרונות והסיפורים המאושרים..."
            dir="auto"
            disabled={isSending}
            onChange={(event) =>
              setMessage(
                event.target.value,
              )
            }
            onKeyDown={
              handleComposerKeyDown
            }
          />

          <div className="chat-composer-footer">
            <span>
              {message.length}/
              {CHAT_MESSAGE_MAX_LENGTH}
            </span>

            <button
              type="submit"
              disabled={
                isSending ||
                !message.trim()
              }
            >
              {isSending
                ? 'שולחים...'
                : 'שליחת הודעה'}
            </button>
          </div>

          {sendErrorMessage && (
            <p
              className="chat-send-error"
              role="alert"
            >
              {sendErrorMessage}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}

export default MemoryChatPage
