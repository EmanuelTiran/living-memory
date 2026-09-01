import ChatAvatarStage from './ChatAvatarStage.jsx'
import ChatMessageSpeechButton from './ChatMessageSpeechButton.jsx'
import {
  useChatSpeechPlayback,
} from './useChatSpeechPlayback.js'
import {
  useDIDRealtimeAvatar,
} from './useDIDRealtimeAvatar.js'
import {
  useChatVoiceInput,
} from './useChatVoiceInput.js'
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
  pilotAvatarEnabled,
} from '../../config/pilotFeatures.js'
import {
  promoteCreativeChatReply,
} from '../../api/biographyApi.js'
import {
  getDigitalPersonaSetup,
} from '../../api/memoryApi.js'
import {
  getMemoryRecordingAudio,
} from '../../api/recordingApi.js'
import {
  createMemoryAssetAccessLink,
} from '../../api/assetApi.js'
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
      label: 'VERIFIED · מאומת',
      description:
        'התשובה נאמרה במפורש במקור מאושר.',
    },

    inferred: {
      label: 'INFERRED · הסקה זהירה',
      description:
        'זוהי סינתזה זהירה של מקורות מאושרים, ולא ציטוט ישיר.',
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
      label: 'UNKNOWN · אין מידע בארכיון',
      description:
        'הארכיון אינו מכיל מידע מאושר שמאפשר לענות בלי להמציא.',
    },
  })

const sourceTypeLabels =
  Object.freeze({
    recording_transcript:
      'הקלטה ותמלול מאושרים',
    memory_story:
      'סיפור כתוב מאושר',
    biography_answer:
      'תשובה ביוגרפית מאושרת',
    memory_profile:
      'פרטי הארכיון',
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
    VOICE_CLONE_NOT_CONFIGURED:
      'שירות הקול האישי עדיין אינו מוגדר בשרת.',
    VOICE_CLONE_AUTHENTICATION_FAILED:
      'ElevenLabs דחה את מפתח הגישה. בדקו את ה־API Key והרשאות Text to Speech.',
    VOICE_CLONE_BILLING_REQUIRED:
      'אין כרגע יתרה זמינה ב־ElevenLabs להפעלת הקול האישי.',
    VOICE_CLONE_RATE_LIMITED:
      'שירות הקול האישי עמוס כרגע. המתינו מעט ונסו שוב.',
    VOICE_CLONE_PROVIDER_TIMEOUT:
      'הכנת הקול האישי ארכה יותר מדי זמן. נסו שוב.',
    VOICE_CLONE_PROVIDER_ERROR:
      'שירות הקול האישי אינו זמין כרגע.',
    VOICE_CLONE_INVALID_RESPONSE:
      'שירות הקול האישי החזיר קובץ אודיו לא תקין.',
    VOICE_CLONE_PROFILE_UNAVAILABLE:
      'שכפול הקול המאושר אינו זמין. בדקו את הגדרות הקול בפרופיל.',
    VOICE_CLONE_TEXT_TOO_LONG:
      'התשובה ארוכה מ־2,000 תווים. בקשו תשובה קצרה יותר ואז נסו להשמיע שוב.',
    CHAT_VOICE_INPUT_CONSENT_REQUIRED:
      'הקלט הקולי עדיין לא אושר. פתחו את פרופיל הזיכרון ואשרו את סעיפי OpenAI.',
    CHAT_VOICE_INPUT_NOT_CONFIGURED:
      'שירות התמלול הקולי עדיין אינו מוגדר בשרת.',
    CHAT_VOICE_INPUT_RATE_LIMITED:
      'בוצעו יותר מדי תמלולים בזמן קצר. המתינו מעט ונסו שוב.',
    CHAT_VOICE_INPUT_FILE_TOO_LARGE:
      'ההקלטה גדולה מדי. הקליטו שאלה קצרה יותר.',
    CHAT_VOICE_INPUT_REQUIRED:
      'לא התקבל קובץ קול. נסו להקליט שוב.',
    CHAT_VOICE_INPUT_TYPE_UNSUPPORTED:
      'הדפדפן יצר קובץ קול שאינו נתמך.',
    CHAT_VOICE_INPUT_CONTENT_INVALID:
      'קובץ הקול שהתקבל אינו תקין.',
    CHAT_VOICE_INPUT_EMPTY_TRANSCRIPT:
      'לא זוהה דיבור בהקלטה. נסו שוב בחדר שקט.',
    CHAT_VOICE_INPUT_TRANSCRIPT_TOO_LONG:
      'התמלול ארוך מדי לשדה ההודעה. הקליטו שאלה קצרה יותר.',
    CHAT_VOICE_INPUT_INVALID_RESPONSE:
      'שירות התמלול החזיר תשובה לא תקינה.',
    TRANSCRIPTION_PROVIDER_TIMEOUT:
      'התמלול ארך יותר מדי זמן. נסו שוב.',
    TRANSCRIPTION_PROVIDER_UNAVAILABLE:
      'שירות התמלול עמוס כרגע. המתינו מעט ונסו שוב.',
    TRANSCRIPTION_PROVIDER_ERROR:
      'לא הצלחנו לתמלל את ההקלטה כרגע.',
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
    RECORDING_NOT_FOUND:
      'ההקלטה המקורית אינה זמינה יותר.',
    RECORDING_PLAYBACK_NOT_CONSENTED:
      'לא ניתנה הרשאה להשמעת ההקלטה המקורית.',
    RECORDING_FILE_UNAVAILABLE:
      'קובץ ההקלטה המקורית אינו זמין כרגע.',
    RECORDING_FILE_NOT_FOUND:
      'קובץ ההקלטה המקורית לא נמצא.',
    RECORDING_INTEGRITY_FAILED:
      'בדיקת תקינות ההקלטה נכשלה ולכן היא לא הושמעה.',
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

function formatSourceDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'medium',
    },
  ).format(date)
}

function formatRecordingTime(seconds) {
  const safeSeconds = Math.max(
    0,
    Number.isFinite(seconds)
      ? Math.floor(seconds)
      : 0,
  )

  const minutes = Math.floor(
    safeSeconds / 60,
  )

  return `${String(minutes).padStart(
    2,
    '0',
  )}:${String(safeSeconds % 60).padStart(
    2,
    '0',
  )}`
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
  const composerRef = useRef(null)
  const citationAudioUrlRegistryRef =
    useRef(new Map())

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
    promotionForm,
    setPromotionForm,
  ] = useState(null)

  const [
    promotedMessageIds,
    setPromotedMessageIds,
  ] = useState(() => new Set())

  const [errorMessage, setErrorMessage] =
    useState('')

  const [digitalPersonaSetup, setDigitalPersonaSetup] =
    useState(null)

  const [
    liveConversationEnabled,
    setLiveConversationEnabled,
  ] = useState(false)

  const [
    sendErrorMessage,
    setSendErrorMessage,
  ] = useState('')

  const [
    citationAudioUrls,
    setCitationAudioUrls,
  ] = useState({})

  const [
    citationAudioErrors,
    setCitationAudioErrors,
  ] = useState({})

  const [
    loadingCitationRecordingId,
    setLoadingCitationRecordingId,
  ] = useState('')

  const subjectName =
    typeof location.state?.subjectName ===
      'string' &&
      location.state.subjectName.trim()
      ? location.state.subjectName.trim()
      : 'הזיכרון'

  const starterQuestions = [
    `מה מספרים המקורות על הילדות של ${subjectName}?`,
    `מי האנשים שהשפיעו במיוחד על ${subjectName}?`,
    `איזה רגע מכונן כבר נשמר בסיפור של ${subjectName}?`,
  ]

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

  const handleVoiceTranscript = useCallback(
    (transcript) => {
      const normalizedTranscript =
        transcript.trim()

      if (!normalizedTranscript) {
        return
      }

      setMessage((current) => {
        const normalizedCurrent =
          current.trimEnd()

        const combined =
          normalizedCurrent
            ? `${normalizedCurrent}\n${normalizedTranscript}`
            : normalizedTranscript

        return combined.slice(
          0,
          CHAT_MESSAGE_MAX_LENGTH,
        )
      })

      window.requestAnimationFrame(() => {
        composerRef.current?.focus()
      })
    },
    [],
  )

  const realtimeAvatar =
    useDIDRealtimeAvatar({
      config:
        digitalPersonaSetup?.avatar
          ?.realtime,
      enabled:
        pilotAvatarEnabled &&
        liveConversationEnabled &&
        digitalPersonaSetup?.avatar
          ?.active === true,
    })

  const {
    speechState,
    avatarState,
    toggleSpeech,
    stopSpeech,
  } = useChatSpeechPlayback({
    memoryId,
    conversationId:
      conversation?.id ??
      conversationId,
    runAuthenticatedRequest,
    getErrorMessage,
    realtimeAvatar,
  })

  const chatVoiceInput =
    digitalPersonaSetup?.chatVoiceInput

  const voiceInputState =
    useChatVoiceInput({
      active:
        chatVoiceInput?.active === true,
      maxDurationSeconds:
        chatVoiceInput
          ?.maxDurationSeconds ?? 60,
      maxFileSizeBytes:
        chatVoiceInput
          ?.maxFileSizeBytes ??
        10 * 1024 * 1024,
      memoryId,
      runAuthenticatedRequest,
      onTranscript:
        handleVoiceTranscript,
      getErrorMessage,
    })

  useEffect(() => {
    let isActive = true

    async function loadDigitalPersona() {
      try {
        let loadedSetup =
          await runAuthenticatedRequest(
            (accessToken) =>
              getDigitalPersonaSetup(
                accessToken,
                memoryId,
              ),
          )

        const portraitAssetId =
          loadedSetup?.avatar
            ?.portraitAssetId

        if (portraitAssetId) {
          const portraitAccess =
            await runAuthenticatedRequest(
              (accessToken) =>
                createMemoryAssetAccessLink(
                  accessToken,
                  memoryId,
                  portraitAssetId,
                  'inline',
                ),
            )

          loadedSetup = {
            ...loadedSetup,
            avatar: {
              ...loadedSetup.avatar,
              localAssetUrl:
                portraitAccess.url,
            },
          }
        }

        if (isActive) {
          setDigitalPersonaSetup(loadedSetup)
        }
      } catch {
        if (isActive) {
          setDigitalPersonaSetup(null)
        }
      }
    }

    loadDigitalPersona()

    return () => {
      isActive = false
    }
  }, [memoryId, runAuthenticatedRequest])

  useEffect(() => {
    const registry =
      citationAudioUrlRegistryRef.current

    return () => {
      for (const url of registry.values()) {
        URL.revokeObjectURL(url)
      }

      registry.clear()
    }
  }, [])

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

  function startLiveAssistantResponse(
    assistantMessage,
  ) {
    if (
      !liveConversationEnabled ||
      digitalPersonaSetup?.voiceClone
        ?.active !== true ||
      !assistantMessage?.id
    ) {
      return
    }

    void toggleSpeech(
      assistantMessage.id,
      {
        requestAvatarVideo:
          digitalPersonaSetup?.avatar
            ?.active === true &&
          digitalPersonaSetup?.avatar
            ?.realtime?.available !==
            true,
        requestRealtimeAvatar:
          digitalPersonaSetup?.avatar
            ?.active === true &&
          digitalPersonaSetup?.avatar
            ?.realtime?.available ===
            true,
      },
    )
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const normalizedMessage =
      message.trim()

    if (
      !normalizedMessage ||
      !conversation ||
      isSending ||
      voiceInputState.isBusy
    ) {
      return
    }

    setIsSending(true)
    setSendErrorMessage('')
    stopSpeech()

    try {
      const exchange =
        await runAuthenticatedRequest(
          (accessToken) =>
            sendMemoryChatMessage(
              accessToken,
              memoryId,
              conversation.id,
              normalizedMessage,
              {
                responseMode: 'archive',
              },
            ),
        )

      appendExchange(exchange)
      setMessage('')
      voiceInputState.clearFeedback()
      startLiveAssistantResponse(
        exchange.assistantMessage,
      )
    } catch (error) {
      setSendErrorMessage(
        getErrorMessage(error),
      )
    } finally {
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

  async function handleLoadCitationAudio(
    citation,
  ) {
    const recordingId =
      citation.recordingId

    if (
      !recordingId ||
      citationAudioUrls[recordingId]
    ) {
      return
    }

    setLoadingCitationRecordingId(
      recordingId,
    )
    setCitationAudioErrors(
      (current) => ({
        ...current,
        [recordingId]: '',
      }),
    )

    try {
      const audioBlob =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryRecordingAudio(
              accessToken,
              memoryId,
              recordingId,
            ),
        )

      const previousUrl =
        citationAudioUrlRegistryRef
          .current.get(recordingId)

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }

      const audioUrl =
        URL.createObjectURL(audioBlob)

      citationAudioUrlRegistryRef
        .current.set(
          recordingId,
          audioUrl,
        )

      setCitationAudioUrls(
        (current) => ({
          ...current,
          [recordingId]: audioUrl,
        }),
      )
    } catch (error) {
      setCitationAudioErrors(
        (current) => ({
          ...current,
          [recordingId]:
            getErrorMessage(error),
        }),
      )
    } finally {
      setLoadingCitationRecordingId('')
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
      !isSending &&
      !voiceInputState.isBusy
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
            data-aura-tooltip="לחזור לשאלות ולמשפחה בזיכרון"
            to={`/app/memories/${encodeURIComponent(memoryId)}?tab=family`}
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
              data-aura-tooltip="לחזור לשאלות ולמשפחה בזיכרון"
              to={`/app/memories/${encodeURIComponent(memoryId)}?tab=family`}
            >
              חזרה לזיכרון
            </Link>

            <p className="chat-eyebrow">
              שאלו את הסיפור · עם מקור
            </p>

            <h1 id="memory-chat-title">
              מה תרצו לשאול על הסיפור של {subjectName}?
            </h1>
          </div>

          <span className="chat-text-badge">
            תשובה + מקור
          </span>
        </header>

        <aside
          className="chat-ai-disclosure"
          aria-label="הבהרה חשובה"
        >
          <span aria-hidden="true">AI</span>

          <p>
            התשובה נוצרת בידי AI מתוך חומרים
            שנמסרו ואושרו בלבד. כל תשובה מסומנת
            כמאומתת, כהסקה זהירה או כמידע שאינו
            קיים בארכיון. המערכת לא תשלים פרטים
            מהדמיון ואינה האדם עצמו.
          </p>
        </aside>

        {pilotAvatarEnabled && (
          <details className="optional-avatar-experience">
            <summary data-aura-tooltip="לפתוח אפשרויות קול ושיחת וידאו">
              פתיחת אפשרויות קול ושיחת וידאו
            </summary>

            <p>
              שכבה אופציונלית: אפשר לקרוא ולבדוק
              את התשובות גם בלי קול משוכפל או אווטאר.
            </p>

            <ChatAvatarStage
              subjectName={subjectName}
              avatar={digitalPersonaSetup?.avatar}
              speechState={speechState}
              avatarState={avatarState}
              voiceInputPhase={
                voiceInputState.phase
              }
              isSending={isSending}
              liveConversationAvailable={
                digitalPersonaSetup?.voiceClone
                  ?.active === true
              }
              liveConversationEnabled={
                liveConversationEnabled
              }
              onLiveConversationChange={
                setLiveConversationEnabled
              }
              realtimeAvatar={
                realtimeAvatar
              }
            />
          </details>
        )}

        <section
          className="chat-window"
          aria-label="הודעות השיחה"
        >
          {pagination.hasMore && (
            <button
              className="load-earlier-button"
              type="button"
              data-aura-tooltip="לטעון הודעות ישנות יותר בשיחה"
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
                שאלו על אירוע, אדם או תקופה.
                תשובה מבוססת תציג מיד את המקורות
                המאושרים ואת ההקלטה המקורית,
                כאשר ניתנה הרשאת השמעה.
              </p>

              <div
                className="chat-starter-questions"
                aria-label="הצעות לשאלה ראשונה"
              >
                {starterQuestions.map((starterQuestion) => (
                  <button
                    type="button"
                    key={starterQuestion}
                    data-aura-tooltip="להעביר את השאלה לשדה הכתיבה"
                    onClick={() => {
                      setMessage(starterQuestion)

                      window.requestAnimationFrame(() => {
                        composerRef.current?.focus()
                      })
                    }}
                  >
                    {starterQuestion}
                  </button>
                ))}
              </div>
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
                            avatarState={
                              avatarState
                            }
                            didAvatarActive={
                              pilotAvatarEnabled &&
                              digitalPersonaSetup
                                ?.avatar?.active ===
                              true
                            }
                            didRealtimeAvailable={
                              pilotAvatarEnabled &&
                              digitalPersonaSetup
                                ?.avatar
                                ?.realtime
                                ?.available ===
                              true
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
                          <section
                            className="chat-citations"
                            aria-label="מקורות מאושרים לתשובה"
                          >
                            <h3>
                              על מה התשובה מבוססת
                            </h3>

                            <ul>
                              {chatMessage.citations.map(
                                (
                                  citation,
                                  index,
                                ) => {
                                  const audioUrl =
                                    citationAudioUrls[
                                      citation
                                        .recordingId
                                    ] ?? ''

                                  const audioError =
                                    citationAudioErrors[
                                      citation
                                        .recordingId
                                    ] ?? ''

                                  const isLoadingAudio =
                                    loadingCitationRecordingId ===
                                    citation.recordingId

                                  return (
                                    <li
                                      key={`${citation.sourceType}:${citation.sourceId}:${index}`}
                                    >
                                      <span className="chat-citation-type">
                                        {sourceTypeLabels[
                                          citation
                                            .sourceType
                                        ] ??
                                          'מקור מאושר'}
                                      </span>

                                      <strong>
                                        {
                                          citation.title
                                        }
                                      </strong>

                                      {citation.recordedAt && (
                                        <time
                                          dateTime={
                                            citation.recordedAt
                                          }
                                        >
                                          הוקלט בתאריך{' '}
                                          {formatSourceDate(
                                            citation.recordedAt,
                                          )}
                                        </time>
                                      )}

                                      {citation.excerpt && (
                                        <p>
                                          “{
                                            citation.excerpt
                                          }”
                                        </p>
                                      )}

                                      {(citation.sourceRoute ||
                                        (citation.canPlayOriginalAudio &&
                                          citation.recordingId)) && (
                                        <div className="chat-citation-actions">
                                          {citation.sourceRoute && (
                                            <Link
                                              to={
                                                citation.sourceRoute
                                              }
                                              data-aura-tooltip="לפתוח את המקור בתוך הארכיון"
                                              state={{
                                                subjectName,
                                              }}
                                            >
                                              פתיחת המקור בארכיון
                                            </Link>
                                          )}

                                          {citation.canPlayOriginalAudio &&
                                            citation.recordingId &&
                                            !audioUrl && (
                                              <button
                                                type="button"
                                                data-aura-tooltip="לשמוע את ההקלטה המקורית"
                                                disabled={
                                                  isLoadingAudio
                                                }
                                                onClick={() =>
                                                  handleLoadCitationAudio(
                                                    citation,
                                                  )
                                                }
                                              >
                                                {isLoadingAudio
                                                  ? 'טוענים את המקור...'
                                                  : 'השמעת ההקלטה המקורית'}
                                              </button>
                                            )}
                                        </div>
                                      )}

                                      {audioUrl && (
                                        <audio
                                          controls
                                          preload="metadata"
                                          src={audioUrl}
                                          aria-label={`ההקלטה המקורית של המקור: ${citation.title}`}
                                        />
                                      )}

                                      {audioError && (
                                        <p
                                          className="chat-citation-error"
                                          role="alert"
                                        >
                                          {audioError}
                                        </p>
                                      )}
                                    </li>
                                  )
                                },
                              )}
                            </ul>
                          </section>
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
                              data-aura-tooltip="לבדוק ולאשר את התשובה כמקור"
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
                              data-aura-tooltip="לאשר ולשמור את התשובה כמקור"
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
            שאלה לארכיון
          </label>

          <textarea
            id="chat-message"
            ref={composerRef}
            value={message}
            rows={3}
            maxLength={
              CHAT_MESSAGE_MAX_LENGTH
            }
            placeholder={`מה תרצו לדעת על ${subjectName} מתוך הזיכרונות המאושרים?`}
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

          <div className="chat-voice-input">
            <div className="chat-voice-input-controls">
              {chatVoiceInput?.active !==
              true ? (
                <>
                  <button
                    className="chat-voice-button"
                    type="button"
                    disabled
                  >
                    <span aria-hidden="true">
                      🎙️
                    </span>
                    קלט קולי לא מאושר
                  </button>

                  <Link
                    className="chat-voice-settings-link"
                    data-aura-tooltip="לעבור לניהול הסכמות הקול"
                    to={`/app/memories/${encodeURIComponent(memoryId)}?tab=family#optional-ai-layer-title`}
                  >
                    ניהול הסכמות
                  </Link>
                </>
              ) : !voiceInputState
                  .browserSupported ? (
                <button
                  className="chat-voice-button"
                  type="button"
                  disabled
                >
                  המיקרופון אינו נתמך בדפדפן הזה
                </button>
              ) : voiceInputState.phase ===
                'recording' ? (
                <>
                  <button
                    className="chat-voice-button chat-voice-button-recording"
                    type="button"
                    data-aura-tooltip="לעצור ולהכין את השאלה לתמלול"
                    disabled={isSending}
                    onClick={
                      voiceInputState.stopRecording
                    }
                  >
                    <span aria-hidden="true">
                      ■
                    </span>
                    עצירת הקלטה{' '}
                    {formatRecordingTime(
                      voiceInputState
                        .elapsedSeconds,
                    )}
                  </button>

                  <button
                    className="chat-voice-cancel-button"
                    type="button"
                    onClick={
                      voiceInputState
                        .cancelRecording
                    }
                  >
                    ביטול
                  </button>
                </>
              ) : voiceInputState.phase ===
                  'requesting' ? (
                <>
                  <button
                    className="chat-voice-button"
                    type="button"
                    disabled
                  >
                    פותחים את המיקרופון...
                  </button>

                  <button
                    className="chat-voice-cancel-button"
                    type="button"
                    onClick={
                      voiceInputState
                        .cancelRecording
                    }
                  >
                    ביטול
                  </button>
                </>
              ) : voiceInputState.phase ===
                  'transcribing' ? (
                <button
                  className="chat-voice-button"
                  type="button"
                  disabled
                >
                  מתמללים לעברית...
                </button>
              ) : (
                <button
                  className="chat-voice-button"
                  type="button"
                  data-aura-tooltip="להקליט את השאלה בקול"
                  disabled={isSending}
                  onClick={
                    () => {
                      stopSpeech()
                      voiceInputState.startRecording()
                    }
                  }
                >
                  <span aria-hidden="true">
                    🎙️
                  </span>
                  הקלטת שאלה
                </button>
              )}
            </div>

            <p className="chat-voice-privacy-note">
              האודיו זמני ואינו נשמר כזיכרון.
              התמלול לא יישלח עד שתבדקו אותו
              ותלחצו בעצמכם על „שליחת הודעה“.
            </p>

            {voiceInputState.statusMessage && (
              <p
                className="chat-voice-status"
                role="status"
              >
                {
                  voiceInputState
                    .statusMessage
                }
              </p>
            )}

            {voiceInputState.errorMessage && (
              <p
                className="chat-voice-error"
                role="alert"
              >
                {
                  voiceInputState
                    .errorMessage
                }
              </p>
            )}
          </div>

          <div className="chat-composer-footer">
            <span>
              {message.length}/
              {CHAT_MESSAGE_MAX_LENGTH}
            </span>

            <button
              type="submit"
              data-aura-tooltip="לשלוח שאלה המבוססת על מקורות הזיכרון"
              disabled={
                isSending ||
                voiceInputState.isBusy ||
                !message.trim()
              }
            >
              {isSending
                ? 'מחפשים במקורות...'
                : 'שאלת הארכיון'}
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
