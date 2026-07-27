import request from 'supertest'
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
    verifyAccessToken: vi.fn(),
    findUserById: vi.fn(),
}))

vi.mock('../src/modules/auth/tokens.js', () => ({
    verifyAccessToken: mocks.verifyAccessToken,
}))

vi.mock('../src/modules/auth/User.js', () => ({
    default: {
        findById: mocks.findUserById,
    },
}))

import app from '../src/app.js'

const authentication = {
    userId: 'user-id',
    systemRole: 'user',
    tokenId: 'token-id',
    expiresAt: new Date(
        Date.now() + 15 * 60 * 1000,
    ),
}

const publicUser = {
    id: 'user-id',
    displayName: 'Emmanuel Tiran',
    email: 'user@example.com',
    systemRole: 'user',
    status: 'active',
}

afterEach(() => {
    vi.resetAllMocks()
})

describe('GET /api/auth/me', () => {
    it('returns the authenticated user', async () => {
        mocks.verifyAccessToken.mockResolvedValue(
            authentication,
        )

        mocks.findUserById.mockResolvedValue({
            status: 'active',
            toJSON: () => publicUser,
        })

        const response = await request(app)
            .get('/api/auth/me')
            .set(
                'Authorization',
                'Bearer valid-access-token',
            )

        expect(response.status).toBe(200)

        expect(mocks.findUserById).toHaveBeenCalledWith(
            'user-id',
        )

        expect(response.body).toEqual({
            success: true,
            data: {
                user: publicUser,
            },
        })
    })

    it('rejects a request without an access token', async () => {
        const response = await request(app).get(
            '/api/auth/me',
        )

        expect(response.status).toBe(401)

        expect(response.body.error).toMatchObject({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required.',
            requestId: expect.any(String),
        })

        expect(
            mocks.findUserById,
        ).not.toHaveBeenCalled()
    })

    it('rejects a token belonging to a deleted user', async () => {
        mocks.verifyAccessToken.mockResolvedValue(
            authentication,
        )

        mocks.findUserById.mockResolvedValue(null)

        const response = await request(app)
            .get('/api/auth/me')
            .set(
                'Authorization',
                'Bearer valid-access-token',
            )

        expect(response.status).toBe(401)

        expect(response.body.error).toMatchObject({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required.',
        })
    })

    it('rejects a suspended user', async () => {
        mocks.verifyAccessToken.mockResolvedValue(
            authentication,
        )

        mocks.findUserById.mockResolvedValue({
            status: 'suspended',
        })

        const response = await request(app)
            .get('/api/auth/me')
            .set(
                'Authorization',
                'Bearer valid-access-token',
            )

        expect(response.status).toBe(401)

        expect(response.body.error).toMatchObject({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required.',
        })
    })
})