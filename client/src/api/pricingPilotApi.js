import { ApiError } from './authApi.js'

async function request(
  path,
  accessToken,
  options = {},
) {
  let response

  try {
    response = await fetch(path, {
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
    })
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

function getBasePath(memoryId) {
  return `/api/memories/${memoryId}/pricing-pilot`
}

export async function getPricingPilot(
  accessToken,
  memoryId,
) {
  const data = await request(
    getBasePath(memoryId),
    accessToken,
  )

  return data.pricingPilot
}

export async function createFounderOffer(
  accessToken,
  memoryId,
) {
  const data = await request(
    `${getBasePath(memoryId)}/offer`,
    accessToken,
    {
      method: 'POST',
    },
  )

  return data.pricingPilot
}

export async function updateFounderDecision(
  accessToken,
  memoryId,
  decision,
) {
  const data = await request(
    `${getBasePath(memoryId)}/decision`,
    accessToken,
    {
      method: 'PATCH',
      body: {
        decision,
      },
    },
  )

  return data.pricingPilot
}
