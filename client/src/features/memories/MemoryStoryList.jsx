function MemoryStoryList({
  actionErrorMessage,
  actionSuccessMessage,
  approvingStoryId,
  archivingStoryId,
  canEdit = true,
  editForm,
  editingStoryId,
  formatDate,
  formatDateOnly,
  getStoryStatusLabel,
  isStoryBusy,
  memoryStories,
  onApproveStory,
  onArchiveStory,
  onCancelEditingStory,
  onEditChange,
  onEditSubmit,
  onStartEditingStory,
  updatingStoryId,
}) {
  const currentHash =
    typeof window !== 'undefined'
      ? window.location.hash
      : ''

  return (
    <div className="story-list-panel">
      <div className="story-list-heading">
        <div>
          <p className="panel-kicker">
            סיפורי חיים
          </p>
          <h2 id="saved-stories-title">
            הסיפורים שנשמרו
          </h2>
        </div>

        <span className="story-count">
          {memoryStories.length}
        </span>
      </div>

      {actionErrorMessage && (
        <p
          className="form-error story-action-message"
          role="alert"
        >
          {actionErrorMessage}
        </p>
      )}

      {actionSuccessMessage && (
        <p
          className="story-success story-action-message"
          role="status"
        >
          {actionSuccessMessage}
        </p>
      )}

      {memoryStories.length === 0 ? (
        <div className="empty-stories">
          <strong>עדיין אין סיפורים</strong>
          <p>
            הסיפור הראשון שתוסיפו יופיע כאן.
          </p>
        </div>
      ) : (
        <div className="story-list">
          {memoryStories.map((story) => {
            const normalizedContent =
              story.content
                .trim()
                .replace(/\s+/g, ' ')
            const summaryExcerpt =
              normalizedContent.length > 150
                ? `${normalizedContent.slice(0, 147)}…`
                : normalizedContent

            return (
            <article
              id={`memory-story-${story.id}`}
              className="memory-story-card"
              key={story.id}
              tabIndex={-1}
            >
              {canEdit &&
              editingStoryId === story.id ? (
                <form
                  className="story-edit-form"
                  onSubmit={(event) =>
                    onEditSubmit(
                      event,
                      story.id,
                    )
                  }
                  aria-busy={
                    updatingStoryId === story.id
                  }
                >
                  <h3
                    id={`story-edit-title-${story.id}`}
                    tabIndex={-1}
                  >
                    עריכת הסיפור „{story.title}”
                  </h3>

                  <label className="form-field">
                    <span>כותרת הסיפור</span>

                    <input
                      type="text"
                      name="title"
                      value={editForm.title}
                      onChange={onEditChange}
                      minLength={2}
                      maxLength={160}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>תוכן הסיפור</span>

                    <textarea
                      name="content"
                      value={editForm.content}
                      onChange={onEditChange}
                      minLength={10}
                      maxLength={20000}
                      rows={7}
                      required
                    />
                  </label>

                  <label className="form-field">
                    <span>מתי זה קרה?</span>

                    <input
                      type="date"
                      name="occurredOn"
                      value={editForm.occurredOn}
                      onChange={onEditChange}
                    />
                  </label>

                  <p className="story-edit-notice">
                    לאחר שמירת השינוי הסיפור
                    יחזור למצב טיוטה ויידרש
                    אישור מחדש.
                  </p>

                  <div className="story-edit-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      data-aura-tooltip="לשמור את השינויים ולהחזיר לטיוטה"
                      disabled={
                        updatingStoryId ===
                        story.id
                      }
                    >
                      {updatingStoryId ===
                      story.id
                        ? 'שומרים...'
                        : 'שמירת השינויים'}
                    </button>

                    <button
                      className="secondary-button"
                      type="button"
                      disabled={
                        updatingStoryId ===
                        story.id
                      }
                      onClick={
                        onCancelEditingStory
                      }
                    >
                      ביטול
                    </button>
                  </div>
                </form>
              ) : (
                <details
                  className="memory-story-disclosure"
                  defaultOpen={
                    currentHash ===
                      `#memory-story-${story.id}`
                  }
                >
                  <summary
                    className="story-card-header"
                    data-aura-tooltip="לפתוח את הסיפור והפעולות שלו"
                  >
                    <div>
                      <h3>{story.title}</h3>

                      <div className="story-dates">
                        {story.occurredOn && (
                          <span>
                            התרחש:{' '}
                            {formatDateOnly(
                              story.occurredOn,
                            )}
                          </span>
                        )}

                        {story.createdAt && (
                          <span>
                            נוסף:{' '}
                            {formatDate(
                              story.createdAt,
                            )}
                          </span>
                        )}

                        <span>
                          גרסה{' '}
                          {story.revision ?? 1}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`story-status story-status-${story.status}`}
                    >
                      {getStoryStatusLabel(
                        story.status,
                      )}
                    </span>

                    <span className="story-summary-excerpt">
                      {summaryExcerpt}
                    </span>

                    <span className="story-disclosure-label">
                      <span className="story-disclosure-open-label">
                        פתיחת הסיפור והפעולות
                      </span>
                      <span className="story-disclosure-close-label">
                        סגירת הסיפור
                      </span>
                      <span aria-hidden="true">⌄</span>
                    </span>
                  </summary>

                  <div className="memory-story-disclosure-content">

                  <p className="story-content">
                    {story.content}
                  </p>

                  {story.revisionHistory
                    ?.length > 0 && (
                    <details className="source-revision-history">
                      <summary data-aura-tooltip="לפתוח גרסאות קודמות של הסיפור">
                        היסטוריית עריכות
                        {' · '}
                        {
                          story.revisionHistory
                            .length
                        }{' '}
                        גרסאות קודמות
                      </summary>

                      <div className="source-revision-list">
                        {story.revisionHistory
                          .slice()
                          .reverse()
                          .map((revision) => (
                            <article
                              className="source-revision-item"
                              key={`${story.id}-${revision.revision}-${revision.changedAt}`}
                            >
                              <div>
                                <strong>
                                  גרסה{' '}
                                  {
                                    revision.revision
                                  }
                                </strong>

                                <span>
                                  {revision.reviewStatus ===
                                  'approved'
                                    ? 'הייתה מאושרת'
                                    : 'הייתה טיוטה'}
                                </span>

                                {revision.changedAt && (
                                  <span>
                                    נשמרה עד{' '}
                                    {formatDate(
                                      revision.changedAt,
                                    )}
                                  </span>
                                )}
                              </div>

                              <h4>
                                {revision.title}
                              </h4>
                              <p>
                                {revision.content}
                              </p>
                            </article>
                          ))}
                      </div>
                    </details>
                  )}

                  {canEdit && (
                  <div className="story-card-actions">
                    {story.status === 'draft' && (
                      <button
                        className="story-action-button story-action-approve"
                        type="button"
                        data-aura-tooltip="לאשר את הסיפור כמקור משפחתי"
                        disabled={isStoryBusy(
                          story.id,
                        )}
                        onClick={() =>
                          onApproveStory(story.id)
                        }
                      >
                        {approvingStoryId ===
                        story.id
                          ? 'מאשרים...'
                          : 'אישור הסיפור'}
                      </button>
                    )}

                    <button
                      id={`story-edit-trigger-${story.id}`}
                      className="story-action-button story-action-edit"
                      type="button"
                      data-aura-tooltip="לערוך את הסיפור השמור"
                      disabled={isStoryBusy(
                        story.id,
                      )}
                      onClick={() =>
                        onStartEditingStory(
                          story,
                        )
                      }
                    >
                      עריכת הסיפור
                    </button>

                    <button
                      className="story-action-button story-action-archive"
                      type="button"
                      data-aura-tooltip="להעביר את הסיפור מהארכיון הפעיל"
                      disabled={isStoryBusy(
                        story.id,
                      )}
                      onClick={() =>
                        onArchiveStory(story)
                      }
                    >
                      {archivingStoryId ===
                      story.id
                        ? 'מעבירים...'
                        : 'העברה לארכיון'}
                    </button>
                  </div>
                  )}
                  </div>
                </details>
              )}
            </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MemoryStoryList
