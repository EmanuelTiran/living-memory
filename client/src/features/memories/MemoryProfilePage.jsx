import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import { ApiError, refreshSession } from '../../api/authApi.js'
import {
  createMemoryAssetAccessLink,
  listMemoryAssets,
  uploadMemoryAsset,
} from '../../api/assetApi.js'
import {
  createMemoryRecording,
  listMemoryRecordings,
  uploadMemoryRecordingFile,
} from '../../api/recordingApi.js'
import {
  pilotAvatarEnabled,
} from '../../config/pilotFeatures.js'
import {
  revealAuraTarget,
} from '../../auraMotion.js'
import {
  approveMemoryStory,
  archiveMemoryProfile,
  archiveMemoryStory,
  createMemoryStory,
  getMemoryProfile,
  listMemoryStories,
  searchMemoryArchive,
  updateMemoryProfile,
  updateMemoryStory,
} from '../../api/memoryApi.js'
import MemoryChatLauncher from '../chat/MemoryChatLauncher.jsx'
import DigitalPersonaSetup from './DigitalPersonaSetup.jsx'
import FamilyQuestions from './FamilyQuestions.jsx'
import GuidedStoryMap from './GuidedStoryMap.jsx'
import MemoryAssets from './MemoryAssets.jsx'
import MemoryArchiveSearch from './MemoryArchiveSearch.jsx'
import MemoryDocumentationPanel from './MemoryDocumentationPanel.jsx'
import MemoryRecordings from './MemoryRecordings.jsx'
import MemoryStoryList from './MemoryStoryList.jsx'
import MemoryTimeline from './MemoryTimeline.jsx'
import MemoryTodayPanel from './MemoryTodayPanel.jsx'
import {
  createMemoryProfileTabSearch,
  getRtlTabTargetIndex,
  getMemoryProfileCapabilities,
  getVisibleMemoryProfileTabs,
  MEMORY_PROFILE_TAB_IDS,
  resolveMemoryProfileTab,
} from './memoryProfileTabs.js'
import {
  createMemoryArchiveViewSearch,
  getMemoryArchiveViewHash,
  MEMORY_ARCHIVE_VIEW_IDS,
  MEMORY_ARCHIVE_VIEWS,
  resolveMemoryArchiveView,
} from './memoryArchiveViews.js'
import './MemoryProfilePage.css'
import './MemoryProfileManagement.css'

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND: 'הזיכרון לא נמצא או שאין לכם הרשאה לצפות בו.',
    STORY_NOT_FOUND: 'הסיפור לא נמצא או שאינו זמין יותר.',
    STORY_REVISION_CONFLICT:
      'הסיפור השתנה מאז שפתחתם אותו. רעננו את הדף לפני שמירה נוספת.',
    VALIDATION_ERROR: 'חלק מהפרטים אינם תקינים. בדקו את הטופס ונסו שוב.',
    AUTHENTICATION_REQUIRED: 'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR: 'לא הצלחנו להתחבר לשרת.',
  }

  return messages[error.code] ?? 'לא הצלחנו להשלים את הפעולה.'
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
  }).format(date)
}

function formatDateOnly(value) {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}

function getStoryStatusLabel(status) {
  return status === 'approved' ? 'מאושר' : 'טיוטה'
}

function resolveVoiceMimeType(file) {
  const supportedTypes = new Set([
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
  ])

  if (supportedTypes.has(file.type)) {
    return file.type
  }

  const extension = file.name
    .split('.')
    .pop()
    ?.toLocaleLowerCase('en-US')

  return {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
  }[extension] ?? ''
}

function notifyArchiveSourcesUpdated(
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

function MemoryProfilePage({ authentication, onAuthenticationChange }) {
  const { memoryId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const profileEditTriggerRef = useRef(null)
  const storyEditTriggerRef = useRef(null)

  const [memoryProfile, setMemoryProfile] = useState(null)
  const [memoryStories, setMemoryStories] = useState([])
  const [profileHeroImageUrl, setProfileHeroImageUrl] = useState('')

  const [profileForm, setProfileForm] = useState({
    subjectName: '',
    subjectGender: 'unspecified',
    relationship: '',
    description: '',
  })

  const [profilePortraitFile, setProfilePortraitFile] = useState(null)
  const [profileVoiceFile, setProfileVoiceFile] = useState(null)
  const [profileVoiceRightsConfirmed, setProfileVoiceRightsConfirmed] =
    useState(false)

  const [storyForm, setStoryForm] = useState({
    title: '',
    content: '',
    occurredOn: '',
  })

  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    occurredOn: '',
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isArchivingProfile, setIsArchivingProfile] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [approvingStoryId, setApprovingStoryId] = useState('')
  const [updatingStoryId, setUpdatingStoryId] = useState('')
  const [archivingStoryId, setArchivingStoryId] = useState('')
  const [editingStoryId, setEditingStoryId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [profileActionError, setProfileActionError] = useState(
    () =>
      location.state?.profileSetupWarning ??
      '',
  )
  const [profileActionSuccess, setProfileActionSuccess] = useState('')
  const [storyErrorMessage, setStoryErrorMessage] = useState('')
  const [storySuccessMessage, setStorySuccessMessage] = useState('')
  const [lastCreatedStoryId, setLastCreatedStoryId] = useState('')
  const [storyActionErrorMessage, setStoryActionErrorMessage] = useState('')
  const [storyActionSuccessMessage, setStoryActionSuccessMessage] = useState('')
  const [archiveInventory, setArchiveInventory] = useState({
    memoryId: '',
    status: 'idle',
    recordingCount: 0,
    assetCount: 0,
  })
  const [approvedSourceReadiness, setApprovedSourceReadiness] = useState({
    memoryId: '',
    status: 'idle',
    hasApprovedSources: false,
  })

  const runAuthenticatedRequest = useCallback(
    async (operation) => {
      try {
        return await operation(authentication.accessToken)
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 401) {
          throw error
        }

        try {
          const restoredAuthentication = await refreshSession()

          onAuthenticationChange(restoredAuthentication)

          return await operation(restoredAuthentication.accessToken)
        } catch (refreshError) {
          onAuthenticationChange(null)

          navigate('/login', {
            replace: true,
          })

          throw refreshError
        }
      }
    },
    [authentication.accessToken, navigate, onAuthenticationChange],
  )

  useEffect(() => {
    let isActive = true

    async function loadMemory() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const [profile, stories] = await runAuthenticatedRequest((accessToken) =>
          Promise.all([
            getMemoryProfile(accessToken, memoryId),
            listMemoryStories(accessToken, memoryId),
          ]),
        )

        if (isActive) {
          setMemoryProfile(profile)
          setMemoryStories(stories)
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadMemory()

    return () => {
      isActive = false
    }
  }, [memoryId, runAuthenticatedRequest])

  useEffect(() => {
    let isActive = true

    async function loadProfileHeroImage() {
      setProfileHeroImageUrl('')

      try {
        const assets = await runAuthenticatedRequest((accessToken) =>
          listMemoryAssets(accessToken, memoryId),
        )

        const portraitAssetId =
          memoryProfile?.portraitAssetId

        if (!portraitAssetId) {
          return
        }

        const heroAsset = assets.find(
          (asset) =>
            asset.id ===
            portraitAssetId.toString(),
        )

        if (!heroAsset) {
          return
        }

        const access = await runAuthenticatedRequest((accessToken) =>
          createMemoryAssetAccessLink(
            accessToken,
            memoryId,
            heroAsset.id,
            'inline',
          ),
        )

        if (isActive) {
          setProfileHeroImageUrl(access.url)
        }
      } catch {
        // The portrait is an enhancement. The archive remains usable without it.
      }
    }

    void loadProfileHeroImage()

    return () => {
      isActive = false
    }
  }, [
    memoryId,
    memoryProfile?.portraitAssetId,
    runAuthenticatedRequest,
  ])

  function startEditingProfile() {
    profileEditTriggerRef.current =
      document.activeElement
    setProfileForm({
      subjectName: memoryProfile.subjectName,
      subjectGender:
        memoryProfile.subjectGender ??
        'unspecified',
      relationship: memoryProfile.relationship ?? '',
      description: memoryProfile.description ?? '',
    })

    setProfilePortraitFile(null)
    setProfileVoiceFile(null)
    setProfileVoiceRightsConfirmed(false)

    setProfileActionError('')
    setProfileActionSuccess('')
    setIsEditingProfile(true)

    window.requestAnimationFrame(() => {
      document
        .getElementById('profile-edit-title')
        ?.focus()
    })
  }

  function cancelEditingProfile() {
    setIsEditingProfile(false)

    setProfileForm({
      subjectName: '',
      subjectGender: 'unspecified',
      relationship: '',
      description: '',
    })

    setProfilePortraitFile(null)
    setProfileVoiceFile(null)
    setProfileVoiceRightsConfirmed(false)

    window.requestAnimationFrame(() => {
      profileEditTriggerRef.current
        ?.focus()
    })
  }

  function handleProfileChange(event) {
    const { name, value } = event.target

    setProfileForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()

    if (
      profilePortraitFile &&
      (
        ![
          'image/jpeg',
          'image/png',
          'image/webp',
        ].includes(profilePortraitFile.type) ||
        profilePortraitFile.size < 1 ||
        profilePortraitFile.size >
          10 * 1024 * 1024
      )
    ) {
      setProfileActionError(
        'תמונת האדם חייבת להיות JPG, PNG או WebP ובגודל של עד 10 MB.',
      )
      return
    }

    const voiceMimeType =
      profileVoiceFile
        ? resolveVoiceMimeType(
            profileVoiceFile,
          )
        : ''

    if (
      profileVoiceFile &&
      (
        !voiceMimeType ||
        profileVoiceFile.size < 1 ||
        profileVoiceFile.size >
          25 * 1024 * 1024
      )
    ) {
      setProfileActionError(
        'דגימת הקול חייבת להיות MP3, M4A, MP4, WAV או WebM ובגודל של עד 25 MB.',
      )
      return
    }

    if (
      profileVoiceFile &&
      !profileVoiceRightsConfirmed
    ) {
      setProfileActionError(
        'כדי לשמור את דגימת הקול יש לאשר שיש לכם רשות לשמור ולהשמיע אותה בארכיון.',
      )
      return
    }

    setIsUpdatingProfile(true)
    setProfileActionError('')
    setProfileActionSuccess('')

    try {
      let updatedProfile = await runAuthenticatedRequest((accessToken) =>
        updateMemoryProfile(accessToken, memoryId, profileForm),
      )

      setMemoryProfile(updatedProfile)

      const profileMedia = {}

      if (profilePortraitFile) {
        const portraitAsset =
          await runAuthenticatedRequest(
            (accessToken) =>
              uploadMemoryAsset(
                accessToken,
                memoryId,
                {
                  file: profilePortraitFile,
                  displayName:
                    `תמונת הפרופיל של ${updatedProfile.subjectName}`,
                  description:
                    'התמונה הראשית שנבחרה עבור האדם בארכיון.',
                },
              ),
          )

        profileMedia.portraitAssetId =
          portraitAsset.id
      }

      if (profileVoiceFile) {
        const voiceRecording =
          await runAuthenticatedRequest(
            (accessToken) =>
              createMemoryRecording(
                accessToken,
                memoryId,
                {
                  displayName:
                    `דגימת הקול של ${updatedProfile.subjectName}`,
                  originalFileName:
                    profileVoiceFile.name,
                  mimeType: voiceMimeType,
                  sizeBytes:
                    profileVoiceFile.size,
                  languageCode: 'he',
                  consent: {
                    confirmed: true,
                    basis:
                      'rights_holder',
                    permittedUses: [
                      'recording_playback',
                    ],
                  },
                },
              ),
          )

        const storedRecording =
          await runAuthenticatedRequest(
            (accessToken) =>
              uploadMemoryRecordingFile(
                accessToken,
                memoryId,
                voiceRecording.id,
                profileVoiceFile,
              ),
          )

        profileMedia.voiceSampleRecordingId =
          storedRecording.id
      }

      if (Object.keys(profileMedia).length > 0) {
        updatedProfile =
          await runAuthenticatedRequest(
            (accessToken) =>
              updateMemoryProfile(
                accessToken,
                memoryId,
                profileMedia,
              ),
          )
      }

      setMemoryProfile(updatedProfile)
      cancelEditingProfile()
      setProfileActionSuccess('פרטי הזיכרון עודכנו בהצלחה.')
    } catch (error) {
      setProfileActionError(getErrorMessage(error))
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  async function handleArchiveProfile() {
    const shouldArchive = window.confirm(
      `האם להעביר את הזיכרון של "${memoryProfile.subjectName}" לארכיון? הסיפורים לא יימחקו.`,
    )

    if (!shouldArchive) {
      return
    }

    setIsArchivingProfile(true)
    setProfileActionError('')
    setProfileActionSuccess('')

    try {
      await runAuthenticatedRequest((accessToken) =>
        archiveMemoryProfile(accessToken, memoryId),
      )

      navigate('/app', {
        replace: true,
      })
    } catch (error) {
      setProfileActionError(getErrorMessage(error))
      setIsArchivingProfile(false)
    }
  }

  function handleStoryChange(event) {
    const { name, value } = event.target

    setStoryForm((current) => ({
      ...current,
      [name]: value,
    }))
    setLastCreatedStoryId('')
    setStorySuccessMessage('')
  }

  function handleEditChange(event) {
    const { name, value } = event.target

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function startEditingStory(story) {
    storyEditTriggerRef.current = story.id
    setEditingStoryId(story.id)

    setEditForm({
      title: story.title,
      content: story.content,
      occurredOn: story.occurredOn ?? '',
    })

    setStoryActionErrorMessage('')
    setStoryActionSuccessMessage('')

    window.requestAnimationFrame(() => {
      document
        .getElementById(
          `story-edit-title-${story.id}`,
        )
        ?.focus()
    })
  }

  function cancelEditingStory() {
    setEditingStoryId('')

    setEditForm({
      title: '',
      content: '',
      occurredOn: '',
    })

    window.requestAnimationFrame(() => {
      document
        .getElementById(
          `story-edit-trigger-${storyEditTriggerRef.current}`,
        )
        ?.focus()
    })
  }

  async function handleStorySubmit(event) {
    event.preventDefault()

    setIsSubmitting(true)
    setStoryErrorMessage('')
    setStorySuccessMessage('')
    setLastCreatedStoryId('')

    try {
      const input = {
        title: storyForm.title,
        content: storyForm.content,
      }

      if (storyForm.occurredOn) {
        input.occurredOn = storyForm.occurredOn
      }

      const memoryStory = await runAuthenticatedRequest((accessToken) =>
        createMemoryStory(accessToken, memoryId, input),
      )

      setMemoryStories((current) => [memoryStory, ...current])

      setStoryForm({
        title: '',
        content: '',
        occurredOn: '',
      })

      setStorySuccessMessage('הסיפור נשמר בהצלחה כטיוטה.')
      setLastCreatedStoryId(memoryStory.id)
    } catch (error) {
      setStoryErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleApproveStory(storyId) {
    setApprovingStoryId(storyId)
    setStoryActionErrorMessage('')
    setStoryActionSuccessMessage('')

    try {
      const approvedStory = await runAuthenticatedRequest((accessToken) =>
        approveMemoryStory(accessToken, memoryId, storyId),
      )

      setMemoryStories((current) =>
        current.map((story) =>
          story.id === approvedStory.id ? approvedStory : story,
        ),
      )

      notifyArchiveSourcesUpdated(
        memoryId,
      )

      setStoryActionSuccessMessage('הסיפור אושר בהצלחה.')
    } catch (error) {
      setStoryActionErrorMessage(getErrorMessage(error))
    } finally {
      setApprovingStoryId('')
    }
  }

  async function handleEditSubmit(event, storyId) {
    event.preventDefault()

    setUpdatingStoryId(storyId)
    setStoryActionErrorMessage('')
    setStoryActionSuccessMessage('')

    try {
      const updatedStory = await runAuthenticatedRequest((accessToken) =>
        updateMemoryStory(accessToken, memoryId, storyId, {
          title: editForm.title,
          content: editForm.content,
          occurredOn: editForm.occurredOn,
          expectedRevision:
            memoryStories.find(
              (story) =>
                story.id === storyId,
            )?.revision ?? 1,
        }),
      )

      setMemoryStories((current) =>
        current.map((story) =>
          story.id === updatedStory.id ? updatedStory : story,
        ),
      )

      cancelEditingStory()

      notifyArchiveSourcesUpdated(
        memoryId,
      )

      setStoryActionSuccessMessage(
        'הגרסה הקודמת נשמרה בהיסטוריה, והסיפור חזר לטיוטה לצורך אישור מחדש.',
      )
    } catch (error) {
      setStoryActionErrorMessage(getErrorMessage(error))
    } finally {
      setUpdatingStoryId('')
    }
  }

  async function handleArchiveStory(story) {
    const shouldArchive = window.confirm(
      `האם להעביר את הסיפור "${story.title}" לארכיון?`,
    )

    if (!shouldArchive) {
      return
    }

    setArchivingStoryId(story.id)
    setStoryActionErrorMessage('')
    setStoryActionSuccessMessage('')

    try {
      await runAuthenticatedRequest((accessToken) =>
        archiveMemoryStory(accessToken, memoryId, story.id),
      )

      setMemoryStories((current) =>
        current.filter((currentStory) => currentStory.id !== story.id),
      )

      if (editingStoryId === story.id) {
        cancelEditingStory()
      }

      setStoryActionSuccessMessage('הסיפור הועבר לארכיון.')
    } catch (error) {
      setStoryActionErrorMessage(getErrorMessage(error))
    } finally {
      setArchivingStoryId('')
    }
  }

  function isStoryBusy(storyId) {
    return (
      approvingStoryId === storyId ||
      updatingStoryId === storyId ||
      archivingStoryId === storyId
    )
  }

  const authorizationRole =
    memoryProfile?.authorization?.role ??
    'owner'
  const requestedTab =
    new URLSearchParams(location.search)
      .get('tab')
  const requestedArchiveView =
    new URLSearchParams(location.search)
      .get('archiveView')
  const {
    activeTab,
    notice: tabResolutionNotice,
    shouldReplaceUrl,
  } = resolveMemoryProfileTab(
    requestedTab,
    authorizationRole,
  )
  const visibleTabs =
    getVisibleMemoryProfileTabs(
      authorizationRole,
    )
  const activeArchiveView =
    resolveMemoryArchiveView({
      requestedView:
        requestedArchiveView,
      hash: location.hash,
      targetType:
        location.state
          ?.memoryTodayTarget?.type,
    })
  const hasApprovedStory =
    memoryStories.some(
      (story) =>
        story.status === 'approved',
    )
  const archiveInventoryMatchesMemory =
    archiveInventory.memoryId === memoryId
  const archiveInventoryIsLoading =
    memoryStories.length === 0 &&
    (
      !archiveInventoryMatchesMemory ||
      [
        'idle',
        'loading',
      ].includes(
        archiveInventory.status,
      )
    )
  const archiveIsEmpty =
    memoryStories.length === 0 &&
    archiveInventoryMatchesMemory &&
    archiveInventory.status === 'ready' &&
    archiveInventory.recordingCount === 0 &&
    archiveInventory.assetCount === 0
  const hasApprovedSources =
    hasApprovedStory ||
    (
      approvedSourceReadiness.memoryId ===
        memoryId &&
      approvedSourceReadiness.status ===
        'ready' &&
      approvedSourceReadiness
        .hasApprovedSources
    )
  const approvedSourceReadinessMatchesMemory =
    approvedSourceReadiness.memoryId ===
    memoryId
  const isCheckingApprovedSources =
    !hasApprovedStory &&
    (
      !approvedSourceReadinessMatchesMemory ||
      [
        'idle',
        'loading',
      ].includes(
        approvedSourceReadiness.status,
      )
    )
  const approvedSourceCheckFailed =
    !hasApprovedStory &&
    approvedSourceReadinessMatchesMemory &&
    approvedSourceReadiness.status ===
      'error'

  function retryApprovedSourceCheck() {
    setApprovedSourceReadiness({
      memoryId,
      status: 'idle',
      hasApprovedSources: false,
    })
  }

  useEffect(() => {
    if (
      activeTab !==
        MEMORY_PROFILE_TAB_IDS.archive ||
      (
        archiveInventory.memoryId ===
          memoryId &&
        archiveInventory.status !==
          'idle'
      )
    ) {
      return undefined
    }

    let isCurrent = true

    runAuthenticatedRequest(
      (accessToken) =>
        Promise.all([
          listMemoryRecordings(
            accessToken,
            memoryId,
          ),
          listMemoryAssets(
            accessToken,
            memoryId,
          ),
        ]),
    )
      .then(([recordings, assets]) => {
        if (!isCurrent) {
          return
        }

        setArchiveInventory({
          memoryId,
          status: 'ready',
          recordingCount:
            recordings.length,
          assetCount: assets.length,
        })
      })
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setArchiveInventory({
          memoryId,
          status: 'error',
          recordingCount: 0,
          assetCount: 0,
        })
      })

    return () => {
      isCurrent = false
    }
  }, [
    activeTab,
    archiveInventory.memoryId,
    archiveInventory.status,
    memoryId,
    runAuthenticatedRequest,
  ])

  useEffect(() => {
    if (
      activeTab !==
        MEMORY_PROFILE_TAB_IDS.family ||
      hasApprovedStory ||
      (
        approvedSourceReadiness
          .memoryId === memoryId &&
        approvedSourceReadiness.status !==
          'idle'
      )
    ) {
      return undefined
    }

    let isCurrent = true

    runAuthenticatedRequest(
      (accessToken) =>
        searchMemoryArchive(
          accessToken,
          memoryId,
          {
            limit: 50,
          },
        ),
    )
      .then((search) => {
        if (!isCurrent) {
          return
        }

        setApprovedSourceReadiness({
          memoryId,
          status: 'ready',
          hasApprovedSources:
            search.results.some(
              (result) =>
                result.sourceType !==
                'memory_profile',
            ),
        })
      })
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setApprovedSourceReadiness({
          memoryId,
          status: 'error',
          hasApprovedSources: false,
        })
      })

    return () => {
      isCurrent = false
    }
  }, [
    activeTab,
    approvedSourceReadiness.memoryId,
    approvedSourceReadiness.status,
    hasApprovedStory,
    memoryId,
    runAuthenticatedRequest,
  ])

  useEffect(() => {
    if (
      !memoryProfile ||
      !shouldReplaceUrl
    ) {
      return
    }

    const nextState = {
      ...(location.state ?? {}),
    }

    if (tabResolutionNotice) {
      nextState.memoryProfileTabNotice =
        tabResolutionNotice
    } else {
      delete nextState.memoryProfileTabNotice
    }

    navigate(
      {
        pathname: location.pathname,
        search:
          createMemoryProfileTabSearch(
            location.search,
            activeTab,
          ),
        hash: '',
      },
      {
        replace: true,
        state: nextState,
      },
    )
  }, [
    activeTab,
    location.pathname,
    location.search,
    location.state,
    memoryProfile,
    navigate,
    shouldReplaceUrl,
    tabResolutionNotice,
  ])

  useEffect(() => {
    if (
      !memoryProfile ||
      !location.hash
    ) {
      return undefined
    }

    const frameId = window.requestAnimationFrame(
      () => {
        const target =
          document.getElementById(
            location.hash.slice(1),
          )

        if (target) {
          target
            .querySelector(
              'details.memory-story-disclosure',
            )
            ?.setAttribute('open', '')

          revealAuraTarget(target, {
            block: 'start',
            smooth:
              location.key !== 'default',
          })

          if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1')
          }

          target.focus({
            preventScroll: true,
          })
        }
      },
    )

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    activeTab,
    location.hash,
    location.key,
    memoryProfile,
  ])

  function handleMemoryTabChange(
    tabId,
    hash = '',
  ) {
    const nextState = {
      ...(location.state ?? {}),
    }

    delete nextState.memoryProfileTabNotice
    delete nextState.memoryTodayTarget
    delete nextState.startGuidedInterview

    navigate(
      {
        pathname: location.pathname,
        search:
          createMemoryProfileTabSearch(
            location.search,
            tabId,
          ),
        hash,
      },
      {
        state: nextState,
      },
    )
  }

  function handleArchiveViewChange(viewId) {
    const nextState = {
      ...(location.state ?? {}),
    }

    delete nextState.memoryTodayTarget

    navigate(
      {
        pathname: location.pathname,
        search:
          createMemoryArchiveViewSearch(
            location.search,
            viewId,
          ),
        hash:
          getMemoryArchiveViewHash(
            viewId,
          ),
      },
      {
        state: nextState,
      },
    )
  }

  function handleArchiveViewKeyDown(
    event,
    currentIndex,
  ) {
    const nextIndex =
      getRtlTabTargetIndex(
        event.key,
        currentIndex,
        MEMORY_ARCHIVE_VIEWS.length,
      )

    if (nextIndex < 0) {
      return
    }

    event.preventDefault()

    const nextView =
      MEMORY_ARCHIVE_VIEWS[nextIndex]

    handleArchiveViewChange(nextView.id)

    window.requestAnimationFrame(() => {
      document
        .getElementById(
          `memory-archive-view-${nextView.id}`,
        )
        ?.focus()
    })
  }

  function handleMemoryTabKeyDown(
    event,
    currentIndex,
  ) {
    const nextIndex =
      getRtlTabTargetIndex(
        event.key,
        currentIndex,
        visibleTabs.length,
      )

    if (nextIndex < 0) {
      return
    }

    event.preventDefault()
    const nextTab = visibleTabs[nextIndex]

    handleMemoryTabChange(nextTab.id)

    window.requestAnimationFrame(() => {
      document
        .getElementById(
          `memory-profile-tab-${nextTab.id}`,
        )
        ?.focus()
    })
  }

  if (isLoading) {
    return (
      <main className="page-shell">
        <section className="surface-card loading-card" aria-live="polite">
          <span className="loading-indicator" aria-hidden="true" />
          <p>טוענים את הזיכרון...</p>
        </section>
      </main>
    )
  }

  if (errorMessage || !memoryProfile) {
    return (
      <main className="page-shell">
        <section className="surface-card profile-error-card">
          <p className="form-error" role="alert">
            {errorMessage}
          </p>

          <Link
            className="secondary-button"
            to="/app"
            data-aura-tooltip="לחזור לרשימת הזיכרונות המשפחתיים"
          >
            חזרה לזיכרונות שלי
          </Link>
        </section>
      </main>
    )
  }

  const isProfileBusy = isUpdatingProfile || isArchivingProfile
  const {
    canContribute,
    canEdit,
    canManage,
  } = getMemoryProfileCapabilities(
    authorizationRole,
  )
  const canEditProfile = authorizationRole === 'owner'
  const approvedStoryCount = memoryStories.filter(
    (story) => story.status === 'approved',
  ).length
  const profileDescription =
    memoryProfile.description?.trim() ||
    'הסיפורים, הקול והרגעים שהמשפחה בוחרת לשמור יחד.'

  return (
    <main className="page-shell">
      <section
        className="surface-card memory-profile-page"
        aria-labelledby="memory-profile-title"
      >
        <div className="memory-profile-toolbar">
          <Link
            className="back-link"
            to="/app"
            data-aura-tooltip="לחזור לרשימת הזיכרונות המשפחתיים"
          >
            חזרה לזיכרונות שלי
          </Link>

          {canEditProfile && (
          <details className="profile-management-menu">
            <summary data-aura-tooltip="לפתוח עריכה והעברה לארכיון">
              ניהול הזיכרון
            </summary>

            <div className="profile-management-actions">
              <button
                className="profile-management-button profile-edit-button"
                type="button"
                data-aura-tooltip="לעדכן שם, קשר, תמונה וקול"
                disabled={isProfileBusy}
                onClick={startEditingProfile}
              >
                עריכת פרטי הזיכרון
              </button>

              <button
                className="profile-management-button profile-archive-button"
                type="button"
                data-aura-tooltip="להעביר את הזיכרון מהתצוגה הפעילה"
                disabled={isProfileBusy}
                onClick={handleArchiveProfile}
              >
                {isArchivingProfile
                  ? 'מעבירים לארכיון...'
                  : 'העברת הזיכרון לארכיון'}
              </button>
            </div>
          </details>
          )}
        </div>

        <header className="memory-profile-hero">
          <div className="memory-profile-identity-header">
            <div className="memory-profile-hero-copy">
              <p className="memory-privacy">
                <span aria-hidden="true" />
                זיכרון פרטי
              </p>

              <p className="memory-profile-hero-kicker">
                הארכיון המשפחתי
              </p>

              <h1 id="memory-profile-title" className="memory-profile-title">
                {memoryProfile.subjectName}
              </h1>

              {memoryProfile.relationship && (
                <p className="profile-relationship">
                  {memoryProfile.relationship}
                </p>
              )}
            </div>

            <button
              type="button"
              className={`memory-profile-hero-visual ${
                profileHeroImageUrl ? 'memory-profile-hero-visual-has-image' : ''
              }`}
              onClick={startEditingProfile}
              disabled={!canEditProfile}
              aria-label={
                profileHeroImageUrl
                  ? `החלפת התמונה של ${memoryProfile.subjectName}`
                  : `הוספת תמונה של ${memoryProfile.subjectName}`
              }
              data-aura-tooltip={
                profileHeroImageUrl
                  ? 'להחליף את תמונת הזיכרון'
                  : 'להוסיף תמונה לזיכרון'
              }
            >
              {profileHeroImageUrl ? (
                <img
                  src={profileHeroImageUrl}
                  alt={`תמונה מהארכיון של ${memoryProfile.subjectName}`}
                  onError={() => setProfileHeroImageUrl('')}
                />
              ) : (
                <span className="profile-initial" aria-hidden="true">
                  {memoryProfile.subjectName.trim().charAt(0)}
                </span>
              )}
            </button>
          </div>

          <div className="memory-profile-hero-content">
            <details className="memory-profile-mobile-details">
              <summary data-aura-tooltip="לראות תיאור ונתוני הארכיון">
                פרטים על הזיכרון
              </summary>

              <p>{profileDescription}</p>

              <dl>
                <div>
                  <dt>
                    סיפורים כתובים מאושרים
                  </dt>
                  <dd>{approvedStoryCount}</dd>
                </div>

                {memoryProfile.createdAt && (
                  <div>
                    <dt>הארכיון נפתח</dt>
                    <dd>
                      <time dateTime={memoryProfile.createdAt}>
                        {formatDate(memoryProfile.createdAt)}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
            </details>

            <p className="memory-profile-hero-description">
              {profileDescription}
            </p>

          </div>

          <div className="memory-profile-hero-actions">
            <Link
              className="secondary-button memory-profile-story-action"
              data-aura-tooltip="לשאול שאלות על בסיס מקורות הזיכרון"
              to={`/app/memories/${encodeURIComponent(memoryProfile.id)}/chat`}
              state={{ subjectName: memoryProfile.subjectName }}
            >
              שאלו את הסיפור
            </Link>

            <button
              className="primary-button memory-profile-primary-action"
              type="button"
              data-aura-tooltip={
                canContribute
                  ? canManage
                    ? 'לחזור לשאלה המשפחתית שמחכה לך'
                    : 'להוסיף סיפור חדש לארכיון'
                  : 'לפתוח את הסיפורים שנשמרו'
              }
              onClick={() =>
                handleMemoryTabChange(
                  canContribute
                    ? MEMORY_PROFILE_TAB_IDS.documentation
                    : MEMORY_PROFILE_TAB_IDS.archive,
                  canContribute
                    ? canManage
                      ? '#guided-interview'
                      : '#stories-title'
                    : '#guided-story-map',
                )
              }
            >
              {canContribute
                ? canManage
                  ? 'המשך השיחה המשפחתית'
                  : 'הוספת זיכרון לארכיון'
                : 'צפייה בסיפורים'}
            </button>

            {canEditProfile && (
              <button
                className="secondary-button memory-profile-photo-action"
                type="button"
                data-aura-tooltip="להוסיף או להחליף את תמונת הזיכרון"
                onClick={startEditingProfile}
              >
                {profileHeroImageUrl
                  ? 'החלפת תמונה לזיכרון'
                  : 'הוספת תמונה לזיכרון'}
              </button>
            )}
          </div>

          <dl className="memory-profile-hero-metadata">
            <div>
              <dt>סיפורים כתובים מאושרים</dt>
              <dd>{approvedStoryCount}</dd>
            </div>

            {memoryProfile.createdAt && (
              <div>
                <dt>הארכיון נפתח</dt>
                <dd>
                  <time dateTime={memoryProfile.createdAt}>
                    {formatDate(memoryProfile.createdAt)}
                  </time>
                </dd>
              </div>
            )}
          </dl>
        </header>

        {profileActionError && (
          <p className="form-error profile-action-message" role="alert">
            {profileActionError}
          </p>
        )}

        {profileActionSuccess && (
          <p className="story-success profile-action-message" role="status">
            {profileActionSuccess}
          </p>
        )}

        {isEditingProfile && (
          <section
            className="profile-edit-panel"
            aria-labelledby="profile-edit-title"
          >
            <h2
              id="profile-edit-title"
              tabIndex={-1}
            >
              עריכת פרטי הזיכרון
            </h2>

            <form
              className="profile-edit-form"
              onSubmit={handleProfileSubmit}
              aria-busy={isUpdatingProfile}
            >
              <label>
                <span>שם האדם</span>

                <input
                  type="text"
                  name="subjectName"
                  value={profileForm.subjectName}
                  onChange={handleProfileChange}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>

              <fieldset className="profile-gender-field">
                <legend>לשון הפנייה</legend>

                <label>
                  <input
                    type="radio"
                    name="subjectGender"
                    value="female"
                    checked={
                      profileForm.subjectGender ===
                      'female'
                    }
                    onChange={handleProfileChange}
                    required
                  />
                  <span>נקבה</span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="subjectGender"
                    value="male"
                    checked={
                      profileForm.subjectGender ===
                      'male'
                    }
                    onChange={handleProfileChange}
                    required
                  />
                  <span>זכר</span>
                </label>
              </fieldset>

              <label>
                <span>הקשר המשפחתי</span>

                <input
                  type="text"
                  name="relationship"
                  value={profileForm.relationship}
                  onChange={handleProfileChange}
                  maxLength={80}
                />
              </label>

              <label className="profile-description-field">
                <span>תיאור הזיכרון</span>

                <textarea
                  name="description"
                  value={profileForm.description}
                  onChange={handleProfileChange}
                  maxLength={1000}
                  rows={5}
                />
              </label>

              <section className="profile-media-editor">
                <label>
                  <span>תמונת האדם</span>
                  <small>
                    התמונה תוצג בראש הזיכרון ותשמש כתמונת המקור של האווטאר.
                  </small>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setProfilePortraitFile(
                        event.target.files?.[0] ??
                        null,
                      )
                    }
                  />
                </label>

                <label>
                  <span>דגימת הקול</span>
                  <small>
                    הקובץ נשמר כמקור קולי פרטי; הפעלת שכפול קול תדרוש הרשאה נפרדת.
                  </small>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm"
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0] ??
                        null

                      setProfileVoiceFile(file)

                      if (!file) {
                        setProfileVoiceRightsConfirmed(false)
                      }
                    }}
                  />
                </label>

                {profileVoiceFile && (
                  <label className="profile-voice-rights">
                    <input
                      type="checkbox"
                      checked={profileVoiceRightsConfirmed}
                      onChange={(event) =>
                        setProfileVoiceRightsConfirmed(
                          event.target.checked,
                        )
                      }
                    />
                    <span>
                      יש לי רשות לשמור ולהשמיע את ההקלטה בתוך הארכיון המשפחתי.
                    </span>
                  </label>
                )}
              </section>

              <div className="profile-edit-actions">
                <button
                  className="primary-button"
                  type="submit"
                  data-aura-tooltip="לשמור את הפרטים המעודכנים בזיכרון"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? 'שומרים...' : 'שמירת השינויים'}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  disabled={isUpdatingProfile}
                  onClick={cancelEditingProfile}
                >
                  ביטול
                </button>
              </div>
            </form>
          </section>
        )}

        <nav
          className="memory-profile-tab-navigation"
          aria-label="אזורים בזיכרון"
        >
          <div
            className="memory-profile-tab-list"
            role="tablist"
            aria-orientation="horizontal"
          >
            {visibleTabs.map((tab, index) => (
              <button
                id={`memory-profile-tab-${tab.id}`}
                className="memory-profile-tab"
                type="button"
                role="tab"
                data-aura-tooltip={tab.tooltip}
                aria-controls={`memory-profile-panel-${tab.id}`}
                aria-selected={
                  activeTab === tab.id
                }
                tabIndex={
                  activeTab === tab.id
                    ? 0
                    : -1
                }
                key={tab.id}
                onClick={() =>
                  handleMemoryTabChange(tab.id)
                }
                onKeyDown={(event) =>
                  handleMemoryTabKeyDown(
                    event,
                    index,
                  )
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {location.state
          ?.memoryProfileTabNotice && (
          <p
            className="memory-profile-tab-notice"
            role="status"
          >
            {
              location.state
                .memoryProfileTabNotice
            }
          </p>
        )}

        <section
          id="memory-profile-panel-today"
          className="memory-profile-tab-panel"
          role="tabpanel"
          aria-labelledby="memory-profile-tab-today"
          tabIndex={0}
          hidden={
            activeTab !==
            MEMORY_PROFILE_TAB_IDS.today
          }
        >
          <MemoryTodayPanel
            key={memoryProfile.id}
            authorizationRole={authorizationRole}
            currentSearch={location.search}
            isActive={
              activeTab ===
              MEMORY_PROFILE_TAB_IDS.today
            }
            memoryId={memoryProfile.id}
            memoryStories={memoryStories}
            runAuthenticatedRequest={
              runAuthenticatedRequest
            }
            subjectName={memoryProfile.subjectName}
          />
        </section>

        {canContribute && (
          <section
            id="memory-profile-panel-documentation"
            className="memory-profile-tab-panel"
            role="tabpanel"
            aria-labelledby="memory-profile-tab-documentation"
            tabIndex={0}
            hidden={
              activeTab !==
              MEMORY_PROFILE_TAB_IDS.documentation
            }
          >
            <MemoryDocumentationPanel
              canManage={canManage}
              isSubmitting={isSubmitting}
              lastCreatedStoryId={
                lastCreatedStoryId
              }
              memoryId={memoryProfile.id}
              onStoryChange={
                handleStoryChange
              }
              onStorySubmit={
                handleStorySubmit
              }
              runAuthenticatedRequest={
                runAuthenticatedRequest
              }
              storyErrorMessage={
                storyErrorMessage
              }
              storyForm={storyForm}
              storySuccessMessage={
                storySuccessMessage
              }
              subjectGender={
                memoryProfile.subjectGender
              }
              subjectName={
                memoryProfile.subjectName
              }
            />
          </section>
        )}

        <section
          id="memory-profile-panel-archive"
          className="memory-profile-tab-panel"
          role="tabpanel"
          aria-labelledby="memory-profile-tab-archive"
          tabIndex={0}
          hidden={
            activeTab !==
            MEMORY_PROFILE_TAB_IDS.archive
          }
        >
          <div className="archive-library-content memory-profile-archive-content">
            {archiveInventoryIsLoading ? (
              <div
                className="memory-archive-empty-loading"
                aria-live="polite"
              >
                <span
                  className="loading-indicator"
                  aria-hidden="true"
                />
                <p>
                  בודקים מה כבר נשמר בארכיון...
                </p>
              </div>
            ) : archiveIsEmpty ? (
              <section
                className="memory-archive-empty"
                aria-labelledby="memory-archive-empty-title"
              >
                <span aria-hidden="true">
                  ✦
                </span>

                <div>
                  <p className="panel-kicker">
                    הארכיון מוכן
                  </p>
                  <h2 id="memory-archive-empty-title">
                    הזיכרון הראשון עוד מחכה להישמר
                  </h2>
                  <p>
                    מתחילים בשאלה אחת או בסיפור קצר. לאחר השמירה, כל החומרים
                    יופיעו כאן במקום אחד.
                  </p>
                </div>

                <Link
                  className="primary-button"
                  data-aura-tooltip={
                    canContribute
                      ? canManage
                        ? 'להתחיל בשאלה הראשונה בראיון'
                        : 'לכתוב את הסיפור הראשון בארכיון'
                      : 'להשאיר שאלה חדשה למשפחה'
                  }
                  to={{
                    pathname:
                      location.pathname,
                    search:
                      createMemoryProfileTabSearch(
                        location.search,
                        canContribute
                          ? MEMORY_PROFILE_TAB_IDS.documentation
                          : MEMORY_PROFILE_TAB_IDS.family,
                      ),
                    hash: canContribute
                      ? canManage
                        ? '#guided-interview'
                        : '#stories-title'
                      : '#family-questions',
                  }}
                  state={
                    canManage
                      ? {
                          startGuidedInterview:
                            true,
                        }
                      : undefined
                  }
                >
                  {canContribute
                    ? canManage
                      ? 'התחלת שיחה ראשונה'
                      : 'כתיבת סיפור ראשון'
                    : 'השארת שאלה למשפחה'}
                </Link>
              </section>
            ) : (
              <>
            <MemoryArchiveSearch
              memoryId={memoryProfile.id}
              subjectName={
                memoryProfile.subjectName
              }
              runAuthenticatedRequest={
                runAuthenticatedRequest
              }
            />

            <nav
              className="memory-archive-view-navigation"
              aria-label="תצוגות הארכיון"
            >
              <div
                className="memory-archive-view-list"
                role="tablist"
                aria-orientation="horizontal"
              >
                {MEMORY_ARCHIVE_VIEWS.map(
                  (view, index) => (
                    <button
                      id={`memory-archive-view-${view.id}`}
                      className="memory-archive-view-button"
                      type="button"
                      role="tab"
                      data-aura-tooltip={view.tooltip}
                      aria-controls={`memory-archive-view-panel-${view.id}`}
                      aria-selected={
                        activeArchiveView ===
                        view.id
                      }
                      tabIndex={
                        activeArchiveView ===
                        view.id
                          ? 0
                          : -1
                      }
                      key={view.id}
                      onClick={() =>
                        handleArchiveViewChange(
                          view.id,
                        )
                      }
                      onKeyDown={(event) =>
                        handleArchiveViewKeyDown(
                          event,
                          index,
                        )
                      }
                    >
                      {view.label}

                      {view.id ===
                        MEMORY_ARCHIVE_VIEW_IDS.stories && (
                        <span>
                          {memoryStories.length}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            </nav>

            {activeArchiveView ===
              MEMORY_ARCHIVE_VIEW_IDS.stories && (
              <section
                id="memory-archive-view-panel-stories"
                className="story-workspace story-workspace-single memory-archive-view-panel"
                role="tabpanel"
                aria-labelledby="memory-archive-view-stories"
              >
                <MemoryStoryList
                  actionErrorMessage={
                    storyActionErrorMessage
                  }
                  actionSuccessMessage={
                    storyActionSuccessMessage
                  }
                  approvingStoryId={
                    approvingStoryId
                  }
                  archivingStoryId={
                    archivingStoryId
                  }
                  canEdit={canEdit}
                  editForm={editForm}
                  editingStoryId={editingStoryId}
                  formatDate={formatDate}
                  formatDateOnly={formatDateOnly}
                  getStoryStatusLabel={
                    getStoryStatusLabel
                  }
                  isStoryBusy={isStoryBusy}
                  memoryStories={memoryStories}
                  onApproveStory={
                    handleApproveStory
                  }
                  onArchiveStory={
                    handleArchiveStory
                  }
                  onCancelEditingStory={
                    cancelEditingStory
                  }
                  onEditChange={handleEditChange}
                  onEditSubmit={handleEditSubmit}
                  onStartEditingStory={
                    startEditingStory
                  }
                  updatingStoryId={
                    updatingStoryId
                  }
                />
              </section>
            )}

            {activeArchiveView ===
              MEMORY_ARCHIVE_VIEW_IDS.storyMap && (
              <div
                id="memory-archive-view-panel-story-map"
                className="memory-archive-view-panel"
                role="tabpanel"
                aria-labelledby="memory-archive-view-story-map"
              >
                <GuidedStoryMap
                  memoryId={memoryProfile.id}
                  subjectName={
                    memoryProfile.subjectName
                  }
                  runAuthenticatedRequest={
                    runAuthenticatedRequest
                  }
                />
              </div>
            )}

            {activeArchiveView ===
              MEMORY_ARCHIVE_VIEW_IDS.timeline && (
              <div
                id="memory-archive-view-panel-timeline"
                className="memory-archive-view-panel"
                role="tabpanel"
                aria-labelledby="memory-archive-view-timeline"
              >
                <MemoryTimeline
                  memoryId={memoryProfile.id}
                  subjectName={
                    memoryProfile.subjectName
                  }
                  runAuthenticatedRequest={
                    runAuthenticatedRequest
                  }
                  refreshKey={memoryStories
                    .map((story) =>
                      `${story.id}:${story.status}:${story.updatedAt ?? ''}`,
                    )
                    .join('|')}
                />
              </div>
            )}

            {activeArchiveView ===
              MEMORY_ARCHIVE_VIEW_IDS.recordings && (
              <div
                id="memory-archive-view-panel-recordings"
                className="memory-archive-view-panel"
                role="tabpanel"
                aria-labelledby="memory-archive-view-recordings"
              >
                <MemoryRecordings
                  canContribute={canContribute}
                  canEdit={canEdit}
                  focusRecordingId={
                    [
                      'recording',
                      'continue-interview',
                    ].includes(
                      location.state
                        ?.memoryTodayTarget
                        ?.type,
                    )
                      ? location.state
                          ?.memoryTodayTarget
                          ?.id
                      : ''
                  }
                  memoryId={memoryProfile.id}
                  subjectName={
                    memoryProfile.subjectName
                  }
                  runAuthenticatedRequest={
                    runAuthenticatedRequest
                  }
                />
              </div>
            )}

            {activeArchiveView ===
              MEMORY_ARCHIVE_VIEW_IDS.assets && (
              <div
                id="memory-archive-view-panel-assets"
                className="memory-archive-view-panel"
                role="tabpanel"
                aria-labelledby="memory-archive-view-assets"
              >
                <MemoryAssets
                  canContribute={canContribute}
                  canEdit={canEdit}
                  memoryId={memoryProfile.id}
                  subjectName={
                    memoryProfile.subjectName
                  }
                  runAuthenticatedRequest={
                    runAuthenticatedRequest
                  }
                />
              </div>
            )}
              </>
            )}
          </div>
        </section>

        <section
          id="memory-profile-panel-family"
          className="memory-profile-tab-panel"
          role="tabpanel"
          aria-labelledby="memory-profile-tab-family"
          tabIndex={0}
          hidden={
            activeTab !==
            MEMORY_PROFILE_TAB_IDS.family
          }
        >
          <section
            className="profile-features"
            aria-label="שאלה עם מקור"
          >
            <MemoryChatLauncher
              canContribute={canContribute}
              canManage={canManage}
              hasApprovedSources={hasApprovedSources}
              isCheckingSources={
                isCheckingApprovedSources
              }
              memoryId={memoryProfile.id}
              onRetrySourceCheck={
                retryApprovedSourceCheck
              }
              sourceCheckFailed={
                approvedSourceCheckFailed
              }
              subjectName={
                memoryProfile.subjectName
              }
            />
          </section>

          <FamilyQuestions
            canContribute={canContribute}
            focusQuestionId={
              [
                'family-question',
                'answer-family-question',
              ].includes(
                location.state
                  ?.memoryTodayTarget
                  ?.type,
              )
                ? location.state
                    ?.memoryTodayTarget
                    ?.id
                : ''
            }
            memoryId={memoryProfile.id}
            subjectName={memoryProfile.subjectName}
            subjectGender={
              memoryProfile.subjectGender
            }
            runAuthenticatedRequest={
              runAuthenticatedRequest
            }
          />

          {canManage && (
            <aside
              className="memory-family-access-shortcut"
              aria-labelledby="memory-family-access-shortcut-title"
            >
              <div>
                <p className="panel-kicker">
                  המעגל המשפחתי
                </p>

                <h2 id="memory-family-access-shortcut-title">
                  הזמנת המשפחה וניהול גישה
                </h2>

                <p>
                  מזמינים בני משפחה וקובעים מי יכול לצפות, להוסיף תיעוד
                  או לנהל את הארכיון.
                </p>
              </div>

              <Link
                className="secondary-button"
                data-aura-tooltip="לעבור לניהול בני המשפחה וההרשאות"
                to={`/app/memories/${encodeURIComponent(memoryProfile.id)}/family`}
              >
                ניהול בני המשפחה
              </Link>
            </aside>
          )}

          {pilotAvatarEnabled && canManage && (
            <details
              className="optional-ai-layer"
            >
              <summary data-aura-tooltip="לפתוח הגדרות קול ואווטאר">
                <span>
                  אפשרויות שיחה מתקדמות
                </span>
                <small>
                  קול ואווטאר מתאימים לשלב שבו כבר נשמרו סיפורים והרשאות.
                </small>
              </summary>

              <div className="optional-ai-layer-content">
                <div className="optional-ai-layer-introduction">
                  <p className="panel-kicker">
                    שכבה אופציונלית
                  </p>

                  <h2>
                    קול ואווטאר — רק לאחר
                    שהסיפורים נשמרו
                  </h2>

                  <p>
                    אפשר להוסיף קול מלאכותי או
                    חוויית וידאו בהמשך. הם אינם
                    נדרשים כדי לתעד, לאשר או
                    לשאול את הארכיון.
                  </p>
                </div>

                <DigitalPersonaSetup
                  memoryId={memoryProfile.id}
                  subjectName={
                    memoryProfile.subjectName
                  }
                  portraitUrl={profileHeroImageUrl}
                  hasPortrait={Boolean(
                    memoryProfile.portraitAssetId,
                  )}
                  onRequestPortrait={
                    startEditingProfile
                  }
                  runAuthenticatedRequest={
                    runAuthenticatedRequest
                  }
                />
              </div>
            </details>
          )}
        </section>
      </section>
    </main>
  )
}

export default MemoryProfilePage
