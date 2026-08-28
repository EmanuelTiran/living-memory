import { createHash } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import FounderDeposit from './FounderDeposit.js'
import {
  serializeFounderDeposit,
} from './pricingPilotDefinition.js'

function assertValidNow(now) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      'Pricing pilot timestamp must be valid.',
    )
  }
}

function createParticipantUnavailableError() {
  return new AppError(
    'Pricing pilot participant was not found.',
    {
      statusCode: 404,
      code:
        'PRICING_PILOT_PARTICIPANT_NOT_FOUND',
    },
  )
}

function createPaymentStateError() {
  return new AppError(
    'The requested payment transition is not allowed.',
    {
      statusCode: 409,
      code:
        'FOUNDER_DEPOSIT_PAYMENT_STATE_INVALID',
    },
  )
}

function hashEvidenceReference(value) {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex')
}

function addAdminHistory(
  deposit,
  event,
  adminUserId,
  occurredAt,
) {
  deposit.statusHistory.push({
    event,
    actorType: 'admin',
    actorUserId: adminUserId,
    occurredAt,
  })
}

function evidenceMatches(
  evidence,
  referenceHash,
) {
  return evidence?.referenceHash ===
    referenceHash
}

export async function recordFounderPaymentAction(
  adminUserId,
  participantCode,
  {
    action,
    evidenceReference,
  },
  now = new Date(),
) {
  assertValidNow(now)

  const deposit =
    await FounderDeposit.findOne({
      participantCode,
    })

  if (!deposit) {
    throw createParticipantUnavailableError()
  }

  const referenceHash =
    hashEvidenceReference(
      evidenceReference,
    )

  if (action === 'verify_payment') {
    if (deposit.status === 'paid') {
      if (
        evidenceMatches(
          deposit.paymentEvidence,
          referenceHash,
        )
      ) {
        return serializeFounderDeposit(
          deposit,
        )
      }

      throw createPaymentStateError()
    }

    if (
      !['offered', 'interested']
        .includes(deposit.status)
    ) {
      throw createPaymentStateError()
    }

    deposit.status = 'paid'
    deposit.interestedAt ??= now
    deposit.declinedAt = null
    deposit.paidAt = now
    deposit.paymentEvidence = {
      referenceHash,
      verifiedByUserId: adminUserId,
      verifiedAt: now,
    }

    addAdminHistory(
      deposit,
      'payment_verified',
      adminUserId,
      now,
    )
  } else if (action === 'record_refund') {
    if (deposit.status === 'refunded') {
      if (
        evidenceMatches(
          deposit.refundEvidence,
          referenceHash,
        )
      ) {
        return serializeFounderDeposit(
          deposit,
        )
      }

      throw createPaymentStateError()
    }

    if (deposit.status !== 'paid') {
      throw createPaymentStateError()
    }

    deposit.status = 'refunded'
    deposit.refundedAt = now
    deposit.refundEvidence = {
      referenceHash,
      verifiedByUserId: adminUserId,
      verifiedAt: now,
    }

    addAdminHistory(
      deposit,
      'refunded',
      adminUserId,
      now,
    )
  } else {
    throw new TypeError(
      'Founder payment action is invalid.',
    )
  }

  await deposit.save()

  return serializeFounderDeposit(deposit)
}
