import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { requestId } from '../src/middleware/requestId.js'
import { requireAuth } from '../src/middleware/requireAuth.js'
import MemoryProfile from '../src/modules/memories/MemoryProfile.js'
import MemoryMembership from '../src/modules/memories/MemoryMembership.js'
import MemoryExternalVideo from '../src/modules/media/MemoryExternalVideo.js'
import routes from '../src/modules/media/memoryExternalVideoRoutes.js'

vi.mock('../src/modules/auth/tokens.js', () => ({ verifyAccessToken: vi.fn(async () => ({ userId: '507f1f77bcf86cd799439010', systemRole: 'user' })) }))

const userId = '507f1f77bcf86cd799439010'
const memoryId = '507f1f77bcf86cd799439011'
const videoId = '507f1f77bcf86cd799439012'
const base = `/api/memories/${memoryId}/assets/external-videos`
const input = { displayName: 'Grandma at home', description: 'Family video', url: 'https://www.youtube.com/watch?v=rCY43S8GGAY&t=55s' }
const video = () => new MemoryExternalVideo({
  _id: videoId, memoryId, addedByUserId: userId, displayName: input.displayName, description: input.description,
  provider: 'youtube', canonicalUrl: input.url, externalId: 'rCY43S8GGAY', startSeconds: 55,
})
const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/memories/:memoryId/assets/external-videos', requireAuth, routes)
app.use(errorHandler)
let create, update, find
beforeEach(() => {
  vi.spyOn(MemoryProfile, 'findOne').mockResolvedValue({ ownerId: '507f1f77bcf86cd799439099', visibility: 'shared' })
  vi.spyOn(MemoryMembership, 'findOne').mockResolvedValue({ role: 'contributor' })
  create = vi.spyOn(MemoryExternalVideo, 'create').mockImplementation(async data => new MemoryExternalVideo({ _id: videoId, ...data }))
  update = vi.spyOn(MemoryExternalVideo, 'findOneAndUpdate').mockResolvedValue(video())
  find = vi.spyOn(MemoryExternalVideo, 'find').mockReturnValue({ sort: vi.fn().mockResolvedValue([video()]) })
})
afterEach(() => vi.restoreAllMocks())
const authenticated = (method, url) => request(app)[method](url).set('Authorization', 'Bearer test-token')

describe('External video routes with real memory permissions', () => {
  it.each(['contributor', 'editor', 'steward', 'owner'])('%s can add a canonical reference without exposing uploader IDs', async role => {
    if (role === 'owner') MemoryProfile.findOne.mockResolvedValue({ ownerId: userId, visibility: 'private' })
    else MemoryMembership.findOne.mockResolvedValue({ role })
    const response = await authenticated('post', base).send(input)
    expect(response.status).toBe(201)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ memoryId, addedByUserId: userId, startSeconds: 55, canonicalUrl: input.url }))
    expect(response.body.data.externalVideo).not.toHaveProperty('addedByUserId')
    expect(response.headers['cache-control']).toContain('no-store')
  })
  it('viewer can view but cannot add, edit or archive', async () => {
    MemoryMembership.findOne.mockResolvedValue({ role: 'viewer' })
    expect((await authenticated('get', base)).status).toBe(200)
    expect(find).toHaveBeenCalledWith({ memoryId, lifecycleStatus: 'active' })
    expect((await authenticated('post', base).send(input)).status).toBe(404)
    expect((await authenticated('patch', `${base}/${videoId}`).send({ displayName: 'New title' })).status).toBe(404)
    expect((await authenticated('delete', `${base}/${videoId}`)).status).toBe(404)
    expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled()
  })
  it('contributor cannot edit or archive existing media', async () => {
    expect((await authenticated('patch', `${base}/${videoId}`).send({ displayName: 'New title' })).status).toBe(404)
    expect((await authenticated('delete', `${base}/${videoId}`)).status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['editor', 'steward', 'owner'])('%s edits and archives only the active item in the authorized memory', async role => {
    if (role === 'owner') MemoryProfile.findOne.mockResolvedValue({ ownerId: userId })
    else MemoryMembership.findOne.mockResolvedValue({ role })
    expect((await authenticated('patch', `${base}/${videoId}`).send({ displayName: 'New title', description: '<b>plain text</b>' })).status).toBe(200)
    expect(update).toHaveBeenLastCalledWith({ _id: videoId, memoryId, lifecycleStatus: 'active' }, { $set: { displayName: 'New title', description: '<b>plain text</b>' } }, expect.objectContaining({ runValidators: true }))
    expect((await authenticated('delete', `${base}/${videoId}`)).status).toBe(200)
    expect(update).toHaveBeenLastCalledWith({ _id: videoId, memoryId, lifecycleStatus: 'active' }, { $set: { lifecycleStatus: 'archived', archivedAt: expect.any(Date) } }, expect.any(Object))
  })
  it('rejects missing membership, private memory and missing authentication', async () => {
    MemoryMembership.findOne.mockResolvedValue(null)
    expect((await authenticated('post', base).send(input)).status).toBe(404)
    MemoryMembership.findOne.mockResolvedValue({ role: 'contributor' })
    MemoryProfile.findOne.mockResolvedValue({ ownerId: 'another-user', visibility: 'private' })
    expect((await authenticated('get', base)).status).toBe(404)
    expect((await request(app).post(base).send(input)).status).toBe(401)
    expect(create).not.toHaveBeenCalled()
  })
  it.each(['javascript:alert(1)', 'data:text/html,video', 'https://example.com/video', 'https://youtube.com/watch?v=bad'])('rejects invalid URL %s before storage', async url => {
    expect((await authenticated('post', base).send({ ...input, url })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })
  it('rejects forged fields and invalid IDs; does not allow editing URL or owner', async () => {
    expect((await authenticated('post', base).send({ ...input, addedByUserId: 'another-user' })).status).toBe(400)
    expect((await authenticated('patch', `${base}/${videoId}`).send(input)).status).toBe(400)
    expect((await authenticated('delete', `${base}/not-an-id`)).status).toBe(400)
  })
  it('returns 404 for missing, archived, or cross-memory video IDs', async () => {
    MemoryMembership.findOne.mockResolvedValue({ role: 'editor' })
    update.mockResolvedValue(null)
    expect((await authenticated('delete', `${base}/${videoId}`)).status).toBe(404)
    expect(update.mock.calls[0][0]).toEqual({ _id: videoId, memoryId, lifecycleStatus: 'active' })
  })
})
