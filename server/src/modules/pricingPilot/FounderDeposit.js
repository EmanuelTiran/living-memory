import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const FOUNDER_DEPOSIT_VERSION =
  'founder-deposit-pilot-v1'

export const FOUNDER_DEPOSIT_AMOUNT_MINOR =
  4900

export const FOUNDER_DEPOSIT_CURRENCY =
  'USD'

export const FOUNDER_DEPOSIT_STATUSES =
  Object.freeze([
    'offered',
    'interested',
    'declined',
    'paid',
    'refunded',
  ])

export const FOUNDER_DEPOSIT_EVENTS =
  Object.freeze([
    'offered',
    'interest_confirmed',
    'declined',
    'payment_verified',
    'refunded',
  ])

const evidenceSchema = new Schema(
  {
    referenceHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
    },

    verifiedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    verifiedAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  },
)

const historyEntrySchema = new Schema(
  {
    event: {
      type: String,
      enum: FOUNDER_DEPOSIT_EVENTS,
      required: true,
    },

    actorType: {
      type: String,
      enum: ['owner', 'admin'],
      required: true,
    },

    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    occurredAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  },
)

const founderDepositSchema = new Schema(
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

    participantCode: {
      type: String,
      required: true,
      immutable: true,
      uppercase: true,
      match: /^[A-F0-9]{16}$/,
    },

    version: {
      type: String,
      enum: [FOUNDER_DEPOSIT_VERSION],
      required: true,
      immutable: true,
    },

    amountMinor: {
      type: Number,
      enum: [FOUNDER_DEPOSIT_AMOUNT_MINOR],
      required: true,
      immutable: true,
    },

    currency: {
      type: String,
      enum: [FOUNDER_DEPOSIT_CURRENCY],
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: FOUNDER_DEPOSIT_STATUSES,
      default: 'offered',
    },

    offeredAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    interestedAt: {
      type: Date,
      default: null,
    },

    declinedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    paymentEvidence: {
      type: evidenceSchema,
      default: null,
    },

    refundEvidence: {
      type: evidenceSchema,
      default: null,
    },

    statusHistory: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  {
    collection: 'founder_deposits',
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

        delete safeObject.memoryId
        delete safeObject.ownerUserId
        delete safeObject.paymentEvidence
        delete safeObject.refundEvidence
        delete safeObject.statusHistory

        return safeObject
      },
    },
  },
)

founderDepositSchema.pre(
  'validate',
  function validateLifecycle() {
    if (
      ['interested', 'paid', 'refunded']
        .includes(this.status) &&
      !this.interestedAt
    ) {
      this.invalidate(
        'interestedAt',
        'Interested deposits require an interest timestamp.',
      )
    }

    if (
      ['paid', 'refunded'].includes(
        this.status,
      ) &&
      (!this.paidAt ||
        !this.paymentEvidence)
    ) {
      this.invalidate(
        'paidAt',
        'Paid deposits require verified payment evidence.',
      )
    }

    if (
      this.status === 'refunded' &&
      (!this.refundedAt ||
        !this.refundEvidence)
    ) {
      this.invalidate(
        'refundedAt',
        'Refunded deposits require verified refund evidence.',
      )
    }

    if (
      this.status !== 'refunded' &&
      (this.refundedAt ||
        this.refundEvidence)
    ) {
      this.invalidate(
        'refundedAt',
        'Only refunded deposits may contain refund evidence.',
      )
    }
  },
)

founderDepositSchema.index(
  {
    memoryId: 1,
  },
  {
    unique: true,
    name: 'founder_deposits_memory_unique',
  },
)

founderDepositSchema.index(
  {
    participantCode: 1,
  },
  {
    unique: true,
    name:
      'founder_deposits_participant_code_unique',
  },
)

founderDepositSchema.index(
  {
    status: 1,
    offeredAt: -1,
  },
  {
    name:
      'founder_deposits_status_offered',
  },
)

const FounderDeposit =
  models.FounderDeposit ??
  model(
    'FounderDeposit',
    founderDepositSchema,
  )

export default FounderDeposit
