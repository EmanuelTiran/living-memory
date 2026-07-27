import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const memoryProfileSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    subjectName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    relationship: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    visibility: {
      type: String,
      enum: ['private', 'shared'],
      default: 'private',
    },

    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    collection: 'memory_profiles',
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

memoryProfileSchema.index(
  {
    ownerId: 1,
    createdAt: -1,
  },
  {
    name: 'memory_profiles_owner_created',
  },
)

memoryProfileSchema.index(
  {
    ownerId: 1,
    status: 1,
  },
  {
    name: 'memory_profiles_owner_status',
  },
)

const MemoryProfile =
  models.MemoryProfile ??
  model('MemoryProfile', memoryProfileSchema)

export default MemoryProfile