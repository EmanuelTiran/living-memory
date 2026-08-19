import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import AvatarProfile from '../src/modules/digitalPersona/AvatarProfile.js'
import ConsentRecord, {
  DIGITAL_PERSONA_ALLOWED_USES,
  DIGITAL_PERSONA_CONSENT_POLICY_VERSION,
  EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
} from '../src/modules/digitalPersona/ConsentRecord.js'
import VoiceProfile from '../src/modules/digitalPersona/VoiceProfile.js'

const memoryId =
  new mongoose.Types.ObjectId()

const userId =
  new mongoose.Types.ObjectId()

function createConsentInput(
  overrides = {},
) {
  return {
    memoryId,
    subjectUserId: userId,
    acceptedByUserId: userId,
    allowedUses: [
      ...DIGITAL_PERSONA_ALLOWED_USES,
    ],
    attestations: {
      confirmsOwnIdentity: true,
      permitsVoiceUse: true,
      permitsLikenessUse: true,
      understandsAiRepresentation:
        true,
      acceptsSafetyRestrictions: true,
    },
    acceptedAt: new Date(
      '2026-08-03T08:00:00.000Z',
    ),
    ...overrides,
  }
}

describe('Digital persona models', () => {
  it('accepts explicit self consent with safe defaults', async () => {
    const consent = new ConsentRecord(
      createConsentInput(),
    )

    await expect(
      consent.validate(),
    ).resolves.toBeUndefined()

    expect(consent).toMatchObject({
      subjectStatus: 'living',
      relationshipToSubject: 'self',
      consentType: 'voice_and_avatar',
      processingScope: 'mock_only',
      status: 'approved',
      policyVersion:
        DIGITAL_PERSONA_CONSENT_POLICY_VERSION,
    })
  })

  it('rejects consent accepted by someone other than the represented user', async () => {
    const consent = new ConsentRecord(
      createConsentInput({
        acceptedByUserId:
          new mongoose.Types.ObjectId(),
      }),
    )

    await expect(
      consent.validate(),
    ).rejects.toThrow(
      'Self consent must be accepted by the represented user.',
    )
  })

  it('requires every explicit attestation', async () => {
    const consent = new ConsentRecord(
      createConsentInput({
        attestations: {
          confirmsOwnIdentity: true,
          permitsVoiceUse: false,
          permitsLikenessUse: true,
          understandsAiRepresentation:
            true,
          acceptsSafetyRestrictions:
            true,
        },
      }),
    )

    await expect(
      consent.validate(),
    ).rejects.toThrow(
      'Explicit voice-use permission is required.',
    )
  })

  it('requires a timestamp when consent is revoked', async () => {
    const consent = new ConsentRecord(
      createConsentInput({
        status: 'revoked',
      }),
    )

    await expect(
      consent.validate(),
    ).rejects.toThrow(
      'Revoked consent requires a revocation timestamp.',
    )
  })

  it('does not expose internal consent user identifiers', async () => {
    const consent = new ConsentRecord(
      createConsentInput(),
    )

    await consent.validate()

    const output = consent.toJSON()

    expect(output.id).toBe(
      consent._id.toString(),
    )

    expect(output).not.toHaveProperty(
      'subjectUserId',
    )

    expect(output).not.toHaveProperty(
      'acceptedByUserId',
    )
  })

  it('stores provider-specific external voice consent without exposing the ElevenLabs voice identifier', async () => {
    const consent = new ConsentRecord(
      createConsentInput({
        processingScope:
          'external_voice',
        externalVoiceConsent: {
          provider: 'elevenlabs',
          modelFamily: 'eleven_v3',
          textProcessor: 'none',
          providerVoiceId:
            'testVoiceId1234567890',
          attestations: {
            confirmsOwnVoice: true,
            confirmsExistingVoiceClone:
              true,
            permitsElevenLabsTextTransfer:
              true,
            understandsElevenLabsRetention:
              true,
          },
          acceptedAt: new Date(
            '2026-08-03T09:00:00.000Z',
          ),
        },
      }),
    )

    await expect(
      consent.validate(),
    ).resolves.toBeUndefined()

    const output = consent.toJSON()

    expect(output).toMatchObject({
      processingScope:
        'external_voice',
      externalVoiceConsent: {
        provider: 'elevenlabs',
        modelFamily: 'eleven_v3',
        textProcessor: 'none',
      },
    })

    expect(
      output.externalVoiceConsent,
    ).not.toHaveProperty(
      'providerVoiceId',
    )

    expect(
      output.externalVoiceConsent,
    ).not.toHaveProperty(
      'attestations',
    )
  })

  it('stores separate OpenAI transcription consent without exposing its attestations', async () => {
    const consent = new ConsentRecord(
      createConsentInput({
        externalTranscriptionConsent: {
          provider: 'openai',
          model: 'gpt-transcribe',
          languageCode: 'he',
          attestations: {
            confirmsOwnVoice: true,
            permitsOpenAIAudioTransfer:
              true,
            understandsOpenAIProcessing:
              true,
            understandsAudioNotStored:
              true,
            understandsManualReview:
              true,
          },
          acceptedAt: new Date(
            '2026-08-03T09:30:00.000Z',
          ),
        },
      }),
    )

    await expect(
      consent.validate(),
    ).resolves.toBeUndefined()

    const output = consent.toJSON()

    expect(output).toMatchObject({
      processingScope: 'mock_only',
      externalTranscriptionConsent: {
        provider: 'openai',
        model: 'gpt-transcribe',
        languageCode: 'he',
        policyVersion:
          EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
      },
    })

    expect(
      output.externalTranscriptionConsent,
    ).not.toHaveProperty(
      'attestations',
    )
  })

  it('keeps provider identifiers private on mock profiles', async () => {
    const consentRecordId =
      new mongoose.Types.ObjectId()

    const voiceProfile = new VoiceProfile({
      memoryId,
      consentRecordId,
      createdByUserId: userId,
      provider: 'mock',
      providerProfileId:
        'mock-voice-private-id',
    })

    const avatarProfile =
      new AvatarProfile({
        memoryId,
        consentRecordId,
        createdByUserId: userId,
        provider: 'mock',
        providerProfileId:
          'mock-avatar-private-id',
      })

    await Promise.all([
      voiceProfile.validate(),
      avatarProfile.validate(),
    ])

    expect(voiceProfile.toJSON())
      .not.toHaveProperty(
        'providerProfileId',
      )

    expect(avatarProfile.toJSON())
      .not.toHaveProperty(
        'providerProfileId',
      )

    expect(
      voiceProfile.isRealVoiceClone,
    ).toBe(false)

    expect(
      avatarProfile.isPhotorealistic,
    ).toBe(false)
  })

  it('prevents mock profiles from claiming real biometric imitation', async () => {
    const consentRecordId =
      new mongoose.Types.ObjectId()

    const voiceProfile = new VoiceProfile({
      memoryId,
      consentRecordId,
      createdByUserId: userId,
      provider: 'mock',
      providerProfileId:
        'mock-voice-private-id',
      isRealVoiceClone: true,
    })

    const avatarProfile =
      new AvatarProfile({
        memoryId,
        consentRecordId,
        createdByUserId: userId,
        provider: 'mock',
        providerProfileId:
          'mock-avatar-private-id',
        isPhotorealistic: true,
      })

    await expect(
      voiceProfile.validate(),
    ).rejects.toThrow(
      'Mock voice profiles cannot represent a real voice clone.',
    )

    await expect(
      avatarProfile.validate(),
    ).rejects.toThrow(
      'Mock avatar profiles cannot be photorealistic.',
    )
  })
})
