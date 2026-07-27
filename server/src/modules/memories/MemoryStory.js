import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value
    .split('-')
    .map(Number)

  const date = new Date(
    Date.UTC(year, month - 1, day),
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const memoryStorySchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 20000,
    },

    occurredOn: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator(value) {
          return (
            value.length === 0 ||
            isValidDateOnly(value)
          )
        },
        message:
          'Occurred date must use YYYY-MM-DD format.',
      },
    },

    status: {
      type: String,
      enum: [
        'draft',
        'approved',
        'archived',
      ],
      default: 'draft',
    },
  },
  {
    collection: 'memory_stories',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, returnedObject) {
        const safeObject = {
          ...returnedObject,
        }

        if (safeObject._id) {
          safeObject.id =
            safeObject._id.toString()

          delete safeObject._id
        }

        return safeObject
      },
    },
  },
)

memoryStorySchema.index(
  {
    memoryId: 1,
    status: 1,
    createdAt: -1,
  },
  {
    name: 'memory_stories_memory_status_created',
  },
)

memoryStorySchema.index(
  {
    authorId: 1,
    createdAt: -1,
  },
  {
    name: 'memory_stories_author_created',
  },
)

const MemoryStory =
  models.MemoryStory ??
  model('MemoryStory', memoryStorySchema)

export default MemoryStory