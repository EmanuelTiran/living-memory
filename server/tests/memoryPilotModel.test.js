import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryPilotEnrollment, {
  MEMORY_PILOT_VERSION,
} from '../src/modules/memories/MemoryPilotEnrollment.js'

const memoryId =
  '507f1f77bcf86cd799439010'
const ownerUserId =
  '507f1f77bcf86cd799439011'
const startedByUserId =
  '507f1f77bcf86cd799439012'
const startedAt = new Date(
  '2026-08-01T00:00:00.000Z',
)
const endsAt = new Date(
  '2026-08-29T00:00:00.000Z',
)

function createEnrollment(overrides = {}) {
  return new MemoryPilotEnrollment({
    memoryId,
    ownerUserId,
    startedByUserId,
    version: MEMORY_PILOT_VERSION,
    status: 'active',
    startedAt,
    endsAt,
    ...overrides,
  })
}

describe('Memory pilot enrollment model', () => {
  it('stores the fixed pilot window without exposing user identifiers', async () => {
    const enrollment = createEnrollment()

    await enrollment.validate()

    const publicEnrollment =
      enrollment.toJSON()

    expect(publicEnrollment.version).toBe(
      MEMORY_PILOT_VERSION,
    )
    expect(publicEnrollment.startedAt)
      .toEqual(startedAt)
    expect(publicEnrollment.endsAt)
      .toEqual(endsAt)
    expect(publicEnrollment)
      .not.toHaveProperty('ownerUserId')
    expect(publicEnrollment)
      .not.toHaveProperty('startedByUserId')
  })

  it('requires a timestamp when participation is withdrawn', async () => {
    const enrollment = createEnrollment({
      status: 'withdrawn',
    })

    await expect(
      enrollment.validate(),
    ).rejects.toMatchObject({
      errors: {
        withdrawnAt: expect.anything(),
      },
    })
  })

  it('rejects a pilot end before its start', async () => {
    const enrollment = createEnrollment({
      endsAt: new Date(
        '2026-07-31T00:00:00.000Z',
      ),
    })

    await expect(
      enrollment.validate(),
    ).rejects.toMatchObject({
      errors: {
        endsAt: expect.anything(),
      },
    })
  })
})
