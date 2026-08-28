import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const MEMORY_PILOT_VERSION =
  'family-behavioral-pilot-v1'

export const MEMORY_PILOT_STATUSES =
  Object.freeze([
    'active',
    'withdrawn',
  ])

const memoryPilotEnrollmentSchema =
  new Schema(
    {
      memoryId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryProfile',
        required: true,
        immutable: true,
      },

      ownerUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
      },

      startedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
      },

      version: {
        type: String,
        enum: [MEMORY_PILOT_VERSION],
        required: true,
        immutable: true,
      },

      status: {
        type: String,
        enum: MEMORY_PILOT_STATUSES,
        default: 'active',
      },

      startedAt: {
        type: Date,
        required: true,
        immutable: true,
      },

      endsAt: {
        type: Date,
        required: true,
        immutable: true,
      },

      withdrawnAt: {
        type: Date,
        default: null,
      },
    },
    {
      collection:
        'memory_pilot_enrollments',
      timestamps: true,
      versionKey: false,
      toJSON: {
        transform(
          _document,
          returnedObject,
        ) {
          const safeObject = {
            ...returnedObject,
          }

          if (safeObject._id) {
            safeObject.id =
              safeObject._id.toString()

            delete safeObject._id
          }

          delete safeObject.ownerUserId
          delete safeObject.startedByUserId

          return safeObject
        },
      },
    },
  )

memoryPilotEnrollmentSchema.pre(
  'validate',
  function validatePilotWindow() {
    if (
      this.startedAt &&
      this.endsAt &&
      this.endsAt <= this.startedAt
    ) {
      this.invalidate(
        'endsAt',
        'Pilot end must follow its start.',
      )
    }

    if (
      this.status === 'active' &&
      this.withdrawnAt
    ) {
      this.invalidate(
        'withdrawnAt',
        'Active pilots cannot have a withdrawal timestamp.',
      )
    }

    if (
      this.status === 'withdrawn' &&
      !this.withdrawnAt
    ) {
      this.invalidate(
        'withdrawnAt',
        'Withdrawn pilots require a withdrawal timestamp.',
      )
    }
  },
)

memoryPilotEnrollmentSchema.index(
  {
    memoryId: 1,
  },
  {
    unique: true,
    name:
      'memory_pilot_enrollments_memory_unique',
  },
)

memoryPilotEnrollmentSchema.index(
  {
    status: 1,
    startedAt: -1,
  },
  {
    name:
      'memory_pilot_enrollments_status_started',
  },
)

const MemoryPilotEnrollment =
  models.MemoryPilotEnrollment ??
  model(
    'MemoryPilotEnrollment',
    memoryPilotEnrollmentSchema,
  )

export default MemoryPilotEnrollment
