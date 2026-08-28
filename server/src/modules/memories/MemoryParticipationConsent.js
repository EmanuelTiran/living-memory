import mongoose from 'mongoose'
import {
  MEMORY_MEMBER_ROLES,
} from './MemoryMembership.js'

const { Schema, model, models } = mongoose

export const MEMORY_PARTICIPATION_POLICY_VERSION =
  'memory-participation-v1'

const participationAttestationsSchema =
  new Schema(
    {
      acceptsArchiveParticipation: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Archive participation must be accepted.',
        },
      },

      acceptsRecordingAndTranscription: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Recording and transcription terms must be accepted.',
        },
      },

      understandsGroundedAiUse: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Grounded AI use must be acknowledged.',
        },
      },
    },
    {
      _id: false,
    },
  )

const memoryParticipationConsentSchema =
  new Schema(
    {
      memoryId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryProfile',
        required: true,
        immutable: true,
      },

      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
      },

      invitationId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryInvitation',
        required: true,
        immutable: true,
      },

      role: {
        type: String,
        enum: MEMORY_MEMBER_ROLES,
        required: true,
        immutable: true,
      },

      policyVersion: {
        type: String,
        enum: [
          MEMORY_PARTICIPATION_POLICY_VERSION,
        ],
        required: true,
        immutable: true,
      },

      attestations: {
        type: participationAttestationsSchema,
        required: true,
        immutable: true,
      },

      acceptedAt: {
        type: Date,
        required: true,
        immutable: true,
      },
    },
    {
      collection:
        'memory_participation_consents',
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

          return safeObject
        },
      },
    },
  )

memoryParticipationConsentSchema.index(
  {
    invitationId: 1,
  },
  {
    unique: true,
    name:
      'memory_participation_consents_invitation_unique',
  },
)

memoryParticipationConsentSchema.index(
  {
    memoryId: 1,
    userId: 1,
    acceptedAt: -1,
  },
  {
    name:
      'memory_participation_consents_memory_user',
  },
)

const MemoryParticipationConsent =
  models.MemoryParticipationConsent ??
  model(
    'MemoryParticipationConsent',
    memoryParticipationConsentSchema,
  )

export default MemoryParticipationConsent
