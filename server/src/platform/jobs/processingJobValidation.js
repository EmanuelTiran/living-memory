import { z } from 'zod'
import {
  PROCESSING_JOB_TYPES,
} from './ProcessingJob.js'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern)

function hasBoundedJsonSize(value) {
  try {
    return (
      Buffer.byteLength(
        JSON.stringify(value),
        'utf8',
      ) <= 8 * 1024
    )
  } catch {
    return false
  }
}

export const enqueueProcessingJobSchema =
  z.strictObject({
    memoryId: objectIdSchema,
    jobType: z.enum(
      PROCESSING_JOB_TYPES,
    ),
    idempotencyKey: z
      .string()
      .trim()
      .min(10)
      .max(220),
    resourceType: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/),
    resourceId: objectIdSchema,
    payload: z
      .record(z.string(), z.unknown())
      .refine(hasBoundedJsonSize),
    maxAttempts: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(3),
    availableAt: z.date().optional(),
  })

export const claimProcessingJobSchema =
  z.strictObject({
    workerId: z
      .string()
      .trim()
      .min(8)
      .max(120),
    jobTypes: z
      .array(
        z.enum(PROCESSING_JOB_TYPES),
      )
      .min(1),
    leaseMs: z
      .number()
      .int()
      .min(5_000)
      .max(15 * 60 * 1000),
    now: z.date(),
  })

export const processingJobLeaseSchema =
  z.strictObject({
    jobId: objectIdSchema,
    workerId: z
      .string()
      .trim()
      .min(8)
      .max(120),
  })

export const processingJobProgressSchema =
  processingJobLeaseSchema.extend({
    progress: z
      .number()
      .int()
      .min(0)
      .max(99),
  })
