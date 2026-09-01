import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ApiError } from '../../api/authApi.js'
import {
  archiveMemoryAsset,
  createMemoryAssetAccessLink,
  listMemoryAssets,
  updateMemoryAssetMetadata,
  uploadMemoryAsset,
} from '../../api/assetApi.js'
import './MemoryAssets.css'

const MAX_ASSET_SIZE_BYTES =
  10 * 1024 * 1024

const MIME_TYPES_BY_EXTENSION =
  Object.freeze({
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  })

const SUPPORTED_MIME_TYPES = new Set(
  Object.values(MIME_TYPES_BY_EXTENSION),
)

const PROCESSING_STATUS_LABELS =
  Object.freeze({
    queued:
      'ממתין לעיבוד מאובטח',
    processing:
      'מעבד את פרטי הקובץ',
    completed:
      'עיבוד הקובץ הושלם',
    failed:
      'עיבוד הפרטים נכשל',
  })

function getAssetErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לפעולה הזאת.',
    MEMORY_ASSET_NOT_FOUND:
      'הקובץ לא נמצא או שאינו זמין יותר.',
    MEMORY_ASSET_FILE_NOT_FOUND:
      'הקובץ הפרטי לא נמצא באחסון.',
    MEMORY_ASSET_FILE_CORRUPTED:
      'בדיקת תקינות הקובץ נכשלה. הקובץ לא נפתח.',
    MEMORY_ASSET_FILE_EMPTY:
      'השרת החזיר קובץ ריק.',
    MEMORY_ASSET_ACCESS_INVALID:
      'הקישור הפרטי פג או אינו תקין. נסו לפתוח את הקובץ מחדש.',
    MEMORY_ASSET_STORAGE_PROVIDER_UNAVAILABLE:
      'שירות אחסון הקבצים אינו זמין כרגע.',
    MEMORY_ASSET_FILE_TOO_LARGE:
      'אפשר להעלות קובץ בגודל של עד 10MB.',
    MEMORY_ASSET_FILE_REQUIRED:
      'יש לבחור תמונה או מסמך PDF.',
    UNSUPPORTED_MEMORY_ASSET_TYPE:
      'אפשר להעלות JPG, PNG, WebP או PDF בלבד.',
    INVALID_MEMORY_ASSET_CONTENT:
      'תוכן הקובץ אינו תואם לסוג הקובץ שנבחר.',
    INVALID_MEMORY_ASSET_METADATA:
      'שם הקובץ או התיאור ארוכים מדי.',
    VALIDATION_ERROR:
      'חלק מפרטי הקובץ אינם תקינים.',
    AUTHENTICATION_REQUIRED:
      'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה.'
}

function getFileExtension(fileName) {
  const lastDotIndex =
    fileName.lastIndexOf('.')

  if (
    lastDotIndex < 0 ||
    lastDotIndex === fileName.length - 1
  ) {
    return ''
  }

  return fileName
    .slice(lastDotIndex + 1)
    .toLowerCase()
}

function removeFileExtension(fileName) {
  const lastDotIndex =
    fileName.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return fileName
  }

  return fileName.slice(0, lastDotIndex)
}

function resolveMimeType(file) {
  const declaredType =
    file.type.toLowerCase()

  if (
    SUPPORTED_MIME_TYPES.has(
      declaredType,
    )
  ) {
    return declaredType
  }

  return MIME_TYPES_BY_EXTENSION[
    getFileExtension(file.name)
  ] ?? ''
}

function normalizeUploadFile(
  file,
  mimeType,
) {
  if (file.type === mimeType) {
    return file
  }

  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  })
}

function formatFileSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes)) {
    return ''
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} בתים`
  }

  const megabytes =
    sizeBytes / (1024 * 1024)

  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`
  }

  return `${Math.round(sizeBytes / 1024)} KB`
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function getTechnicalMetadataLabel(asset) {
  const metadata =
    asset.technicalMetadata

  if (
    Number.isInteger(
      metadata?.widthPixels,
    ) &&
    Number.isInteger(
      metadata?.heightPixels,
    )
  ) {
    return `${metadata.widthPixels} × ${metadata.heightPixels} פיקסלים`
  }

  if (
    Number.isInteger(
      metadata?.pageCount,
    )
  ) {
    return metadata.pageCount === 1
      ? 'עמוד אחד'
      : `${metadata.pageCount} עמודים`
  }

  return ''
}

function MemoryAssetPreview({
  asset,
  memoryId,
  runAuthenticatedRequest,
}) {
  const [previewUrl, setPreviewUrl] =
    useState('')
  const [failed, setFailed] =
    useState(false)

  useEffect(() => {
    let isActive = true

    async function loadPreview() {
      try {
        const access =
          await runAuthenticatedRequest(
            (accessToken) =>
              createMemoryAssetAccessLink(
                accessToken,
                memoryId,
                asset.id,
                'inline',
              ),
          )

        if (!isActive) {
          return
        }

        setPreviewUrl(access.url)
      } catch {
        if (isActive) {
          setFailed(true)
        }
      }
    }

    loadPreview()

    return () => {
      isActive = false
    }
  }, [
    asset.id,
    memoryId,
    runAuthenticatedRequest,
  ])

  if (failed) {
    return (
      <div className="memory-asset-preview-fallback">
        לא ניתן להציג תצוגה מקדימה
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div
        className="memory-asset-preview-loading"
        aria-label="טוענים תמונה"
      />
    )
  }

  return (
    <img
      className="memory-asset-preview"
      src={previewUrl}
      alt={asset.displayName}
    />
  )
}

function MemoryAssets({
  canContribute = true,
  canEdit = true,
  memoryId,
  subjectName,
  runAuthenticatedRequest,
}) {
  const fileInputRef = useRef(null)
  const [assets, setAssets] = useState([])
  const [selectedFile, setSelectedFile] =
    useState(null)
  const [form, setForm] = useState({
    displayName: '',
    description: '',
  })
  const [isLoading, setIsLoading] =
    useState(true)
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [busyAssetId, setBusyAssetId] =
    useState('')
  const [editingAssetId, setEditingAssetId] =
    useState('')
  const [metadataDraft, setMetadataDraft] =
    useState({
      displayName: '',
      description: '',
    })
  const [errorMessage, setErrorMessage] =
    useState('')
  const [successMessage, setSuccessMessage] =
    useState('')

  const fetchAssets = useCallback(
    () =>
      runAuthenticatedRequest(
        (accessToken) =>
          listMemoryAssets(
            accessToken,
            memoryId,
          ),
      ),
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    async function loadAssets() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedAssets = await fetchAssets()

        if (isActive) {
          setAssets(loadedAssets)
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            getAssetErrorMessage(error),
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadAssets()

    return () => {
      isActive = false
    }
  }, [fetchAssets])

  const hasActiveProcessingAssets =
    assets.some((asset) =>
      [
        'queued',
        'processing',
      ].includes(
        asset.processingStatus,
      ),
    )

  useEffect(() => {
    if (!hasActiveProcessingAssets) {
      return undefined
    }

    let isActive = true

    const interval = setInterval(
      async () => {
        try {
          const loadedAssets =
            await fetchAssets()

          if (isActive) {
            setAssets(loadedAssets)
          }
        } catch {
          // Manual refresh remains available if polling fails.
        }
      },
      2_500,
    )

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [
    fetchAssets,
    hasActiveProcessingAssets,
  ])

  function handleFormChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]

    setErrorMessage('')
    setSuccessMessage('')

    if (!file) {
      setSelectedFile(null)
      return
    }

    const mimeType = resolveMimeType(file)

    if (!mimeType) {
      event.target.value = ''
      setSelectedFile(null)
      setErrorMessage(
        'אפשר להעלות JPG, PNG, WebP או PDF בלבד.',
      )
      return
    }

    if (
      file.size < 1 ||
      file.size > MAX_ASSET_SIZE_BYTES
    ) {
      event.target.value = ''
      setSelectedFile(null)
      setErrorMessage(
        'אפשר להעלות קובץ בגודל של עד 10MB.',
      )
      return
    }

    setSelectedFile(
      normalizeUploadFile(file, mimeType),
    )

    if (!form.displayName.trim()) {
      setForm((current) => ({
        ...current,
        displayName:
          removeFileExtension(file.name)
            .slice(0, 120),
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedFile) {
      setErrorMessage(
        'יש לבחור תמונה או מסמך PDF.',
      )
      return
    }

    setIsSubmitting(true)

    try {
      const asset =
        await runAuthenticatedRequest(
          (accessToken) =>
            uploadMemoryAsset(
              accessToken,
              memoryId,
              {
                file: selectedFile,
                displayName:
                  form.displayName.trim(),
                description:
                  form.description.trim(),
              },
            ),
        )

      setAssets((current) => [
        asset,
        ...current,
      ])
      setSelectedFile(null)
      setForm({
        displayName: '',
        description: '',
      })

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setSuccessMessage(
        'הקובץ נשמר באחסון הפרטי ונשלח לעיבוד מאובטח ברקע.',
      )
    } catch (error) {
      setErrorMessage(
        getAssetErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleFileAction(
    asset,
    action,
  ) {
    setBusyAssetId(asset.id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const access =
        await runAuthenticatedRequest(
          (accessToken) =>
            createMemoryAssetAccessLink(
              accessToken,
              memoryId,
              asset.id,
              action === 'download'
                ? 'attachment'
                : 'inline',
            ),
        )

      const anchor =
        document.createElement('a')

      anchor.href = access.url

      if (action !== 'download') {
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
      }

      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      setErrorMessage(
        getAssetErrorMessage(error),
      )
    } finally {
      setBusyAssetId('')
    }
  }

  function startEditingMetadata(asset) {
    setEditingAssetId(asset.id)
    setMetadataDraft({
      displayName: asset.displayName,
      description:
        asset.description ?? '',
    })
    setErrorMessage('')
    setSuccessMessage('')
  }

  function cancelEditingMetadata() {
    setEditingAssetId('')
    setMetadataDraft({
      displayName: '',
      description: '',
    })
  }

  function handleMetadataChange(event) {
    const { name, value } = event.target

    setMetadataDraft((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleMetadataSubmit(
    event,
    asset,
  ) {
    event.preventDefault()
    setBusyAssetId(asset.id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedAsset =
        await runAuthenticatedRequest(
          (accessToken) =>
            updateMemoryAssetMetadata(
              accessToken,
              memoryId,
              asset.id,
              {
                displayName:
                  metadataDraft.displayName.trim(),
                description:
                  metadataDraft.description.trim(),
              },
            ),
        )

      setAssets((current) =>
        current.map((item) =>
          item.id === updatedAsset.id
            ? updatedAsset
            : item,
        ),
      )
      cancelEditingMetadata()
      setSuccessMessage(
        'פרטי הקובץ עודכנו בהצלחה.',
      )
    } catch (error) {
      setErrorMessage(
        getAssetErrorMessage(error),
      )
    } finally {
      setBusyAssetId('')
    }
  }

  async function handleArchive(asset) {
    const shouldArchive = window.confirm(
      `האם להעביר את "${asset.displayName}" לארכיון? הקובץ לא יימחק לצמיתות.`,
    )

    if (!shouldArchive) {
      return
    }

    setBusyAssetId(asset.id)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await runAuthenticatedRequest(
        (accessToken) =>
          archiveMemoryAsset(
            accessToken,
            memoryId,
            asset.id,
          ),
      )

      setAssets((current) =>
        current.filter(
          (item) => item.id !== asset.id,
        ),
      )
      setSuccessMessage(
        'הקובץ הועבר לארכיון. הוא לא נמחק מהאחסון.',
      )
    } catch (error) {
      setErrorMessage(
        getAssetErrorMessage(error),
      )
    } finally {
      setBusyAssetId('')
    }
  }

  return (
    <section
      className="memory-assets-workspace"
      aria-labelledby="memory-assets-title"
    >
      <div className="memory-assets-heading">
        <div>
          <p className="panel-kicker">
            אלבום ומסמכים פרטיים
          </p>
          <h2 id="memory-assets-title">
            תמונות ומסמכים של {subjectName}
          </h2>
          <p>
            {canContribute
              ? 'העלו תמונות או מסמכי PDF. '
              : 'כאן נשמרים התמונות והמסמכים של הארכיון. '}
            הקבצים נשמרים
            באופן פרטי ואינם נשלחים לשירות AI או לספק
            חיצוני.
          </p>
        </div>

        <span className="memory-assets-count">
          {assets.length}
        </span>
      </div>

      {errorMessage && (
        <p
          className="form-error memory-assets-message"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="story-success memory-assets-message"
          role="status"
        >
          {successMessage}
        </p>
      )}

      <div
        className={`memory-assets-layout ${
          canContribute
            ? ''
            : 'memory-assets-layout-view-only'
        }`}
      >
        {canContribute && (
        <form
          className="memory-asset-upload-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          <div>
            <h3>הוספת קובץ</h3>
            <p>
              JPG, PNG, WebP או PDF, עד 10MB.
            </p>
          </div>

          <label className="memory-asset-field">
            <span>בחירת קובץ</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              required
            />
          </label>

          <label className="memory-asset-field">
            <span>שם שיוצג בזיכרון</span>
            <input
              type="text"
              name="displayName"
              value={form.displayName}
              onChange={handleFormChange}
              minLength={2}
              maxLength={120}
              required
            />
          </label>

          <label className="memory-asset-field">
            <span>תיאור קצר — לא חובה</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              maxLength={500}
              rows={4}
            />
          </label>

          <p className="memory-assets-privacy-note">
            הצפייה וההורדה יוצרות קישור פרטי קצר־מועד
            רק לאחר בדיקת הרשאה לזיכרון. העברה לארכיון
            אינה מוחקת את הקובץ.
          </p>

          <button
            className="primary-button"
            type="submit"
            data-aura-tooltip="להעלות את הקובץ לארכיון הפרטי"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'שומרים באופן פרטי...'
              : 'העלאת הקובץ'}
          </button>
        </form>
        )}

        <div className="memory-assets-list-panel">
          <h3>הקבצים שנשמרו</h3>

          {isLoading ? (
            <div className="memory-assets-empty">
              טוענים את הקבצים...
            </div>
          ) : assets.length === 0 ? (
            <div className="memory-assets-empty">
              <strong>עדיין אין קבצים</strong>
              <p>הקובץ הראשון שתעלו יופיע כאן.</p>
            </div>
          ) : (
            <div className="memory-assets-grid">
              {assets.map((asset) => {
                const technicalMetadataLabel =
                  getTechnicalMetadataLabel(
                    asset,
                  )

                return (
                  <article
                  className="memory-asset-card"
                  key={asset.id}
                >
                  <div className="memory-asset-visual">
                    {asset.assetType === 'image' ? (
                      <MemoryAssetPreview
                        asset={asset}
                        memoryId={memoryId}
                        runAuthenticatedRequest={runAuthenticatedRequest}
                      />
                    ) : (
                      <div className="memory-asset-document-icon">
                        <span aria-hidden="true">PDF</span>
                        מסמך פרטי
                      </div>
                    )}
                  </div>

                  <div className="memory-asset-card-body">
                    {canEdit &&
                    editingAssetId === asset.id ? (
                      <form
                        className="memory-asset-metadata-form"
                        onSubmit={(event) =>
                          handleMetadataSubmit(
                            event,
                            asset,
                          )
                        }
                      >
                        <label>
                          <span>שם שיוצג בזיכרון</span>
                          <input
                            type="text"
                            name="displayName"
                            value={metadataDraft.displayName}
                            minLength={2}
                            maxLength={120}
                            disabled={busyAssetId === asset.id}
                            onChange={handleMetadataChange}
                            required
                          />
                        </label>

                        <label>
                          <span>תיאור קצר</span>
                          <textarea
                            name="description"
                            value={metadataDraft.description}
                            maxLength={500}
                            rows={3}
                            disabled={busyAssetId === asset.id}
                            onChange={handleMetadataChange}
                          />
                        </label>

                        <div>
                          <button
                            type="submit"
                            data-aura-tooltip="לשמור את שם הקובץ ותיאורו"
                            disabled={
                              busyAssetId === asset.id ||
                              metadataDraft.displayName.trim().length < 2
                            }
                          >
                            {busyAssetId === asset.id
                              ? 'שומרים...'
                              : 'שמירת הפרטים'}
                          </button>

                          <button
                            type="button"
                            disabled={busyAssetId === asset.id}
                            onClick={cancelEditingMetadata}
                          >
                            ביטול
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h4>{asset.displayName}</h4>

                        {asset.description && (
                          <p>{asset.description}</p>
                        )}
                      </>
                    )}

                    <dl>
                      <div>
                        <dt>גודל</dt>
                        <dd>
                          {formatFileSize(
                            asset.sizeBytes,
                          )}
                        </dd>
                      </div>

                      {asset.createdAt && (
                        <div>
                          <dt>נוסף</dt>
                          <dd>
                            {formatDate(
                              asset.createdAt,
                            )}
                          </dd>
                        </div>
                      )}

                      {technicalMetadataLabel && (
                        <div>
                          <dt>פרטים טכניים</dt>
                          <dd>
                            {technicalMetadataLabel}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {PROCESSING_STATUS_LABELS[
                      asset.processingStatus
                    ] && (
                      <div
                        className={`memory-asset-processing memory-asset-processing-${asset.processingStatus}`}
                        role={
                          asset.processingStatus === 'failed'
                            ? 'alert'
                            : 'status'
                        }
                      >
                        <span>
                          {
                            PROCESSING_STATUS_LABELS[
                              asset.processingStatus
                            ]
                          }
                        </span>

                        {[
                          'queued',
                          'processing',
                        ].includes(
                          asset.processingStatus,
                        ) && (
                          <progress
                            max="100"
                            value={
                              asset.processingProgress ??
                              0
                            }
                            aria-label="התקדמות עיבוד הקובץ"
                          />
                        )}
                      </div>
                    )}

                    {editingAssetId !== asset.id && (
                      <div className="memory-asset-actions">
                        {canEdit && (
                          <button
                            type="button"
                            data-aura-tooltip="לערוך את שם הקובץ ותיאורו"
                            disabled={
                              busyAssetId === asset.id
                            }
                            onClick={() =>
                              startEditingMetadata(asset)
                            }
                          >
                            עריכת פרטים
                          </button>
                        )}

                        <button
                          type="button"
                          data-aura-tooltip="לפתוח תצוגה פרטית של הקובץ"
                          disabled={
                            busyAssetId === asset.id
                          }
                          onClick={() =>
                            handleFileAction(
                              asset,
                              'view',
                            )
                          }
                        >
                          צפייה
                        </button>

                        <button
                          type="button"
                          data-aura-tooltip="להוריד עותק פרטי של הקובץ"
                          disabled={
                            busyAssetId === asset.id
                          }
                          onClick={() =>
                            handleFileAction(
                              asset,
                              'download',
                            )
                          }
                        >
                          הורדה
                        </button>

                        {canEdit && (
                          <button
                            className="memory-asset-archive-button"
                            type="button"
                            data-aura-tooltip="להעביר את הקובץ מהארכיון הפעיל"
                            disabled={
                              busyAssetId === asset.id
                            }
                            onClick={() =>
                              handleArchive(asset)
                            }
                          >
                            העברה לארכיון
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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

export default MemoryAssets
