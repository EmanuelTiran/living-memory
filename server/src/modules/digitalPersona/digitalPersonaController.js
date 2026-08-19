import {
  acceptSelfConsent,
  activateChatVoiceInput,
  activateVoiceClone,
  getDigitalPersonaSetup,
  initializeMockProfiles,
  revokeSelfConsent,
} from './digitalPersonaService.js'

export async function getSetup(req, res) {
  const setup =
    await getDigitalPersonaSetup(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}

export async function approveSelfConsent(
  req,
  res,
) {
  const setup = await acceptSelfConsent(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.validatedBody,
  )

  res.status(200).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}

export async function createMockProfiles(
  req,
  res,
) {
  const setup =
    await initializeMockProfiles(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(201).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}

export async function activateApprovedVoiceClone(
  req,
  res,
) {
  const setup =
    await activateVoiceClone(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}

export async function activateApprovedChatVoiceInput(
  req,
  res,
) {
  const setup =
    await activateChatVoiceInput(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}

export async function activateApprovedDIDAvatar(
  req,
  res,
) {
  const {
    activateDIDAvatar,
  } = await import(
    './digitalPersonaService.js'
  )

  const setup =
    await activateDIDAvatar(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}

export async function revokeConsent(
  req,
  res,
) {
  const setup = await revokeSelfConsent(
    req.auth.userId,
    req.validatedParams.memoryId,
  )

  res.status(200).json({
    success: true,
    data: {
      digitalPersona: setup,
    },
  })
}
