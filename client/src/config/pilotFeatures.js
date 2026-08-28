function readBooleanFeature(
  value,
  fallback,
) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}

const runtimeEnv = import.meta.env ?? {}
const productionBuild =
  runtimeEnv.PROD === true

export const pilotInviteOnly =
  readBooleanFeature(
    runtimeEnv.VITE_PILOT_INVITE_ONLY,
    productionBuild,
  )

export const pilotAvatarEnabled =
  readBooleanFeature(
    runtimeEnv.VITE_PILOT_AVATAR_ENABLED,
    !productionBuild,
  )
