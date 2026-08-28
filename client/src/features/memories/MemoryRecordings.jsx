import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/authApi.js'
import {
  approveMemoryRecordingTranscript,
  createMemoryRecording,
  getMemoryRecordingAudio,
  getMemoryRecordingTranscript,
  listMemoryRecordings,
  requestMemoryRecordingTranscription,
  reviseApprovedMemoryRecordingTranscript,
  updateMemoryRecordingTranscript,
  uploadMemoryRecordingFile,
} from '../../api/recordingApi.js'
import './MemoryRecordings.css'

const MAX_RECORDING_SIZE_BYTES = 25 * 1024 * 1024

const SUPPORTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
])

const MIME_TYPE_ALIASES = Object.freeze({
  'audio/mp3': 'audio/mpeg',
  'audio/m4a': 'audio/x-m4a',
  'audio/vnd.wave': 'audio/wav',
  'audio/wave': 'audio/wav',
})

const MIME_TYPES_BY_EXTENSION = Object.freeze({
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/x-m4a',
  wav: 'audio/wav',
  webm: 'audio/webm',
})

const M4A_COMPATIBLE_MIME_TYPES =
  new Set([
    'audio/mp4',
    'audio/x-m4a',
  ])

const INTERVIEW_CATEGORY_LABELS =
  Object.freeze({
    background: 'רקע ומשפחה',
    childhood: 'ילדות',
    education_work:
      'לימודים ועבודה',
    relationships:
      'משפחה וקשרים',
    personality: 'אופי ואישיות',
    preferences:
      'העדפות ותחביבים',
    values: 'ערכים ואמונה',
    life_events: 'תחנות בחיים',
  })

function createInitialForm() {
  return {
    displayName: '',
    languageCode: 'he',
    consentBasis: 'subject_consent',
    storageConsent: false,
    transcriptionConsent: false,
    playbackConsent: false,
    sourceConsent: false,
    voiceImitationConsent: false,
  }
}

function getRecordingErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND: 'הזיכרון לא נמצא או שאין לכם הרשאה לפעולה הזאת.',
    RECORDING_NOT_FOUND: 'ההקלטה לא נמצאה או שאינה זמינה יותר.',
    RECORDING_TRANSCRIPT_NOT_FOUND: 'עדיין לא קיים תמלול להקלטה הזאת.',
    VALIDATION_ERROR: 'חלק מפרטי ההקלטה אינם תקינים.',
    INVALID_RECORDING_UPLOAD: 'קובץ ההקלטה אינו תקין.',
    INVALID_RECORDING_CONTENT: 'תוכן הקובץ אינו תואם לסוג ההקלטה שנבחר.',
    INVALID_RECORDING_FILE_COUNT: 'אפשר להעלות בכל פעם קובץ הקלטה אחד בלבד.',
    RECORDING_FILE_MISMATCH: 'הקובץ שנשלח אינו תואם לפרטי ההקלטה.',
    RECORDING_UPLOAD_UNAVAILABLE: 'לא ניתן להעלות קובץ להקלטה הזאת.',
    RECORDING_FILE_NOT_FOUND: 'קובץ ההקלטה הפרטי לא נמצא.',
    RECORDING_FILE_UNAVAILABLE: 'קובץ ההקלטה המקורית אינו זמין כרגע.',
    RECORDING_PLAYBACK_NOT_CONSENTED: 'לא ניתנה הרשאה להשמעת ההקלטה המקורית.',
    RECORDING_INTEGRITY_FAILED:
      'בדיקת תקינות ההקלטה נכשלה ולכן היא לא הושמעה.',
    RECORDING_CONSENT_REQUIRED: 'לא קיימת ההסכמה הנדרשת לביצוע הפעולה.',
    RECORDING_TRANSCRIPTION_UNAVAILABLE: 'לא ניתן לתמלל את ההקלטה במצבה הנוכחי.',
    RECORDING_TRANSCRIPTION_IN_PROGRESS: 'תמלול ההקלטה כבר מתבצע.',
    RECORDING_TRANSCRIPT_CONFLICT: 'התמלול השתנה בפעולה אחרת. רעננו אותו ונסו שוב.',
    RECORDING_TRANSCRIPT_NOT_APPROVED:
      'התמלול כבר אינו מאושר. רעננו אותו לפני עריכה נוספת.',
    TRANSCRIPTION_AUDIO_FORMAT_INVALID:
      'מבנה קובץ השמע אינו תקין או אינו תואם לסוג שנבחר.',
    TRANSCRIPTION_AUDIO_NORMALIZATION_FAILED:
      'לא הצלחנו להתאים את קובץ השמע לשירות התמלול.',
    TRANSCRIPTION_AUDIO_TOO_LARGE:
      'קובץ השמע גדול מדי לאחר התאמתו לשירות התמלול.',
    TRANSCRIPTION_PROVIDER_TIMEOUT: 'שירות התמלול לא השיב בזמן. אפשר לנסות שוב.',
    TRANSCRIPTION_PROVIDER_UNAVAILABLE:
      'שירות התמלול אינו זמין כרגע. אפשר לנסות שוב מאוחר יותר.',
    TRANSCRIPTION_PROVIDER_ERROR: 'שירות התמלול לא הצליח לעבד את ההקלטה.',
    AI_SERVICE_NOT_CONFIGURED: 'שירות התמלול אינו מוגדר כרגע.',
    AI_SERVICE_TIMEOUT: 'שירות התמלול לא השיב בזמן. אפשר לנסות שוב.',
    AI_SERVICE_RATE_LIMITED: 'שירות התמלול עמוס כרגע. נסו שוב בעוד זמן קצר.',
    AI_SERVICE_UNAVAILABLE: 'שירות התמלול אינו זמין כרגע.',
    AUTHENTICATION_REQUIRED: 'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR: 'לא הצלחנו להתחבר לשרת.',
  }

  return messages[error.code] ?? 'לא הצלחנו להשלים את הפעולה.'
}

function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf('.')

  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
    return ''
  }

  return fileName.slice(lastDotIndex + 1).toLowerCase()
}

function resolveMimeType(file) {
  const declaredType = file.type.toLowerCase()

  if (SUPPORTED_MIME_TYPES.has(declaredType)) {
    return declaredType
  }

  if (MIME_TYPE_ALIASES[declaredType]) {
    return MIME_TYPE_ALIASES[declaredType]
  }

  return MIME_TYPES_BY_EXTENSION[getFileExtension(file.name)] ?? ''
}

function createUploadFile(file, mimeType) {
  if (file.type === mimeType) {
    return file
  }

  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  })
}

function areMimeTypesCompatible(
  firstMimeType,
  secondMimeType,
) {
  return (
    firstMimeType === secondMimeType ||
    (
      M4A_COMPATIBLE_MIME_TYPES.has(
        firstMimeType,
      ) &&
      M4A_COMPATIBLE_MIME_TYPES.has(
        secondMimeType,
      )
    )
  )
}

function removeFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return fileName
  }

  return fileName.slice(0, lastDotIndex)
}

function formatFileSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes)) {
    return ''
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} בתים`
  }

  const sizeInMegabytes = sizeBytes / (1024 * 1024)

  if (sizeInMegabytes >= 1) {
    return `${sizeInMegabytes.toFixed(1)} MB`
  }

  return `${Math.round(sizeBytes / 1024)} KB`
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDurationMs(durationMs) {
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 1
  ) {
    return ''
  }

  const totalSeconds = Math.max(
    1,
    Math.round(durationMs / 1000),
  )

  const minutes = Math.floor(
    totalSeconds / 60,
  )

  const seconds = String(
    totalSeconds % 60,
  ).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function getStorageStatusLabel(status) {
  const labels = {
    pending: 'ממתינה להעלאה',
    stored: 'נשמרה באופן פרטי',
    failed: 'ההעלאה נכשלה',
  }

  return labels[status] ?? status
}

function getTranscriptionStatusLabel(status) {
  const labels = {
    not_requested: 'טרם נשלחה לתמלול',
    queued: 'ממתינה לתמלול',
    processing: 'מתמללת כעת',
    completed: 'התמלול הושלם',
    failed: 'התמלול נכשל',
  }

  return labels[status] ?? status
}

function hasPermittedUse(recording, permittedUse) {
  return Boolean(recording.consent?.permittedUses?.includes(permittedUse))
}

function notifyRecordingsUpdated(
  memoryId,
) {
  window.dispatchEvent(
    new CustomEvent(
      'living-memory:recordings-updated',
      {
        detail: {
          memoryId,
        },
      },
    ),
  )
}

function MemoryRecordings({ memoryId, subjectName, runAuthenticatedRequest }) {
  const fileInputRef = useRef(null)
  const audioUrlRegistryRef = useRef(new Map())

  const [recordings, setRecordings] = useState([])
  const [form, setForm] = useState(createInitialForm)
  const [selectedFile, setSelectedFile] = useState(null)
  const [transcriptsByRecordingId, setTranscriptsByRecordingId] = useState({})
  const [transcriptDrafts, setTranscriptDrafts] = useState({})
  const [editingApprovedTranscripts, setEditingApprovedTranscripts] = useState({})
  const [sourceConfirmations, setSourceConfirmations] = useState({})
  const [audioUrlsByRecordingId, setAudioUrlsByRecordingId] = useState({})
  const [audioErrorsByRecordingId, setAudioErrorsByRecordingId] = useState({})
  const [loadingAudioRecordingId, setLoadingAudioRecordingId] = useState('')
  const [openTranscriptRecordingId, setOpenTranscriptRecordingId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [retryFilesByRecordingId, setRetryFilesByRecordingId] = useState({})
  const [retryingRecordingId, setRetryingRecordingId] = useState('')
  const [transcribingRecordingId, setTranscribingRecordingId] = useState('')
  const [awaitingTranscriptRecordingId, setAwaitingTranscriptRecordingId] =
    useState('')
  const [loadingTranscriptRecordingId, setLoadingTranscriptRecordingId] = useState('')
  const [savingTranscriptRecordingId, setSavingTranscriptRecordingId] = useState('')
  const [approvingTranscriptRecordingId, setApprovingTranscriptRecordingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const registry = audioUrlRegistryRef.current

    return () => {
      for (const url of registry.values()) {
        URL.revokeObjectURL(url)
      }

      registry.clear()
    }
  }, [])

  const fetchRecordings = useCallback(
    () =>
      runAuthenticatedRequest((accessToken) =>
        listMemoryRecordings(accessToken, memoryId),
      ),
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    async function loadRecordings() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const nextRecordings = await fetchRecordings()

        if (isActive) {
          setRecordings(nextRecordings)
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(getRecordingErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadRecordings()

    return () => {
      isActive = false
    }
  }, [fetchRecordings])

  useEffect(() => {
    let isActive = true

    function handleRecordingsUpdated(
      event,
    ) {
      if (
        event.detail?.memoryId !==
        memoryId
      ) {
        return
      }

      void fetchRecordings()
        .then((nextRecordings) => {
          if (isActive) {
            setRecordings(
              nextRecordings,
            )
          }
        })
        .catch((error) => {
          if (isActive) {
            setErrorMessage(
              getRecordingErrorMessage(
                error,
              ),
            )
          }
        })
    }

    window.addEventListener(
      'living-memory:recordings-updated',
      handleRecordingsUpdated,
    )

    return () => {
      isActive = false
      window.removeEventListener(
        'living-memory:recordings-updated',
        handleRecordingsUpdated,
      )
    }
  }, [
    fetchRecordings,
    memoryId,
  ])

  const activeTranscriptionKey =
    recordings
      .filter((recording) =>
        ['queued', 'processing'].includes(
          recording.transcriptionStatus,
        ),
      )
      .map(
        (recording) =>
          `${recording.id}:${recording.transcriptionStatus}`,
      )
      .join('|')

  useEffect(() => {

    if (
      !activeTranscriptionKey &&
      !awaitingTranscriptRecordingId
    ) {
      return undefined
    }

    let isActive = true
    let isPolling = false

    async function pollTranscriptions() {
      if (isPolling) {
        return
      }

      isPolling = true

      try {
        const nextRecordings =
          await fetchRecordings()

        if (!isActive) {
          return
        }

        setRecordings(nextRecordings)

        if (!awaitingTranscriptRecordingId) {
          return
        }

        const awaitedRecording =
          nextRecordings.find(
            (recording) =>
              recording.id ===
              awaitingTranscriptRecordingId,
          )

        if (
          awaitedRecording
            ?.transcriptionStatus ===
          'completed'
        ) {
          const transcript =
            await runAuthenticatedRequest(
              (accessToken) =>
                getMemoryRecordingTranscript(
                  accessToken,
                  memoryId,
                  awaitedRecording.id,
                ),
            )

          if (!isActive) {
            return
          }

          setTranscriptsByRecordingId(
            (current) => ({
              ...current,
              [awaitedRecording.id]:
                transcript,
            }),
          )
          setTranscriptDrafts(
            (current) => ({
              ...current,
              [awaitedRecording.id]:
                transcript.content,
            }),
          )
          setOpenTranscriptRecordingId(
            awaitedRecording.id,
          )
          setAwaitingTranscriptRecordingId(
            '',
          )
          setSuccessMessage(
            'התמלול הושלם ברקע ונשמר כטיוטה לבדיקה.',
          )
        } else if (
          awaitedRecording
            ?.transcriptionStatus ===
          'failed'
        ) {
          setAwaitingTranscriptRecordingId(
            '',
          )
          setErrorMessage(
            'התמלול לא הושלם. אפשר לנסות שוב מכרטיס ההקלטה.',
          )
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            getRecordingErrorMessage(error),
          )
        }
      } finally {
        isPolling = false
      }
    }

    const intervalId = window.setInterval(
      pollTranscriptions,
      1_500,
    )

    void pollTranscriptions()

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [
    awaitingTranscriptRecordingId,
    activeTranscriptionKey,
    fetchRecordings,
    memoryId,
    runAuthenticatedRequest,
  ])

  async function refreshRecordings() {
    const nextRecordings = await fetchRecordings()

    setRecordings(nextRecordings)

    return nextRecordings
  }

  function resetMessages() {
    setErrorMessage('')
    setSuccessMessage('')
  }

  function handleFormChange(event) {
    const { checked, name, type, value } = event.target

    setForm((current) => {
      const nextForm = {
        ...current,
        [name]: type === 'checkbox' ? checked : value,
      }

      if (name === 'transcriptionConsent' && !checked) {
        nextForm.sourceConsent = false
      }

      if (
        name === 'consentBasis' &&
        value !== 'self'
      ) {
        nextForm.voiceImitationConsent =
          false
      }

      return nextForm
    })
  }

  function handleFileChange(event) {
    resetMessages()

    const file = event.target.files?.[0] ?? null

    setSelectedFile(file)

    if (!file) {
      return
    }

    const mimeType = resolveMimeType(file)

    if (!mimeType) {
      setErrorMessage('סוג הקובץ אינו נתמך. אפשר להעלות MP3, M4A, MP4, WAV או WebM.')
      return
    }

    if (file.size < 1 || file.size > MAX_RECORDING_SIZE_BYTES) {
      setErrorMessage('קובץ ההקלטה חייב להיות בגודל של עד 25 MB.')
      return
    }

    setForm((current) => ({
      ...current,
      displayName: current.displayName || removeFileExtension(file.name),
    }))
  }

  async function handleRefresh() {
    resetMessages()
    setIsLoading(true)

    try {
      await refreshRecordings()
    } catch (error) {
      setErrorMessage(getRecordingErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault()
    resetMessages()

    if (!selectedFile) {
      setErrorMessage('בחרו קובץ הקלטה.')
      return
    }

    const mimeType = resolveMimeType(selectedFile)

    if (!mimeType) {
      setErrorMessage('סוג הקובץ אינו נתמך. אפשר להעלות MP3, M4A, MP4, WAV או WebM.')
      return
    }

    if (selectedFile.size < 1 || selectedFile.size > MAX_RECORDING_SIZE_BYTES) {
      setErrorMessage('קובץ ההקלטה חייב להיות בגודל של עד 25 MB.')
      return
    }

    if (!form.storageConsent) {
      setErrorMessage('נדרשת הסכמה מפורשת לשמירת ההקלטה.')
      return
    }

    if (!form.transcriptionConsent) {
      setErrorMessage('ביחידת התמלול נדרשת הסכמה נפרדת לתמלול ההקלטה.')
      return
    }

    if (
      form.voiceImitationConsent &&
      form.consentBasis !== 'self'
    ) {
      setErrorMessage(
        'בשלב זה אפשר לאשר חיקוי קול רק כאשר האדם שבהקלטה הוא המשתמש עצמו.',
      )
      return
    }

    const permittedUses = ['transcription']

    if (form.sourceConsent) {
      permittedUses.push('memory_grounding')
    }

    if (form.playbackConsent) {
      permittedUses.push('recording_playback')
    }

    if (form.voiceImitationConsent) {
      permittedUses.push(
        'voice_imitation',
      )
    }

    setIsSubmitting(true)

    let metadataWasCreated = false

    try {
      const recording = await runAuthenticatedRequest((accessToken) =>
        createMemoryRecording(accessToken, memoryId, {
          displayName: form.displayName,
          originalFileName: selectedFile.name,
          mimeType,
          sizeBytes: selectedFile.size,
          languageCode: form.languageCode,
          consent: {
            confirmed: true,
            basis: form.consentBasis,
            permittedUses,
          },
        }),
      )

      metadataWasCreated = true
      setRecordings((current) => [recording, ...current])

      const uploadFile = createUploadFile(selectedFile, mimeType)

      const storedRecording = await runAuthenticatedRequest((accessToken) =>
        uploadMemoryRecordingFile(accessToken, memoryId, recording.id, uploadFile),
      )

      setRecordings((current) =>
        current.map((currentRecording) =>
          currentRecording.id === storedRecording.id ? storedRecording : currentRecording,
        ),
      )

      notifyRecordingsUpdated(
        memoryId,
      )

      const transcriptionResult = await runAuthenticatedRequest((accessToken) =>
        requestMemoryRecordingTranscription(accessToken, memoryId, storedRecording.id, {
          languageCode: form.languageCode,
        }),
      )

      if (transcriptionResult.transcript) {
        const { transcript } = transcriptionResult

        setTranscriptsByRecordingId((current) => ({
          ...current,
          [storedRecording.id]: transcript,
        }))

        setTranscriptDrafts((current) => ({
          ...current,
          [storedRecording.id]: transcript.content,
        }))

        setOpenTranscriptRecordingId(storedRecording.id)
      } else {
        setAwaitingTranscriptRecordingId(
          storedRecording.id,
        )
      }
      setForm(createInitialForm())
      setSelectedFile(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setSuccessMessage(
        transcriptionResult.queued
          ? 'ההקלטה נשמרה ונשלחה לתמלול ברקע. אפשר להמשיך לעבוד; הטיוטה תיפתח כשהתמלול יושלם.'
          : form.sourceConsent
            ? 'ההקלטה נשמרה ותומללה. בדקו את הטיוטה ואשרו אותה לפני שתשמש כמקור לשיחה.'
            : 'ההקלטה נשמרה ותומללה כטיוטה. היא לא תשמש כמקור לשיחה ללא הסכמה ואישור מתאימים.',
      )
    } catch (error) {
      setErrorMessage(getRecordingErrorMessage(error))
    } finally {
      if (metadataWasCreated) {
        try {
          await refreshRecordings()
        } catch {
          // The next manual refresh can reconcile the list.
        }
      }

      setIsSubmitting(false)
    }
  }

  async function handleRequestTranscription(recording) {
    resetMessages()

    if (!hasPermittedUse(recording, 'transcription')) {
      setErrorMessage('לא ניתנה הסכמה לתמלול ההקלטה הזאת.')
      return
    }

    setTranscribingRecordingId(recording.id)

    try {
      const result = await runAuthenticatedRequest((accessToken) =>
        requestMemoryRecordingTranscription(accessToken, memoryId, recording.id, {
          languageCode: recording.languageCode,
        }),
      )

      if (result.transcript) {
        setTranscriptsByRecordingId((current) => ({
          ...current,
          [recording.id]: result.transcript,
        }))

        setTranscriptDrafts((current) => ({
          ...current,
          [recording.id]: result.transcript.content,
        }))

        setOpenTranscriptRecordingId(recording.id)
      } else {
        setAwaitingTranscriptRecordingId(
          recording.id,
        )
      }

      setSuccessMessage(
        result.queued
          ? 'ההקלטה נשלחה לתמלול ברקע. הטיוטה תיפתח אוטומטית כשהתהליך יושלם.'
          : result.created
            ? 'התמלול הושלם ונשמר כטיוטה.'
            : 'התמלול הקיים נטען בהצלחה.',
      )
    } catch (error) {
      setErrorMessage(getRecordingErrorMessage(error))
    } finally {
      try {
        await refreshRecordings()
      } catch {
        // The next manual refresh can reconcile the status.
      }

      setTranscribingRecordingId('')
    }
  }

  function handleRetryFileChange(
    recording,
    event,
  ) {
    resetMessages()

    const file =
      event.target.files?.[0] ??
      null

    function clearRetryFile() {
      setRetryFilesByRecordingId(
        (current) => {
          const next = {
            ...current,
          }

          delete next[recording.id]

          return next
        },
      )
    }

    if (!file) {
      clearRetryFile()
      return
    }

    const mimeType =
      resolveMimeType(file)

    if (
      !mimeType ||
      !areMimeTypesCompatible(
        mimeType,
        recording.mimeType,
      )
    ) {
      clearRetryFile()
      event.target.value = ''

      setErrorMessage(
        'יש לבחור מחדש את אותו סוג קובץ שנרשם עבור ההקלטה.',
      )

      return
    }

    if (
      file.name !==
        recording.originalFileName ||
      file.size !==
        recording.sizeBytes
    ) {
      clearRetryFile()
      event.target.value = ''

      setErrorMessage(
        'יש לבחור מחדש את אותו קובץ בדיוק. שם הקובץ או גודלו אינם תואמים לרשומה.',
      )

      return
    }

    setRetryFilesByRecordingId(
      (current) => ({
        ...current,
        [recording.id]: file,
      }),
    )
  }

  async function handleRetryUpload(
    recording,
  ) {
    resetMessages()

    const file =
      retryFilesByRecordingId[
        recording.id
      ]

    if (!file) {
      setErrorMessage(
        'בחרו מחדש את קובץ ההקלטה לפני ניסיון ההעלאה.',
      )

      return
    }

    const resolvedMimeType =
      resolveMimeType(file)

    if (
      !resolvedMimeType ||
      !areMimeTypesCompatible(
        resolvedMimeType,
        recording.mimeType,
      ) ||
      file.name !==
        recording.originalFileName ||
      file.size !==
        recording.sizeBytes
    ) {
      setErrorMessage(
        'הקובץ שנבחר אינו תואם לרשומת ההקלטה.',
      )

      return
    }

    setRetryingRecordingId(
      recording.id,
    )

    try {
      const uploadFile =
        createUploadFile(
          file,
          recording.mimeType,
        )

      const storedRecording =
        await runAuthenticatedRequest(
          (accessToken) =>
            uploadMemoryRecordingFile(
              accessToken,
              memoryId,
              recording.id,
              uploadFile,
            ),
        )

      setRecordings((current) =>
        current.map(
          (currentRecording) =>
            currentRecording.id ===
            storedRecording.id
              ? storedRecording
              : currentRecording,
        ),
      )

      notifyRecordingsUpdated(
        memoryId,
      )

      setRetryFilesByRecordingId(
        (current) => {
          const next = {
            ...current,
          }

          delete next[recording.id]

          return next
        },
      )

      setSuccessMessage(
        'הקובץ נשמר בהצלחה. כעת אפשר להתחיל את התמלול.',
      )
    } catch (error) {
      setErrorMessage(
        getRecordingErrorMessage(
          error,
        ),
      )
    } finally {
      setRetryingRecordingId('')
    }
  }

  async function handleToggleTranscript(recording) {
    resetMessages()

    if (openTranscriptRecordingId === recording.id) {
      setOpenTranscriptRecordingId('')
      return
    }

    const existingTranscript = transcriptsByRecordingId[recording.id]

    if (existingTranscript) {
      setOpenTranscriptRecordingId(recording.id)
      return
    }

    setLoadingTranscriptRecordingId(recording.id)

    try {
      const transcript = await runAuthenticatedRequest((accessToken) =>
        getMemoryRecordingTranscript(accessToken, memoryId, recording.id),
      )

      setTranscriptsByRecordingId((current) => ({
        ...current,
        [recording.id]: transcript,
      }))

      setTranscriptDrafts((current) => ({
        ...current,
        [recording.id]: transcript.content,
      }))

      setOpenTranscriptRecordingId(recording.id)
    } catch (error) {
      setErrorMessage(getRecordingErrorMessage(error))
    } finally {
      setLoadingTranscriptRecordingId('')
    }
  }

  async function handleLoadOriginalAudio(recording) {
    resetMessages()

    if (!hasPermittedUse(recording, 'recording_playback')) {
      setAudioErrorsByRecordingId((current) => ({
        ...current,
        [recording.id]: 'לא ניתנה הרשאה להשמעת ההקלטה המקורית.',
      }))
      return
    }

    setLoadingAudioRecordingId(recording.id)
    setAudioErrorsByRecordingId((current) => ({
      ...current,
      [recording.id]: '',
    }))

    try {
      const audioBlob = await runAuthenticatedRequest((accessToken) =>
        getMemoryRecordingAudio(accessToken, memoryId, recording.id),
      )

      const previousUrl = audioUrlRegistryRef.current.get(recording.id)

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }

      const audioUrl = URL.createObjectURL(audioBlob)

      audioUrlRegistryRef.current.set(recording.id, audioUrl)
      setAudioUrlsByRecordingId((current) => ({
        ...current,
        [recording.id]: audioUrl,
      }))
    } catch (error) {
      setAudioErrorsByRecordingId((current) => ({
        ...current,
        [recording.id]: getRecordingErrorMessage(error),
      }))
    } finally {
      setLoadingAudioRecordingId('')
    }
  }

  function handleTranscriptChange(recordingId, value) {
    setTranscriptDrafts((current) => ({
      ...current,
      [recordingId]: value,
    }))
  }

  function startEditingApprovedTranscript(
    recordingId,
  ) {
    const transcript =
      transcriptsByRecordingId[
        recordingId
      ]

    if (!transcript) {
      return
    }

    resetMessages()
    setTranscriptDrafts((current) => ({
      ...current,
      [recordingId]:
        transcript.content,
    }))
    setEditingApprovedTranscripts(
      (current) => ({
        ...current,
        [recordingId]: true,
      }),
    )
  }

  function cancelEditingApprovedTranscript(
    recordingId,
  ) {
    const transcript =
      transcriptsByRecordingId[
        recordingId
      ]

    setTranscriptDrafts((current) => ({
      ...current,
      [recordingId]:
        transcript?.content ?? '',
    }))
    setEditingApprovedTranscripts(
      (current) => ({
        ...current,
        [recordingId]: false,
      }),
    )
  }

  async function handleSaveTranscript(recording) {
    resetMessages()

    const transcript = transcriptsByRecordingId[recording.id]
    const content = transcriptDrafts[recording.id] ?? ''

    if (!transcript) {
      setErrorMessage('התמלול אינו זמין לעריכה.')
      return
    }

    if (!content.trim()) {
      setErrorMessage('תוכן התמלול לא יכול להיות ריק.')
      return
    }

    setSavingTranscriptRecordingId(recording.id)

    const wasApproved =
      transcript.reviewStatus ===
      'approved'

    try {
      const updatedTranscript =
        await runAuthenticatedRequest(
          (accessToken) => {
            const input = {
              content,
              expectedRevision:
                transcript.revision,
            }

            return wasApproved
              ? reviseApprovedMemoryRecordingTranscript(
                  accessToken,
                  memoryId,
                  recording.id,
                  input,
                )
              : updateMemoryRecordingTranscript(
                  accessToken,
                  memoryId,
                  recording.id,
                  input,
                )
          },
        )

      setTranscriptsByRecordingId((current) => ({
        ...current,
        [recording.id]: updatedTranscript,
      }))

      setTranscriptDrafts((current) => ({
        ...current,
        [recording.id]: updatedTranscript.content,
      }))

      setEditingApprovedTranscripts(
        (current) => ({
          ...current,
          [recording.id]: false,
        }),
      )

      setSuccessMessage(
        wasApproved
          ? 'התמלול עודכן, הגרסה המאושרת נשמרה בהיסטוריה והוא חזר לטיוטה לאישור מחדש.'
          : 'טיוטת התמלול נשמרה בהצלחה.',
      )

      if (wasApproved) {
        notifyRecordingsUpdated(
          memoryId,
        )
      }
    } catch (error) {
      setErrorMessage(getRecordingErrorMessage(error))
    } finally {
      setSavingTranscriptRecordingId('')
    }
  }

  async function handleApproveTranscript(recording) {
    resetMessages()

    const transcript = transcriptsByRecordingId[recording.id]

    if (!transcript) {
      setErrorMessage('התמלול אינו זמין לאישור.')
      return
    }

    if (!hasPermittedUse(recording, 'memory_grounding')) {
      setErrorMessage('לא ניתנה הסכמה לשימוש בתמלול כמקור מידע.')
      return
    }

    if (!sourceConfirmations[recording.id]) {
      setErrorMessage('יש לאשר במפורש שהתמלול ייכנס למאגר המקורות.')
      return
    }

    setApprovingTranscriptRecordingId(recording.id)

    try {
      const result = await runAuthenticatedRequest((accessToken) =>
        approveMemoryRecordingTranscript(accessToken, memoryId, recording.id, {
          expectedRevision: transcript.revision,
          confirmSourceUse: true,
        }),
      )

      setTranscriptsByRecordingId((current) => ({
        ...current,
        [recording.id]: result.transcript,
      }))

      setTranscriptDrafts((current) => ({
        ...current,
        [recording.id]: result.transcript.content,
      }))

      setSourceConfirmations((current) => ({
        ...current,
        [recording.id]: false,
      }))

      setSuccessMessage(
        result.approved
          ? 'התמלול אושר ונוסף למקורות המידע של השיחה.'
          : 'התמלול כבר היה מאושר כמקור מידע.',
      )

      notifyRecordingsUpdated(
        memoryId,
      )
    } catch (error) {
      setErrorMessage(getRecordingErrorMessage(error))
    } finally {
      setApprovingTranscriptRecordingId('')
    }
  }

  function handleSourceConfirmation(recordingId, checked) {
    setSourceConfirmations((current) => ({
      ...current,
      [recordingId]: checked,
    }))
  }

  const hasActiveUpload =
    isSubmitting ||
    retryingRecordingId.length > 0

  return (
    <section className="recordings-workspace" aria-labelledby="recordings-title">
      <div className="recordings-heading">
        <div>
          <p className="panel-kicker">מקור קולי</p>
          <h2 id="recordings-title">הקלטות ותמלולים</h2>

          <p>
            העלו הקלטה של {subjectName}, הפיקו ממנה תמלול, בדקו אותו ורק לאחר מכן אשרו
            אותו כמקור מידע.
          </p>
        </div>

        <button
          className="secondary-button recordings-refresh-button"
          type="button"
          disabled={isLoading || hasActiveUpload}
          onClick={handleRefresh}
        >
          {isLoading ? 'מרעננים...' : 'רענון הרשימה'}
        </button>
      </div>

      <aside className="recordings-safety-notice">
        <strong>שימושים נפרדים — לא שכפול קול</strong>

        <p>
          שמירת הקלטה אינה מעניקה אוטומטית הרשאה לתמלול, להשמעת המקור או לחיקוי קול.
          כל שימוש דורש הסכמה נפרדת, ולא נוצר כאן קול מלאכותי.
        </p>
      </aside>

      {errorMessage && (
        <p className="form-error recordings-message" role="alert">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="story-success recordings-message" role="status">
          {successMessage}
        </p>
      )}

      <div className="recordings-layout">
        <form
          className="recording-upload-form"
          onSubmit={handleUploadSubmit}
          aria-busy={isSubmitting}
        >
          <div className="recording-form-heading">
            <h3>העלאת הקלטה חדשה</h3>
            <p>עד 25 MB, בפורמט MP3, M4A, MP4, WAV או WebM.</p>
          </div>

          <label className="recording-field">
            <span>קובץ ההקלטה</span>

            <input
              ref={fileInputRef}
              type="file"
              name="recording"
              accept=".mp3,.m4a,.mp4,.wav,.webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm"
              disabled={hasActiveUpload}
              onChange={handleFileChange}
              required
            />

            {selectedFile && (
              <small>
                {selectedFile.name}
                {' · '}
                {formatFileSize(selectedFile.size)}
              </small>
            )}
          </label>

          <label className="recording-field">
            <span>שם ההקלטה</span>

            <input
              type="text"
              name="displayName"
              value={form.displayName}
              minLength={2}
              maxLength={120}
              disabled={hasActiveUpload}
              onChange={handleFormChange}
              placeholder="לדוגמה: זיכרונות מהילדות"
              required
            />
          </label>

          <label className="recording-field">
            <span>שפת ההקלטה</span>

            <select
              name="languageCode"
              value={form.languageCode}
              disabled={hasActiveUpload}
              onChange={handleFormChange}
            >
              <option value="he">עברית</option>
              <option value="en">English</option>
              <option value="fa">فارسی</option>
              <option value="ar">العربية</option>
            </select>
          </label>

          <label className="recording-field">
            <span>בסיס ההרשאה להקלטה</span>

            <select
              name="consentBasis"
              value={form.consentBasis}
              disabled={hasActiveUpload}
              onChange={handleFormChange}
            >
              <option value="self">האדם שבהקלטה הוא אני</option>
              <option value="subject_consent">האדם נתן הסכמה מפורשת</option>
              <option value="authorized_representative">אני נציג מורשה</option>
              <option value="rights_holder">אני בעל הזכויות</option>
            </select>
          </label>

          <fieldset className="recording-consents">
            <legend>הסכמות נפרדות</legend>

            <label>
              <input
                type="checkbox"
                name="storageConsent"
                checked={form.storageConsent}
                disabled={hasActiveUpload}
                onChange={handleFormChange}
              />

              <span>
                <strong>שמירה פרטית</strong>
                אני מאשר/ת לשמור את קובץ ההקלטה במערכת.
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                name="transcriptionConsent"
                checked={form.transcriptionConsent}
                disabled={hasActiveUpload}
                onChange={handleFormChange}
              />

              <span>
                <strong>תמלול</strong>
                אני מאשר/ת להעביר את ההקלטה לשירות תמלול ולהפיק ממנה טקסט.
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                name="playbackConsent"
                checked={form.playbackConsent}
                disabled={hasActiveUpload}
                onChange={handleFormChange}
              />

              <span>
                <strong>השמעת ההקלטה המקורית</strong>
                אני מאשר/ת לבני משפחה בעלי הרשאת צפייה בזיכרון להשמיע את קובץ המקור.
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                name="sourceConsent"
                checked={form.sourceConsent}
                disabled={hasActiveUpload || !form.transcriptionConsent}
                onChange={handleFormChange}
              />

              <span>
                <strong>מקור מידע לשיחה</strong>
                אני מאפשר/ת להשתמש בתמלול כמקור מידע, אך רק לאחר שאבדוק ואאשר אותו בנפרד.
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                name="voiceImitationConsent"
                checked={
                  form.voiceImitationConsent
                }
                disabled={
                  hasActiveUpload ||
                  form.consentBasis !==
                    'self'
                }
                onChange={
                  handleFormChange
                }
              />

              <span>
                <strong>
                  דגימת קול אישית
                </strong>
                אני האדם שבהקלטה ואני
                מאשר/ת להשתמש בה כדגימת
                ייחוס לחיקוי הקול. העברה
                לספק חיצוני עדיין תחייב
                אישור נפרד במסך הקול
                והאווטאר.
              </span>
            </label>
          </fieldset>

          <p className="recording-consent-boundary">
            ללא סימון “דגימת קול אישית”
            ההקלטה אינה יכולה לשמש לחיקוי
            קול. גם לאחר הסימון, היא נשארת
            פרטית ולא תועבר לספק חיצוני עד
            לאישור נפרד.
          </p>

          <button
            className="primary-button recording-submit-button"
            type="submit"
            disabled={hasActiveUpload}
          >
            {isSubmitting
              ? 'מעלים ושולחים לתמלול...'
              : 'שמירה ושליחה לתמלול'}
          </button>
        </form>

        <div className="recording-list-panel">
          <div className="recording-list-heading">
            <div>
              <h3>הקלטות שנשמרו</h3>
              <p>תמלול חדש נשמר תמיד כטיוטה.</p>
            </div>

            <span className="recording-count">{recordings.length}</span>
          </div>

          {isLoading ? (
            <div className="recordings-loading" aria-live="polite">
              <span className="loading-indicator" aria-hidden="true" />
              <p>טוענים הקלטות...</p>
            </div>
          ) : recordings.length === 0 ? (
            <div className="recordings-empty">
              <strong>עדיין אין הקלטות</strong>
              <p>ההקלטה הראשונה שתעלו תופיע כאן.</p>
            </div>
          ) : (
            <div className="recording-list">
              {recordings.map((recording) => {
                const transcript = transcriptsByRecordingId[recording.id]

                const transcriptDraft =
                  transcriptDrafts[recording.id] ??
                  transcript?.content ??
                  ''

                const isEditingApprovedTranscript =
                  Boolean(
                    editingApprovedTranscripts[
                      recording.id
                    ],
                  )

                const isTranscriptOpen =
                  openTranscriptRecordingId === recording.id

                const isTranscribing =
                  transcribingRecordingId === recording.id

                const isLoadingTranscript =
                  loadingTranscriptRecordingId === recording.id

                const isSavingTranscript =
                  savingTranscriptRecordingId === recording.id

                const isApprovingTranscript =
                  approvingTranscriptRecordingId === recording.id

                const canApproveAsSource =
                  hasPermittedUse(
                    recording,
                    'memory_grounding',
                  )

                const canRequestTranscription =
                  recording.storageStatus === 'stored' &&
                  ['not_requested', 'failed'].includes(
                    recording.transcriptionStatus,
                  )

                const canRetryUpload =
                  ['pending', 'failed'].includes(
                    recording.storageStatus,
                  )

                const retryFile =
                  retryFilesByRecordingId[recording.id] ?? null

                const isRetryingUpload =
                  retryingRecordingId === recording.id

                const canPlayOriginalAudio =
                  recording.storageStatus === 'stored' &&
                  hasPermittedUse(recording, 'recording_playback')

                const audioUrl =
                  audioUrlsByRecordingId[recording.id] ?? ''

                const audioError =
                  audioErrorsByRecordingId[recording.id] ?? ''

                const isLoadingAudio =
                  loadingAudioRecordingId === recording.id

                return (
                  <article className="recording-card" key={recording.id}>
                    {recording.interviewContext && (
                      <div className="recording-interview-context">
                        <span>
                          תשובה מתוך ראיון מודרך
                          {' · '}
                          {INTERVIEW_CATEGORY_LABELS[
                            recording.interviewContext.promptCategory
                          ] ?? 'פרק חיים'}
                        </span>

                        <strong>
                          {recording.interviewContext.promptText}
                        </strong>
                      </div>
                    )}

                    <div className="recording-card-header">
                      <div>
                        <h4>{recording.displayName}</h4>

                        <p>
                          {recording.originalFileName}
                          {' · '}
                          {formatFileSize(recording.sizeBytes)}
                        </p>
                      </div>

                      <span
                        className={`recording-storage-status recording-storage-${recording.storageStatus}`}
                      >
                        {getStorageStatusLabel(recording.storageStatus)}
                      </span>
                    </div>

                    <dl className="recording-details">
                      <div>
                        <dt>תמלול</dt>
                        <dd>
                          {getTranscriptionStatusLabel(
                            recording.transcriptionStatus,
                          )}
                        </dd>
                      </div>

                      {['queued', 'processing'].includes(
                        recording.transcriptionStatus,
                      ) && (
                        <div>
                          <dt>התקדמות</dt>
                          <dd>
                            {recording.transcriptionProgress ?? 0}%
                          </dd>
                        </div>
                      )}

                      <div>
                        <dt>שפה</dt>
                        <dd>{recording.languageCode}</dd>
                      </div>

                      {recording.durationMs && (
                        <div>
                          <dt>משך</dt>
                          <dd>
                            {formatDurationMs(
                              recording.durationMs,
                            )}
                          </dd>
                        </div>
                      )}

                      {recording.createdAt && (
                        <div>
                          <dt>נוספה</dt>
                          <dd>{formatDate(recording.createdAt)}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="recording-permissions">
                      <span>
                        תמלול:{' '}
                        {hasPermittedUse(recording, 'transcription')
                          ? 'מאושר'
                          : 'לא אושר'}
                      </span>

                      <span>
                        שימוש כמקור:{' '}
                        {canApproveAsSource
                          ? 'אפשרי לאחר בדיקה'
                          : 'לא אושר'}
                      </span>

                      <span>
                        השמעת מקור:{' '}
                        {hasPermittedUse(recording, 'recording_playback')
                          ? 'מאושרת לבעלי הרשאת צפייה'
                          : 'לא אושרה'}
                      </span>

                      <span>
                        חיקוי קול:{' '}
                        {hasPermittedUse(
                          recording,
                          'voice_imitation',
                        )
                          ? 'אושר על ידי האדם עצמו'
                          : 'לא אושר'}
                      </span>
                    </div>

                    {recording.storageStatus === 'stored' && (
                      <div className="recording-audio-panel">
                        <div className="recording-audio-heading">
                          <strong>ההקלטה המקורית</strong>

                          <span>
                            נטענת באופן פרטי ורק לאחר בדיקת הרשאה.
                          </span>
                        </div>

                        {canPlayOriginalAudio && !audioUrl && (
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={isLoadingAudio}
                            onClick={() => handleLoadOriginalAudio(recording)}
                          >
                            {isLoadingAudio
                              ? 'טוענים את ההקלטה...'
                              : 'השמעת ההקלטה המקורית'}
                          </button>
                        )}

                        {audioUrl && (
                          <audio
                            controls
                            preload="metadata"
                            src={audioUrl}
                            aria-label={`ההקלטה המקורית: ${recording.displayName}`}
                          />
                        )}

                        {!hasPermittedUse(recording, 'recording_playback') && (
                          <p className="recording-audio-unavailable">
                            להקלטה הזאת לא ניתנה הרשאת השמעת מקור. הרשאות אינן מתווספות
                            בדיעבד ללא הסכמה מפורשת.
                          </p>
                        )}

                        {audioError && (
                          <p className="form-error recording-audio-error" role="alert">
                            {audioError}
                          </p>
                        )}
                      </div>
                    )}

                    {canRetryUpload && (
                      <div className="recording-retry-panel">
                        <div>
                          <strong>הקובץ עדיין לא נשמר</strong>

                          <p>
                            הרשומה כבר קיימת. בחרו שוב את אותו קובץ כדי להשלים את
                            ההעלאה בלי ליצור הקלטה כפולה.
                          </p>
                        </div>

                        <label className="recording-retry-file">
                          <span>בחירת הקובץ מחדש</span>

                          <input
                            type="file"
                            accept=".mp3,.m4a,.mp4,.wav,.webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm"
                            disabled={Boolean(retryingRecordingId)}
                            onChange={(event) =>
                              handleRetryFileChange(
                                recording,
                                event,
                              )
                            }
                          />
                        </label>

                        {retryFile && (
                          <small>
                            {retryFile.name}
                            {' · '}
                            {formatFileSize(retryFile.size)}
                          </small>
                        )}

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            !retryFile ||
                            Boolean(retryingRecordingId)
                          }
                          onClick={() =>
                            handleRetryUpload(recording)
                          }
                        >
                          {isRetryingUpload
                            ? 'מעלים מחדש...'
                            : 'ניסיון העלאה נוסף'}
                        </button>
                      </div>
                    )}

                    <div className="recording-actions">
                      {canRequestTranscription && (
                        <button
                          className="story-action-button story-action-approve"
                          type="button"
                          disabled={
                            isTranscribing ||
                            Boolean(retryingRecordingId)
                          }
                          onClick={() =>
                            handleRequestTranscription(recording)
                          }
                        >
                          {isTranscribing
                            ? 'שולחים לתור...'
                            : recording.transcriptionStatus === 'failed'
                              ? 'ניסיון תמלול נוסף'
                              : 'התחלת תמלול'}
                        </button>
                      )}

                      {recording.transcriptionStatus === 'completed' && (
                        <button
                          className="story-action-button story-action-edit"
                          type="button"
                          disabled={isLoadingTranscript}
                          onClick={() =>
                            handleToggleTranscript(recording)
                          }
                        >
                          {isLoadingTranscript
                            ? 'טוענים...'
                            : isTranscriptOpen
                              ? 'סגירת התמלול'
                              : 'פתיחת התמלול'}
                        </button>
                      )}
                    </div>

                    {isTranscriptOpen && transcript && (
                      <div className="recording-transcript-panel">
                        <div className="recording-transcript-heading">
                          <div>
                            <h5>תמלול ההקלטה</h5>
                            <p>גרסה {transcript.revision}</p>
                          </div>

                          <span
                            className={`transcript-review-status transcript-review-${transcript.reviewStatus}`}
                          >
                            {transcript.reviewStatus === 'approved'
                              ? 'מקור מאושר'
                              : 'טיוטה לבדיקה'}
                          </span>
                        </div>

                        {transcript.reviewStatus === 'draft' ||
                        isEditingApprovedTranscript ? (
                          <>
                            {isEditingApprovedTranscript && (
                              <p className="approved-source-edit-notice">
                                שמירת השינוי תסיר זמנית את האישור. הגרסה המאושרת
                                הנוכחית תישמר בהיסטוריה, והתמלול יחזור לטיוטה עד
                                שתבדקו ותאשרו אותו מחדש.
                              </p>
                            )}

                            <label className="recording-transcript-field">
                              <span>בדקו ותקנו את התמלול</span>

                              <textarea
                                value={transcriptDraft}
                                maxLength={500000}
                                rows={10}
                                disabled={
                                  isSavingTranscript ||
                                  isApprovingTranscript
                                }
                                onChange={(event) =>
                                  handleTranscriptChange(
                                    recording.id,
                                    event.target.value,
                                  )
                                }
                              />
                            </label>

                            <div className="recording-transcript-actions">
                              <button
                                className="secondary-button"
                                type="button"
                                disabled={
                                  isSavingTranscript ||
                                  isApprovingTranscript ||
                                  !transcriptDraft.trim() ||
                                  transcriptDraft === transcript.content
                                }
                                onClick={() =>
                                  handleSaveTranscript(recording)
                                }
                              >
                                {isSavingTranscript
                                  ? 'שומרים...'
                                  : 'שמירת תיקוני התמלול'}
                              </button>

                              {isEditingApprovedTranscript && (
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={isSavingTranscript}
                                  onClick={() =>
                                    cancelEditingApprovedTranscript(
                                      recording.id,
                                    )
                                  }
                                >
                                  ביטול העריכה
                                </button>
                              )}
                            </div>

                            {transcript.reviewStatus === 'draft' && (
                              canApproveAsSource ? (
                                <div className="recording-source-approval">
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(
                                        sourceConfirmations[recording.id],
                                      )}
                                      disabled={
                                        isSavingTranscript ||
                                        isApprovingTranscript
                                      }
                                      onChange={(event) =>
                                        handleSourceConfirmation(
                                          recording.id,
                                          event.target.checked,
                                        )
                                      }
                                    />

                                    <span>
                                      בדקתי את התמלול ואני מאשר/ת להוסיף אותו למאגר
                                      המקורות של הזיכרון.
                                    </span>
                                  </label>

                                  <button
                                    className="primary-button"
                                    type="button"
                                    disabled={
                                      isSavingTranscript ||
                                      isApprovingTranscript ||
                                      !sourceConfirmations[recording.id] ||
                                      transcriptDraft !== transcript.content
                                    }
                                    onClick={() =>
                                      handleApproveTranscript(recording)
                                    }
                                  >
                                    {isApprovingTranscript
                                      ? 'מאשרים מקור...'
                                      : 'אישור כמקור מידע'}
                                  </button>

                                  {transcriptDraft !== transcript.content && (
                                    <small>
                                      יש לשמור את תיקוני התמלול לפני האישור.
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <p className="recording-source-disabled">
                                  התמלול נשאר טיוטה פרטית ולא ניתן לאשרו כמקור, משום
                                  שלא ניתנה לכך הסכמה בעת העלאת ההקלטה.
                                </p>
                              )
                            )}
                          </>
                        ) : (
                          <>
                            <p className="approved-transcript-content">
                              {transcript.content}
                            </p>

                            <p className="approved-transcript-note">
                              התמלול הזה יכול לשמש את הצ׳אט כמקור מאושר. הוא אינו מעניק
                              הרשאה ליצירת קול מלאכותי.
                            </p>

                            <p className="approved-transcript-note">
                              {transcript.sourceIndexStatus === 'indexed'
                                ? `מאונדקס במאגר המקורות · גרסה ${transcript.sourceIndexRevision}`
                                : 'מקור מאושר ותיק: ייכנס לאינדקס בעדכון האישור הבא.'}
                            </p>

                            <button
                              className="story-action-button story-action-edit"
                              type="button"
                              disabled={isSavingTranscript}
                              onClick={() =>
                                startEditingApprovedTranscript(
                                  recording.id,
                                )
                              }
                            >
                              עריכת התמלול המאושר
                            </button>
                          </>
                        )}

                        {transcript.revisionHistory?.length > 0 && (
                          <details className="transcript-revision-history">
                            <summary>
                              היסטוריית עריכות
                              {' · '}
                              {transcript.revisionHistory.length}
                              {' '}
                              גרסאות קודמות
                            </summary>

                            <div className="transcript-revision-list">
                              {transcript.revisionHistory
                                .slice()
                                .reverse()
                                .map((revision) => (
                                  <article
                                    className="transcript-revision-item"
                                    key={`${recording.id}-${revision.revision}-${revision.changedAt}`}
                                  >
                                    <div>
                                      <strong>
                                        גרסה {revision.revision}
                                      </strong>

                                      <span>
                                        {revision.reviewStatus === 'approved'
                                          ? 'הייתה מאושרת'
                                          : 'הייתה טיוטה'}
                                      </span>

                                      {revision.changedAt && (
                                        <span>
                                          עד {formatDate(revision.changedAt)}
                                        </span>
                                      )}
                                    </div>

                                    <p>{revision.content}</p>
                                  </article>
                                ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default MemoryRecordings
