function MemoryStoryComposer({
  errorMessage,
  isSubmitting,
  onChange,
  onSubmit,
  storyForm,
  successMessage,
}) {
  return (
    <div className="story-form-panel">
      <div className="story-section-header">
        <p className="panel-kicker">
          מקור כתוב
        </p>
        <h2 id="stories-title">
          הוספת סיפור חיים
        </h2>
        <p>
          כתבו אירוע, זיכרון או סיפור
          משפחתי. הסיפור יישמר תחילה
          כטיוטה.
        </p>
      </div>

      <form
        className="story-form"
        onSubmit={onSubmit}
        aria-busy={isSubmitting}
      >
        <label className="form-field">
          <span>כותרת הסיפור</span>

          <input
            type="text"
            name="title"
            value={storyForm.title}
            onChange={onChange}
            minLength={2}
            maxLength={160}
            required
          />
        </label>

        <label className="form-field">
          <span>תוכן הסיפור</span>

          <textarea
            name="content"
            value={storyForm.content}
            onChange={onChange}
            minLength={10}
            maxLength={20000}
            rows={8}
            required
          />
        </label>

        <label className="form-field">
          <span>מתי זה קרה? לא חובה</span>

          <input
            type="date"
            name="occurredOn"
            value={storyForm.occurredOn}
            onChange={onChange}
          />
        </label>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p className="story-success" role="status">
            {successMessage}
          </p>
        )}

        <button
          className="primary-button story-submit-button"
          type="submit"
          data-aura-tooltip="לשמור את הסיפור כטיוטה בארכיון"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'שומרים את הסיפור...'
            : 'שמירת הסיפור'}
        </button>
      </form>
    </div>
  )
}

export default MemoryStoryComposer
