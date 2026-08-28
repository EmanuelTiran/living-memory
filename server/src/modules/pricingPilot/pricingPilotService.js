import { randomBytes } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import MemoryPilotEnrollment from '../memories/MemoryPilotEnrollment.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import FounderDeposit, {
  FOUNDER_DEPOSIT_AMOUNT_MINOR,
  FOUNDER_DEPOSIT_CURRENCY,
  FOUNDER_DEPOSIT_VERSION,
} from './FounderDeposit.js'
import {
  createPricingProgramSummary,
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

function createOwnerRequiredError() {
  return new AppError(
    'Only the memory owner can join the pricing pilot.',
    {
      statusCode: 403,
      code: 'PRICING_PILOT_OWNER_REQUIRED',
    },
  )
}

function createEnrollmentRequiredError() {
  return new AppError(
    'The memory must join the behavioral pilot first.',
    {
      statusCode: 409,
      code:
        'BEHAVIORAL_PILOT_ENROLLMENT_REQUIRED',
    },
  )
}

function createOfferRequiredError() {
  return new AppError(
    'The founder deposit offer has not been created.',
    {
      statusCode: 409,
      code: 'FOUNDER_DEPOSIT_OFFER_REQUIRED',
    },
  )
}

function createPaidDecisionLockedError() {
  return new AppError(
    'A verified deposit can only be changed by an administrator.',
    {
      statusCode: 409,
      code: 'FOUNDER_DEPOSIT_DECISION_LOCKED',
    },
  )
}

async function requirePricingPilotOwner(
  userId,
  memoryId,
) {
  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  if (access.authorization.role !== 'owner') {
    throw createOwnerRequiredError()
  }

  return access.memoryProfile
}

async function getEligibleEnrollment(memoryId) {
  return MemoryPilotEnrollment.findOne({
    memoryId,
    status: 'active',
  })
}

function createParticipantCode() {
  return randomBytes(8)
    .toString('hex')
    .toUpperCase()
}

function appendHistory(
  deposit,
  {
    event,
    actorType,
    actorUserId,
    occurredAt,
  },
) {
  deposit.statusHistory.push({
    event,
    actorType,
    actorUserId,
    occurredAt,
  })
}

export async function getPricingPilot(
  userId,
  memoryId,
) {
  await requirePricingPilotOwner(
    userId,
    memoryId,
  )

  const [enrollment, deposit] =
    await Promise.all([
      getEligibleEnrollment(memoryId),
      FounderDeposit.findOne({
        memoryId,
        ownerUserId: userId,
      }),
    ])

  return {
    program: createPricingProgramSummary(),
    eligibility: {
      eligible: Boolean(enrollment),
      reason: enrollment
        ? null
        : 'behavioral_pilot_required',
    },
    deposit: serializeFounderDeposit(
      deposit,
    ),
  }
}

export async function createFounderOffer(
  userId,
  memoryId,
  now = new Date(),
) {
  assertValidNow(now)

  await requirePricingPilotOwner(
    userId,
    memoryId,
  )

  const enrollment =
    await getEligibleEnrollment(memoryId)

  if (!enrollment) {
    throw createEnrollmentRequiredError()
  }

  let deposit =
    await FounderDeposit.findOne({
      memoryId,
      ownerUserId: userId,
    })

  if (deposit) {
    return {
      created: false,
      program:
        createPricingProgramSummary(),
      deposit: serializeFounderDeposit(
        deposit,
      ),
    }
  }

  deposit = new FounderDeposit({
    memoryId,
    ownerUserId: userId,
    participantCode:
      createParticipantCode(),
    version: FOUNDER_DEPOSIT_VERSION,
    amountMinor:
      FOUNDER_DEPOSIT_AMOUNT_MINOR,
    currency: FOUNDER_DEPOSIT_CURRENCY,
    status: 'offered',
    offeredAt: now,
    statusHistory: [
      {
        event: 'offered',
        actorType: 'owner',
        actorUserId: userId,
        occurredAt: now,
      },
    ],
  })

  try {
    await deposit.save()
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }

    deposit =
      await FounderDeposit.findOne({
        memoryId,
        ownerUserId: userId,
      })

    if (!deposit) {
      throw error
    }

    return {
      created: false,
      program:
        createPricingProgramSummary(),
      deposit: serializeFounderDeposit(
        deposit,
      ),
    }
  }

  return {
    created: true,
    program: createPricingProgramSummary(),
    deposit: serializeFounderDeposit(
      deposit,
    ),
  }
}

export async function recordFounderDecision(
  userId,
  memoryId,
  decision,
  now = new Date(),
) {
  assertValidNow(now)

  await requirePricingPilotOwner(
    userId,
    memoryId,
  )

  const deposit =
    await FounderDeposit.findOne({
      memoryId,
      ownerUserId: userId,
    })

  if (!deposit) {
    throw createOfferRequiredError()
  }

  if (
    ['paid', 'refunded'].includes(
      deposit.status,
    )
  ) {
    throw createPaidDecisionLockedError()
  }

  if (decision === 'interested') {
    if (deposit.status !== 'interested') {
      deposit.status = 'interested'
      deposit.interestedAt ??= now
      deposit.declinedAt = null

      appendHistory(deposit, {
        event: 'interest_confirmed',
        actorType: 'owner',
        actorUserId: userId,
        occurredAt: now,
      })
    }
  } else if (
    decision === 'declined' &&
    deposit.status !== 'declined'
  ) {
    deposit.status = 'declined'
    deposit.declinedAt = now

    appendHistory(deposit, {
      event: 'declined',
      actorType: 'owner',
      actorUserId: userId,
      occurredAt: now,
    })
  } else if (decision !== 'declined') {
    throw new TypeError(
      'Founder decision is invalid.',
    )
  }

  await deposit.save()

  return {
    program: createPricingProgramSummary(),
    deposit: serializeFounderDeposit(
      deposit,
    ),
  }
}
