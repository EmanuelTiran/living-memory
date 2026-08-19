import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  findConsent: vi.fn(),
  createConsent: vi.fn(),
  updateConsent: vi.fn(),
  findVoiceProfile: vi.fn(),
  createVoiceProfile: vi.fn(),
  updateVoiceProfiles: vi.fn(),
  findAvatarProfile: vi.fn(),
  createAvatarProfile: vi.fn(),
  updateAvatarProfiles: vi.fn(),
}))

vi.mock(
  '../src/config/env.js',
  async (importOriginal) => {
    const original = await importOriginal()

    return {
      ...original,
      env: {
        ...original.env,
        elevenLabsApiKey:
          'test-elevenlabs-key',
        elevenLabsVoiceId:
          'testVoiceId1234567890',
        elevenLabsModelId:
          'eleven_v3',
        openaiApiKey:
          'test-openai-key',
        openaiTranscriptionModel:
          'gpt-transcribe',
      },
    }
  },
)

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      MANAGE: 'manage',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/digitalPersona/ConsentRecord.js',
  async (importOriginal) => {
    const original = await importOriginal()

    return {
      ...original,
      default: {
        findOne: mocks.findConsent,
        create: mocks.createConsent,
        updateOne: mocks.updateConsent,
      },
    }
  },
)

vi.mock(
  '../src/modules/digitalPersona/VoiceProfile.js',
  () => ({
    default: {
      findOne: mocks.findVoiceProfile,
      create: mocks.createVoiceProfile,
      updateMany:
        mocks.updateVoiceProfiles,
    },
  }),
)

vi.mock(
  '../src/modules/digitalPersona/AvatarProfile.js',
  () => ({
    default: {
      findOne:
        mocks.findAvatarProfile,
      create:
        mocks.createAvatarProfile,
      updateMany:
        mocks.updateAvatarProfiles,
    },
  }),
)

import {
  acceptSelfConsent,
  activateChatVoiceInput,
  activateVoiceClone,
  initializeMockProfiles,
  revokeSelfConsent,
} from '../src/modules/digitalPersona/digitalPersonaService.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const voiceId =
  'testVoiceId1234567890'

const memoryProfile = {
  _id: memoryId,
  ownerId: userId,
  subjectName: 'עמנואל טירן',
  status: 'active',
}

const consentInput = {
  subjectNameConfirmation:
    'עמנואל טירן',
  confirmsOwnIdentity: true,
  permitsVoiceUse: true,
  permitsLikenessUse: true,
  understandsAiRepresentation: true,
  acceptsSafetyRestrictions: true,
}

function createPublicDocument(data) {
  return {
    ...data,
    toJSON() {
      return data
    },
  }
}

function prepareMemoryAccess() {
  mocks.requireMemoryPermission
    .mockResolvedValue({
      memoryProfile,
    })
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('Digital persona service', () => {
  it('stores self consent only after the confirmed name matches', async () => {
    const consent = createPublicDocument({
      id: 'consent-id',
      _id: 'consent-id',
      status: 'approved',
      processingScope: 'mock_only',
    })

    prepareMemoryAccess()

    mocks.findConsent
      .mockResolvedValueOnce(null)
      .mockResolvedValue(consent)

    mocks.createConsent
      .mockResolvedValue(consent)

    mocks.findVoiceProfile
      .mockResolvedValue(null)

    mocks.findAvatarProfile
      .mockResolvedValue(null)

    const setup = await acceptSelfConsent(
      userId,
      memoryId,
      consentInput,
    )

    expect(
      mocks.requireMemoryPermission,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      'manage',
    )

    expect(
      mocks.createConsent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId,
        subjectUserId: userId,
        acceptedByUserId: userId,
        policyVersion:
          'digital-persona-self-consent-v1',
        acceptedAt: expect.any(Date),
      }),
    )

    expect(setup).toMatchObject({
      subject: {
        status: 'living',
        relationship: 'self',
        name: 'עמנואל טירן',
      },
      providerMode: 'mock',
      externalMediaTransferAllowed:
        false,
      consent: {
        status: 'approved',
      },
      voiceProfile: null,
      avatarProfile: null,
      voiceClone: {
        provider: 'elevenlabs',
        textProcessor: 'none',
        providerConfigured: true,
        active: false,
      },
    })
  })

  it('rejects a mismatched subject name before storing consent', async () => {
    prepareMemoryAccess()

    await expect(
      acceptSelfConsent(
        userId,
        memoryId,
        {
          ...consentInput,
          subjectNameConfirmation:
            'אדם אחר',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code:
        'SELF_CONSENT_SUBJECT_MISMATCH',
    })

    expect(
      mocks.createConsent,
    ).not.toHaveBeenCalled()
  })

  it('does not initialize profiles without approved consent', async () => {
    prepareMemoryAccess()
    mocks.findConsent
      .mockResolvedValue(null)

    await expect(
      initializeMockProfiles(
        userId,
        memoryId,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code:
        'DIGITAL_PERSONA_CONSENT_REQUIRED',
    })

    expect(
      mocks.createVoiceProfile,
    ).not.toHaveBeenCalled()

    expect(
      mocks.createAvatarProfile,
    ).not.toHaveBeenCalled()
  })

  it('activates the configured ElevenLabs clone after separate text-transfer consent', async () => {
    const consent = createPublicDocument({
      id: 'consent-id',
      _id: 'consent-id',
      status: 'approved',
      processingScope:
        'external_voice',
    })

    const voiceProfile =
      createPublicDocument({
        id: 'voice-id',
        provider: 'elevenlabs',
        profileType: 'custom',
        status: 'ready',
        isRealVoiceClone: true,
      })

    prepareMemoryAccess()
    mocks.findConsent
      .mockResolvedValue(consent)
    mocks.updateConsent
      .mockResolvedValue({
        matchedCount: 1,
      })
    mocks.updateVoiceProfiles
      .mockResolvedValue({
        modifiedCount: 1,
      })
    mocks.createVoiceProfile
      .mockResolvedValue(voiceProfile)
    mocks.findVoiceProfile
      .mockResolvedValue(voiceProfile)
    mocks.findAvatarProfile
      .mockResolvedValue(null)

    const input = {
      confirmsOwnVoice: true,
      confirmsExistingVoiceClone:
        true,
      permitsElevenLabsTextTransfer:
        true,
      understandsElevenLabsRetention:
        true,
    }

    const setup =
      await activateVoiceClone(
        userId,
        memoryId,
        input,
      )

    expect(
      mocks.updateConsent,
    ).toHaveBeenCalledWith(
      {
        _id: 'consent-id',
        status: 'approved',
      },
      {
        $set:
          expect.objectContaining({
            processingScope:
              'external_voice',
            externalVoiceConsent:
              expect.objectContaining({
                provider:
                  'elevenlabs',
                modelFamily:
                  'eleven_v3',
                textProcessor:
                  'none',
                providerVoiceId:
                  voiceId,
              }),
          }),
      },
      {
        runValidators: true,
      },
    )

    expect(
      mocks.createVoiceProfile,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'elevenlabs',
        providerProfileId:
          voiceId,
        profileType: 'custom',
        isRealVoiceClone: true,
      }),
    )

    expect(setup).toMatchObject({
      providerMode: 'elevenlabs',
      externalMediaTransferAllowed:
        true,
      voiceClone: {
        provider: 'elevenlabs',
        textProcessor: 'none',
        providerConfigured: true,
        active: true,
      },
    })
  })

  it('activates Hebrew chat transcription only after separate OpenAI audio-transfer consent', async () => {
    const consent =
      createPublicDocument({
        id: 'consent-id',
        _id: 'consent-id',
        status: 'approved',
        processingScope:
          'external_voice',
        externalTranscriptionConsent: {
          provider: 'openai',
          model: 'gpt-transcribe',
          languageCode: 'he',
        },
      })

    const voiceProfile =
      createPublicDocument({
        id: 'voice-id',
        provider: 'elevenlabs',
        profileType: 'custom',
        status: 'ready',
        isRealVoiceClone: true,
      })

    prepareMemoryAccess()
    mocks.findConsent
      .mockResolvedValue(consent)
    mocks.updateConsent
      .mockResolvedValue({
        matchedCount: 1,
      })
    mocks.findVoiceProfile
      .mockResolvedValue(voiceProfile)
    mocks.findAvatarProfile
      .mockResolvedValue(null)

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

    const setup =
      await activateChatVoiceInput(
        userId,
        memoryId,
        input,
      )

    expect(
      mocks.updateConsent,
    ).toHaveBeenCalledWith(
      {
        _id: 'consent-id',
        status: 'approved',
      },
      {
        $set: {
          externalTranscriptionConsent:
            expect.objectContaining({
              provider: 'openai',
              model:
                'gpt-transcribe',
              languageCode: 'he',
              attestations: input,
              policyVersion:
                'openai-hebrew-chat-transcription-v1',
              acceptedAt:
                expect.any(Date),
            }),
        },
      },
      {
        runValidators: true,
      },
    )

    expect(setup).toMatchObject({
      providerMode: 'elevenlabs',
      externalMediaTransferAllowed:
        true,
      chatVoiceInput: {
        provider: 'openai',
        providerConfigured: true,
        active: true,
        languageCode: 'he',
        audioStored: false,
        autoSend: false,
      },
    })
  })

  it('revokes consent and disables ready profiles', async () => {
    const consent = {
      _id: 'consent-id',
      status: 'approved',
    }

    prepareMemoryAccess()

    mocks.findConsent
      .mockResolvedValueOnce(consent)
      .mockResolvedValue(null)

    mocks.findVoiceProfile
      .mockResolvedValue(null)

    mocks.findAvatarProfile
      .mockResolvedValue(null)

    mocks.updateConsent
      .mockResolvedValue({
        modifiedCount: 1,
      })

    mocks.updateVoiceProfiles
      .mockResolvedValue({
        modifiedCount: 1,
      })

    mocks.updateAvatarProfiles
      .mockResolvedValue({
        modifiedCount: 1,
      })

    const setup = await revokeSelfConsent(
      userId,
      memoryId,
    )

    expect(
      mocks.updateConsent,
    ).toHaveBeenCalledWith(
      {
        _id: 'consent-id',
        status: 'approved',
      },
      {
        $set: {
          status: 'revoked',
          revokedAt: expect.any(Date),
        },
      },
    )

    expect(
      mocks.updateVoiceProfiles,
    ).toHaveBeenCalled()

    expect(
      mocks.updateAvatarProfiles,
    ).toHaveBeenCalled()

    expect(setup.consent).toBeNull()
  })
})
