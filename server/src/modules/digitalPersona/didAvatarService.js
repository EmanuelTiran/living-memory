import { Buffer } from 'node:buffer'
import { AppError } from '../../errors/AppError.js'
import {
  assertCanChatWithMemory,
} from '../memories/memoryAccessService.js'
import {
  generateMemoryChatMessageSpeech,
  generateMemoryChatMessageSpeechChunk,
} from '../voice/speechService.js'
import {
  getMemoryAssetFile,
} from '../media/memoryAssetService.js'
import AvatarProfile from './AvatarProfile.js'
import ConsentRecord from './ConsentRecord.js'
import {
  completeDIDAvatarJob,
  createDIDAvatarJob,
  failDIDAvatarJob,
  getDIDAvatarJobStatus,
  getDIDAvatarJobVideo,
} from './didAvatarJobStore.js'
import {
  createDIDRealtimeAudioGrant,
  takeDIDRealtimeAudioGrant,
} from './didRealtimeAudioStore.js'
import {
  createDIDRealtimeAudio,
  deleteDIDRealtimeAudio,
  generateDIDAvatarVideo,
  isDIDAvatarProviderConfigured,
  isDIDRealtimeAvatarConfigured,
} from './providers/didAvatarProvider.js'

function createAvatarUnavailableError() {
  return new AppError(
    'The approved D-ID avatar is unavailable.',
    {
      statusCode: 409,
      code: 'DID_AVATAR_UNAVAILABLE',
    },
  )
}

function createAvatarNotConfiguredError() {
  return new AppError(
    'The D-ID avatar service is not configured.',
    {
      statusCode: 503,
      code: 'DID_NOT_CONFIGURED',
    },
  )
}

function createRealtimeAvatarNotConfiguredError() {
  return new AppError(
    'The D-ID realtime avatar service is not configured.',
    {
      statusCode: 503,
      code:
        'DID_REALTIME_NOT_CONFIGURED',
    },
  )
}

async function requireActiveDIDAvatar(
  memoryId,
) {
  const profileQuery =
    AvatarProfile.findOne({
      memoryId,
      provider: 'd-id',
      profileType: 'stylized',
      status: 'ready',
      isPhotorealistic: false,
    })
      .select({
        consentRecordId: 1,
        providerProfileId: 1,
      })
      .lean()

  const profile = await profileQuery

  if (!profile) {
    throw createAvatarUnavailableError()
  }

  const consentQuery =
    ConsentRecord.findOne({
      _id: profile.consentRecordId,
      memoryId,
      status: 'approved',
      subjectStatus: 'living',
      relationshipToSubject: 'self',
      processingScope: {
        $in: [
          'external_avatar',
          'external_voice_and_avatar',
        ],
      },
      'externalAvatarConsent.provider':
        'd-id',
      'externalAvatarConsent.modelFamily':
        'talks-v2-photo',
      'externalAvatarConsent.providerAssetId':
        profile.providerProfileId,
    })
      .select({
        externalAvatarConsent: 1,
      })
      .lean()

  const consent = await consentQuery

  if (!consent) {
    throw createAvatarUnavailableError()
  }

  return profile.providerProfileId
}

async function runDIDJob(
  jobId,
  audioBuffer,
  audioContentType,
  imageBuffer,
  imageContentType,
) {
  try {
    const video =
      await generateDIDAvatarVideo({
        audioBuffer,
        audioContentType,
        imageBuffer,
        imageContentType,
      })

    completeDIDAvatarJob(
      jobId,
      video,
    )
  } catch (error) {
    failDIDAvatarJob(jobId, error)
  } finally {
    audioBuffer.fill(0)
    imageBuffer.fill(0)
  }
}

export async function generateMemoryChatAvatarSpeech(
  userId,
  memoryId,
  conversationId,
  messageId,
) {
  await assertCanChatWithMemory(
    userId,
    memoryId,
  )

  if (!isDIDAvatarProviderConfigured()) {
    throw createAvatarNotConfiguredError()
  }

  const portraitAssetId =
    await requireActiveDIDAvatar(
      memoryId,
    )

  const speech =
    await generateMemoryChatMessageSpeech(
      userId,
      memoryId,
      conversationId,
      messageId,
      {
        preferClonedVoice: true,
      },
    )

  const {
    asset: portraitAsset,
    buffer: portraitBuffer,
  } = await getMemoryAssetFile(
    userId,
    memoryId,
    portraitAssetId,
  )

  if (portraitAsset.assetType !== 'image') {
    portraitBuffer.fill(0)
    throw createAvatarUnavailableError()
  }

  const avatarAudioBuffer = Buffer.from(
    speech.audioBuffer,
  )

  const jobId = createDIDAvatarJob({
    userId,
    memoryId,
    conversationId,
    messageId,
  })

  void runDIDJob(
    jobId,
    avatarAudioBuffer,
    speech.contentType,
    portraitBuffer,
    portraitAsset.mimeType,
  )

  return {
    speech,
    jobId,
  }
}

export async function generateMemoryChatRealtimeAvatarSpeech(
  userId,
  memoryId,
  conversationId,
  messageId,
) {
  await assertCanChatWithMemory(
    userId,
    memoryId,
  )

  if (!isDIDRealtimeAvatarConfigured()) {
    throw createRealtimeAvatarNotConfiguredError()
  }

  await requireActiveDIDAvatar(memoryId)

  const speech =
    await generateMemoryChatMessageSpeech(
      userId,
      memoryId,
      conversationId,
      messageId,
      {
        preferClonedVoice: true,
      },
    )

  const realtimeAudio =
    await createDIDRealtimeAudio({
      audioBuffer: speech.audioBuffer,
      audioContentType:
        speech.contentType,
    })

  let releaseToken

  try {
    releaseToken =
      createDIDRealtimeAudioGrant({
        userId,
        memoryId,
        conversationId,
        messageId,
        resourceId:
          realtimeAudio.resourceId,
        onExpire:
          deleteDIDRealtimeAudio,
      })
  } catch (error) {
    await deleteDIDRealtimeAudio(
      realtimeAudio.resourceId,
    )

    throw error
  }

  return {
    speech,
    audioUrl: realtimeAudio.audioUrl,
    releaseToken,
  }
}

export async function generateMemoryChatRealtimeAvatarSpeechChunk(
  userId,
  memoryId,
  conversationId,
  messageId,
  chunkIndex,
) {
  await assertCanChatWithMemory(
    userId,
    memoryId,
  )

  if (!isDIDRealtimeAvatarConfigured()) {
    throw createRealtimeAvatarNotConfiguredError()
  }

  await requireActiveDIDAvatar(memoryId)

  const speechChunk =
    await generateMemoryChatMessageSpeechChunk(
      userId,
      memoryId,
      conversationId,
      messageId,
      chunkIndex,
      {
        preferClonedVoice: true,
      },
    )

  const realtimeAudio =
    await createDIDRealtimeAudio({
      audioBuffer:
        speechChunk.speech.audioBuffer,
      audioContentType:
        speechChunk.speech.contentType,
    })

  let releaseToken

  try {
    releaseToken =
      createDIDRealtimeAudioGrant({
        userId,
        memoryId,
        conversationId,
        messageId,
        resourceId:
          realtimeAudio.resourceId,
        onExpire:
          deleteDIDRealtimeAudio,
      })
  } catch (error) {
    await deleteDIDRealtimeAudio(
      realtimeAudio.resourceId,
    )

    throw error
  }

  return {
    ...speechChunk,
    audioUrl: realtimeAudio.audioUrl,
    releaseToken,
  }
}

export async function releaseMemoryChatRealtimeAvatarAudio(
  userId,
  memoryId,
  releaseToken,
) {
  await assertCanChatWithMemory(
    userId,
    memoryId,
  )

  const resource =
    takeDIDRealtimeAudioGrant({
      token: releaseToken,
      userId,
      memoryId,
    })

  await deleteDIDRealtimeAudio(
    resource.resourceId,
  )
}

export function readMemoryChatAvatarJob(
  userId,
  memoryId,
  jobId,
) {
  return getDIDAvatarJobStatus({
    userId,
    memoryId,
    jobId,
  })
}

export function readMemoryChatAvatarVideo(
  userId,
  memoryId,
  jobId,
) {
  return getDIDAvatarJobVideo({
    userId,
    memoryId,
    jobId,
  })
}
