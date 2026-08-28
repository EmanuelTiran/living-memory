import { ApiError } from './authApi.js'

async function request(
  path,
  accessToken,
  options = {},
) {
  let response

  try {
    response = await fetch(
      `/api/admin${path}`,
      {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization:
            `Bearer ${accessToken}`,
          ...(options.body
            ? {
                'Content-Type':
                  'application/json',
              }
            : {}),
        },
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
      },
    )
  } catch {
    throw new ApiError(
      'Unable to connect to the server.',
      {
        code: 'NETWORK_ERROR',
      },
    )
  }

  const payload = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ??
        'The request could not be completed.',
      {
        statusCode: response.status,
        code:
          payload?.error?.code ??
          'REQUEST_FAILED',
        details:
          payload?.error?.details ?? [],
      },
    )
  }

  return payload?.data ?? null
}

export async function getAdminOverview(
  accessToken,
) {
  const data = await request(
    '/overview',
    accessToken,
  )

  return data.overview
}

export async function getAdminPilotOverview(
  accessToken,
) {
  const data = await request(
    '/pilot',
    accessToken,
  )

  return data.pilot
}

export async function getAdminPricingPilotOverview(
  accessToken,
) {
  const data = await request(
    '/pricing-pilot',
    accessToken,
  )

  return data.pricingPilot
}

export async function updatePricingPilotParticipant(
  accessToken,
  participantCode,
  action,
  evidenceReference,
) {
  const data = await request(
    `/pricing-pilot/${participantCode}`,
    accessToken,
    {
      method: 'PATCH',
      body: {
        action,
        evidenceReference,
      },
    },
  )

  return data.participant
}
