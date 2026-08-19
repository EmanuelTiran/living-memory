import { Buffer } from 'node:buffer'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  completeDIDAvatarJob,
  createDIDAvatarJob,
  failDIDAvatarJob,
  getDIDAvatarJobStatus,
  getDIDAvatarJobVideo,
  resetDIDAvatarJobsForTests,
} from '../src/modules/digitalPersona/didAvatarJobStore.js'

const access = {
  userId: 'user-1',
  memoryId: 'memory-1',
}

function createJob() {
  return createDIDAvatarJob({
    ...access,
    conversationId: 'conversation-1',
    messageId: 'message-1',
  })
}

afterEach(() => {
  resetDIDAvatarJobsForTests()
})

describe('private D-ID avatar job store', () => {
  it('returns completed video only to the owning user and memory', () => {
    const jobId = createJob()
    const videoBuffer = Buffer.from(
      'private-video',
      'utf8',
    )

    completeDIDAvatarJob(jobId, {
      videoBuffer,
      byteLength: videoBuffer.length,
    })

    expect(
      getDIDAvatarJobStatus({
        ...access,
        jobId,
      }),
    ).toMatchObject({
      id: jobId,
      status: 'ready',
      videoAvailable: true,
    })

    expect(
      getDIDAvatarJobVideo({
        ...access,
        jobId,
      }),
    ).toMatchObject({
      videoBuffer,
      contentType: 'video/mp4',
      fileExtension: 'mp4',
    })

    expect(() =>
      getDIDAvatarJobVideo({
        userId: 'someone-else',
        memoryId: access.memoryId,
        jobId,
      }),
    ).toThrow()
  })

  it('exposes a safe provider error code without storing raw error details', () => {
    const jobId = createJob()

    failDIDAvatarJob(jobId, {
      code: 'DID_RATE_LIMITED',
      message: 'provider secret detail',
    })

    const status = getDIDAvatarJobStatus({
      ...access,
      jobId,
    })

    expect(status).toMatchObject({
      status: 'failed',
      errorCode: 'DID_RATE_LIMITED',
      videoAvailable: false,
    })

    expect(status).not.toHaveProperty(
      'message',
    )
  })
})
