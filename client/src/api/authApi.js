export class ApiError extends Error {
    constructor(
        message,
        {
            statusCode = 0,
            code = 'UNKNOWN_ERROR',
            details = [],
        } = {},
    ) {
        super(message)

        this.name = 'ApiError'
        this.statusCode = statusCode
        this.code = code
        this.details = details
    }
}

async function request(
    path,
    {
        method = 'GET',
        body,
    } = {},
) {
    const options = {
        method,
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    }

    if (body !== undefined) {
        options.headers['Content-Type'] =
            'application/json'

        options.body = JSON.stringify(body)
    }

    let response

    try {
        response = await fetch(
            `/api/auth${path}`,
            options,
        )
    } catch {
        throw new ApiError(
            'Unable to connect to the server.',
            {
                code: 'NETWORK_ERROR',
            },
        )
    }

    const payload =
        response.status === 204
            ? null
            : await response
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
                details: payload?.error?.details ?? [],
            },
        )
    }

    return payload?.data ?? null
}

export function registerAccount(input) {
    return request('/register', {
        method: 'POST',
        body: input,
    })
}

export function loginAccount(input) {
    return request('/login', {
        method: 'POST',
        body: input,
    })
}

let activeRefreshRequest = null

export function refreshSession() {
    if (!activeRefreshRequest) {
        activeRefreshRequest = request('/refresh', {
            method: 'POST',
        }).finally(() => {
            activeRefreshRequest = null
        })
    }

    return activeRefreshRequest
}

export function logoutSession() {
    return request('/logout', {
        method: 'POST',
    })
}
