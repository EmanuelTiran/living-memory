import { describe, expect, it } from 'vitest'
import {
  createMemoryProfileSchema,
  updateMemoryProfileSchema,
} from '../src/modules/memories/validation.js'

describe('Memory-profile validation', () => {
  it('normalizes valid profile input', () => {
    const result =
      createMemoryProfileSchema.parse({
        subjectName: '  Sarah Cohen  ',
        subjectGender: 'female',
        relationship: '  Grandmother  ',
        description:
          '  Family stories and memories.  ',
      })

    expect(result).toEqual({
      subjectName: 'Sarah Cohen',
      subjectGender: 'female',
      relationship: 'Grandmother',
      description:
        'Family stories and memories.',
    })
  })

  it('accepts designated profile media identifiers and rejects unknown gender values', () => {
    const profileMediaId =
      '507f1f77bcf86cd799439011'

    const validResult =
      updateMemoryProfileSchema.safeParse({
        subjectGender: 'male',
        portraitAssetId:
          profileMediaId,
        voiceSampleRecordingId:
          profileMediaId,
      })

    expect(validResult.success).toBe(true)

    const invalidResult =
      createMemoryProfileSchema.safeParse({
        subjectName: 'Sarah Cohen',
        subjectGender: 'unknown',
      })

    expect(invalidResult.success).toBe(false)
  })

  it('accepts a profile with only a name', () => {
    const result =
      createMemoryProfileSchema.parse({
        subjectName: 'Sarah Cohen',
      })

    expect(result).toEqual({
      subjectName: 'Sarah Cohen',
    })
  })

  it('removes empty optional text', () => {
    const result =
      createMemoryProfileSchema.parse({
        subjectName: 'Sarah Cohen',
        relationship: '   ',
        description: '',
      })

    expect(result).toEqual({
      subjectName: 'Sarah Cohen',
      relationship: undefined,
      description: undefined,
    })
  })

  it('rejects invalid field lengths', () => {
    const result =
      createMemoryProfileSchema.safeParse({
        subjectName: 'A',
        relationship: 'R'.repeat(81),
        description: 'D'.repeat(1001),
      })

    expect(result.success).toBe(false)

    const paths = result.error.issues.map(
      (issue) => issue.path[0],
    )

    expect(paths).toContain('subjectName')
    expect(paths).toContain('relationship')
    expect(paths).toContain('description')
  })

  it('rejects protected fields from the client', () => {
    const result =
      createMemoryProfileSchema.safeParse({
        subjectName: 'Sarah Cohen',
        ownerId: 'another-user-id',
        visibility: 'shared',
        status: 'archived',
      })

    expect(result.success).toBe(false)

    expect(result.error.issues[0].code).toBe(
      'unrecognized_keys',
    )
  })
})