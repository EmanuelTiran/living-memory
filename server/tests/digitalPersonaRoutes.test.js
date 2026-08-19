import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  getDigitalPersonaSetup: vi.fn(),
  acceptSelfConsent: vi.fn(),
  initializeMockProfiles: vi.fn(),
  activateChatVoiceInput: vi.fn(),
  activateVoiceClone: vi.fn(),
  revokeSelfConsent: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/digitalPersona/digitalPersonaService.js',
  () => ({
    getDigitalPersonaSetup:
      mocks.getDigitalPersonaSetup,
    acceptSelfConsent:
      mocks.acceptSelfConsent,
    initializeMockProfiles:
      mocks.initializeMockProfiles,
    activateChatVoiceInput:
      mocks.activateChatVoiceInput,
    activateVoiceClone:
      mocks.activateVoiceClone,
    revokeSelfConsent:
      mocks.revokeSelfConsent,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const setup = {
  subject: {
    status: 'living',
    relationship: 'self',
    name: 'עמנואל טירן',
  },
  providerMode: 'mock',
  externalMediaTransferAllowed: false,
  consent: null,
  voiceProfile: null,
  avatarProfile: null,
}

function authenticateRequest() {
  mocks.verifyAccessToken
    .mockResolvedValue(
      authentication,
    )
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.getDigitalPersonaSetup
    .mockResolvedValue(setup)

  mocks.acceptSelfConsent
    .mockResolvedValue({
      ...setup,
      consent: {
        id: 'consent-id',
        status: 'approved',
      },
    })

  mocks.initializeMockProfiles
    .mockResolvedValue({
      ...setup,
      voiceProfile: {
        id: 'voice-id',
        status: 'ready',
      },
      avatarProfile: {
        id: 'avatar-id',
        status: 'ready',
      },
    })

  mocks.activateVoiceClone
    .mockResolvedValue({
      ...setup,
      providerMode: 'elevenlabs',
      externalMediaTransferAllowed:
        true,
      voiceClone: {
        active: true,
      },
    })

  mocks.activateChatVoiceInput
    .mockResolvedValue({
      ...setup,
      externalMediaTransferAllowed:
        true,
      chatVoiceInput: {
        provider: 'openai',
        active: true,
        audioStored: false,
        autoSend: false,
      },
    })

  mocks.revokeSelfConsent
    .mockResolvedValue(setup)
})

describe('Digital persona routes', () => {
  it('returns the protected setup state', async () => {
    authenticateRequest()

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/digital-persona`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.getDigitalPersonaSetup,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        digitalPersona: setup,
      },
    })
  })

  it('stores explicit self consent', async () => {
    authenticateRequest()

    const input = {
      subjectNameConfirmation:
        'עמנואל טירן',
      confirmsOwnIdentity: true,
      permitsVoiceUse: true,
      permitsLikenessUse: true,
      understandsAiRepresentation: true,
      acceptsSafetyRestrictions: true,
    }

    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/digital-persona/consent`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send(input)

    expect(response.status).toBe(200)

    expect(
      mocks.acceptSelfConsent,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      input,
    )
  })

  it('rejects incomplete consent before the service runs', async () => {
    authenticateRequest()

    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/digital-persona/consent`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        subjectNameConfirmation:
          'עמנואל טירן',
        confirmsOwnIdentity: true,
      })

    expect(response.status).toBe(400)

    expect(response.body.error)
      .toMatchObject({
        code: 'VALIDATION_ERROR',
        requestId: expect.any(String),
      })

    expect(
      mocks.acceptSelfConsent,
    ).not.toHaveBeenCalled()
  })

  it('initializes mock profiles after consent', async () => {
    authenticateRequest()

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/digital-persona/mock-profiles`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(201)

    expect(
      mocks.initializeMockProfiles,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )
  })

  it('revokes consent and returns the disabled state', async () => {
    authenticateRequest()

    const response = await request(app)
      .delete(
        `/api/memories/${memoryId}/digital-persona/consent`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.revokeSelfConsent,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )
  })

  it('stores provider-specific consent before activating the custom voice', async () => {
    authenticateRequest()

    const input = {
      confirmsOwnVoice: true,
      confirmsExistingVoiceClone:
        true,
      permitsElevenLabsTextTransfer:
        true,
      understandsElevenLabsRetention:
        true,
    }

    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/digital-persona/voice-clone`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send(input)

    expect(response.status).toBe(200)

    expect(
      mocks.activateVoiceClone,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      input,
    )
  })

  it('stores separate OpenAI consent before enabling chat voice input', async () => {
    authenticateRequest()

    const input = {
      confirmsOwnVoice: true,
      permitsOpenAIAudioTransfer:
        true,
      understandsOpenAIProcessing:
        true,
      understandsAudioNotStored:
        true,
      understandsManualReview:
        true,
    }

    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/digital-persona/chat-voice-input`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send(input)

    expect(response.status).toBe(200)

    expect(
      mocks.activateChatVoiceInput,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      input,
    )
  })

  it('rejects incomplete chat voice-input consent before the service runs', async () => {
    authenticateRequest()

    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/digital-persona/chat-voice-input`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        confirmsOwnVoice: true,
      })

    expect(response.status).toBe(400)

    expect(
      mocks.activateChatVoiceInput,
    ).not.toHaveBeenCalled()
  })

  it('requires authentication for every digital persona action', async () => {
    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/digital-persona`,
      )

    expect(response.status).toBe(401)

    expect(
      mocks.getDigitalPersonaSetup,
    ).not.toHaveBeenCalled()
  })

  it('rejects an invalid memory identifier', async () => {
    authenticateRequest()

    const response = await request(app)
      .get(
        '/api/memories/invalid-id/digital-persona',
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(400)

    expect(
      mocks.getDigitalPersonaSetup,
    ).not.toHaveBeenCalled()
  })
})
