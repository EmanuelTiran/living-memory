import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import sharp from 'sharp'
import jsQR from 'jsqr'

const mocks = vi.hoisted(() => ({ readBuffer: vi.fn() }))
vi.mock('../src/modules/auth/tokens.js', () => ({
  verifyAccessToken: async (token) => ({ userId: token, systemRole: 'user' }),
}))
vi.mock('../src/config/env.js', async (original) => {
  const actual = await original()
  return { ...actual, env: { ...actual.env, publicAppUrl: 'https://zikaron-hai.co.il', serveClientBuild: true } }
})
vi.mock('../src/modules/media/memoryAssetStorage.js', () => ({
  memoryAssetStorageRegistry: { get: () => ({ readBuffer: mocks.readBuffer }) },
}))

import app from '../src/app.js'
import MemoryProfile from '../src/modules/memories/MemoryProfile.js'
import MemoryStory from '../src/modules/memories/MemoryStory.js'
import MemoryAsset from '../src/modules/media/MemoryAsset.js'
import { archiveMemoryAsset } from '../src/modules/media/memoryAssetService.js'
import MemoryMembership from '../src/modules/memories/MemoryMembership.js'
import User from '../src/modules/auth/User.js'
import { updateMemoryProfile } from '../src/modules/memories/memoryService.js'
import { approveMemoryStory, archiveMemoryStory, updateMemoryStory } from '../src/modules/memories/memoryStoryService.js'
import { createQrSvg, generateQrToken, changeMemoryQr, getMemoryQrManagement, publicationVersion, resolvePublicMemory } from '../src/modules/memories/memoryQrService.js'
import { createHash } from 'node:crypto'

let database
let ownerId
let profile
let story
let token
const auth = (userId = ownerId) => ['Authorization', `Bearer ${userId}`]
const path = () => `/api/memories/${profile.id}/qr`
async function initialize() {
  const state = await changeMemoryQr(ownerId, profile.id, { action: 'initialize' })
  token = state.url.split('/').pop()
  return state
}
async function publish({ stories = true, photos = true } = {}) {
  const state = await initialize()
  return changeMemoryQr(ownerId, profile.id, {
    action: 'publish', confirmed: true, profileVersion: state.profileVersion,
    stories: stories ? state.stories.map(({ sourceId, version }) => ({ sourceId, version })) : [],
    photos: photos ? state.photos.map(({ sourceId, version }) => ({ sourceId, version })) : [],
  })
}
async function createPhoto() {
  // Real raster with deliberately private metadata; the public derivative must strip it.
  const buffer = await sharp({ create: { width: 50, height: 60, channels: 3, background: '#d7a24c' } })
    .withExif({ IFD0: { Artist: 'private family information' } }).jpeg().toBuffer()
  mocks.readBuffer.mockResolvedValue(buffer)
  return MemoryAsset.create({
    memoryId: profile._id, uploadedByUserId: ownerId,
    displayName: 'תמונה משפחתית', description: 'רגע לזכור', originalFileName: 'private-original.jpg',
    assetType: 'image', mimeType: 'image/jpeg', sizeBytes: buffer.length,
    storageProvider: 'local_private', storageKey: 'private/file.jpg',
    checksumSha256: createHash('sha256').update(buffer).digest('hex'),
  })
}

beforeAll(async () => {
  // This is the ONLY database connection: a newly spawned loopback MongoDB.
  // Never consult MONGODB_URI or connect to the application's configured database.
  database = await MongoMemoryServer.create({ instance: { dbName: 'qr_feature_test' } })
  await mongoose.connect(database.getUri(), { autoIndex: false, autoCreate: false })
  await Promise.all([MemoryProfile, MemoryStory, MemoryAsset, MemoryMembership].map((model) => model.createIndexes()))
}, 180_000)

afterAll(async () => {
  await mongoose.disconnect()
  await database?.stop()
})

beforeEach(async () => {
  await Promise.all([MemoryProfile, MemoryStory, MemoryAsset, MemoryMembership, User].map((model) => model.deleteMany({})))
  ownerId = (await User.create({ displayName: 'QR owner', email: 'qr-owner@example.test', passwordHash: 'test-only' })).id
  profile = await MemoryProfile.create({ ownerId, subjectName: 'שרה כהן', description: 'אהבה, משפחה וסיפורים.', relationship: 'private relationship' })
  story = await MemoryStory.create({ memoryId: profile.id, authorId: ownerId, title: 'זיכרון שאושר', content: 'סיפור ארוך מספיק לפרסום משפחתי.', status: 'approved' })
})

describe('Permanent QR identity and public publication (real isolated MongoDB)', () => {
  it('generates nonsequential 192-bit tokens and enforces a unique partial database index', async () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateQrToken))
    expect(tokens.size).toBe(1000)
    for (const value of tokens) expect(value).toMatch(/^[A-Za-z0-9_-]{32}$/)
    await initialize()
    const indexes = await MemoryProfile.collection.indexes()
    expect(indexes.find((index) => index.name === 'memory_profiles_permanent_qr')).toMatchObject({
      unique: true, key: { qrToken: 1 }, partialFilterExpression: { qrToken: { $type: 'string' } },
    })
    await expect(MemoryProfile.collection.insertOne({ qrToken: token })).rejects.toMatchObject({ code: 11000 })
    await expect(MemoryProfile.create({ ownerId, subjectName: 'פרופיל ישן נוסף' })).resolves.toBeDefined()
  })

  it('atomically initializes one identity under concurrent requests without publishing content', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => changeMemoryQr(ownerId, profile.id, { action: 'initialize' })))
    expect(new Set(results.map((result) => result.url)).size).toBe(1)
    expect(results[0]).toMatchObject({ published: false, enabled: true })
    const stored = await MemoryProfile.findById(profile.id).select('+qrToken +qrCreatedAt +qrOrigin').lean()
    expect(stored.qrCreatedAt).toBeInstanceOf(Date)
    expect(stored.qrOrigin).toBe('https://zikaron-hai.co.il')
  })

  it.each(['private', 'shared'])('does not expose an unpublished %s memory', async (visibility) => {
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { visibility } })
    await initialize()
    const response = await request(app).get(`/api/public/memories/${token}`)
    expect(response.status).toBe(404)
    expect(response.text).not.toContain(profile.subjectName)
  })

  it('resolves a public selection without internal IDs, drafts, other families or private metadata', async () => {
    await MemoryStory.create({ memoryId: profile.id, authorId: ownerId, title: 'טיוטה פרטית', content: 'draft secret text not for public' })
    await MemoryStory.create({ memoryId: new mongoose.Types.ObjectId(), authorId: ownerId, title: 'משפחה אחרת', content: 'other family secret text', status: 'approved' })
    await publish()
    const response = await request(app).get(`/api/public/memories/${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({ subjectName: profile.subjectName, description: profile.description,
      stories: [{ title: story.title, content: story.content, occurredOn: '' }], photos: [] })
    for (const secret of [profile.id, ownerId, story.id, 'private relationship', 'draft secret', 'other family secret', 'sourceId', 'approvedBy', 'storageKey']) expect(response.text).not.toContain(secret)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-robots-tag']).toContain('noindex')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers.location).toBeUndefined()
  })

  it('returns the same safe unavailable state for missing, disabled and archived profiles', async () => {
    await publish()
    const missing = await request(app).get(`/api/public/memories/${generateQrToken()}`)
    await changeMemoryQr(ownerId, profile.id, { action: 'set_enabled', enabled: false, confirmed: true })
    const disabled = await request(app).get(`/api/public/memories/${token}`)
    expect(disabled.status).toBe(404)
    expect(disabled.body.error.code).toBe(missing.body.error.code)
    expect(await MemoryProfile.countDocuments()).toBe(1)
    await changeMemoryQr(ownerId, profile.id, { action: 'set_enabled', enabled: true, confirmed: true })
    expect((await resolvePublicMemory(token)).subjectName).toBe(profile.subjectName)
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { status: 'archived' } })
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('retains the URL and last public profile across edits until the owner publishes the replacement', async () => {
    const before = await publish()
    await updateMemoryProfile(ownerId, profile.id, { subjectName: 'שרה לוי', description: 'הקדמה חדשה שבודקים לפני הפרסום.' })
    expect(await getMemoryQrManagement(ownerId, profile.id)).toMatchObject({ url: before.url, publicationStatus: 'pending' })
    expect(await resolvePublicMemory(token)).toMatchObject({ subjectName: profile.subjectName, description: profile.description })
    const after = await publish()
    expect(after.url).toBe(before.url)
    expect(await resolvePublicMemory(token)).toMatchObject({ subjectName: 'שרה לוי', description: 'הקדמה חדשה שבודקים לפני הפרסום.' })
    expect(after.publicationStatus).toBe('current')
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { qrToken: generateQrToken(), qrOrigin: 'https://evil.test' } })
    expect((await getMemoryQrManagement(ownerId, profile.id)).url).toBe(before.url)
    const response = await request(app).patch(`/api/memories/${profile.id}`).set(...auth()).send({ qrToken: generateQrToken() })
    expect(response.status).toBe(400)
  })

  it('unpublishes without changing identity or family access while edits retain the last public story', async () => {
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { visibility: 'shared' } })
    const before = await publish()
    await MemoryStory.updateOne({ _id: story.id }, { $set: { content: 'new text not yet approved for public use', revision: 2 } })
    expect((await resolvePublicMemory(token)).stories).toEqual([{ title: story.title, content: story.content, occurredOn: '' }])
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('pending')
    const after = await changeMemoryQr(ownerId, profile.id, { action: 'unpublish', confirmed: true })
    expect(after.url).toBe(before.url)
    expect((await MemoryProfile.findById(profile.id)).visibility).toBe('shared')
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('keeps an edited story public until archive approval and owner publication replace it atomically', async () => {
    const first = await publish()
    const oldStory = (await resolvePublicMemory(token)).stories[0]
    await updateMemoryStory(ownerId, profile.id, story.id, { title: story.title, content: 'תיקון קטן לסיפור שכבר פורסם.' })
    expect((await resolvePublicMemory(token)).stories).toEqual([oldStory])
    let management = await getMemoryQrManagement(ownerId, profile.id)
    expect(management).toMatchObject({ publicationStatus: 'pending' })
    expect(management.stories[0]).toMatchObject({ retained: true, selected: true, content: oldStory.content })
    await changeMemoryQr(ownerId, profile.id, { action: 'publish', confirmed: true,
      profileVersion: management.profileVersion,
      stories: management.stories.filter((item) => item.selected).map(({ sourceId, version }) => ({ sourceId, version })), photos: [] })
    expect((await resolvePublicMemory(token)).stories).toEqual([oldStory])
    await approveMemoryStory(ownerId, profile.id, story.id)
    management = await getMemoryQrManagement(ownerId, profile.id)
    expect(management.stories[0]).toMatchObject({ selected: true, content: 'תיקון קטן לסיפור שכבר פורסם.' })
    expect((await resolvePublicMemory(token)).stories).toEqual([oldStory])
    await changeMemoryQr(ownerId, profile.id, { action: 'publish', confirmed: true,
      profileVersion: management.profileVersion,
      stories: management.stories.filter((item) => item.selected).map(({ sourceId, version }) => ({ sourceId, version })), photos: [] })
    expect((await resolvePublicMemory(token)).stories).toEqual([{ title: story.title, content: 'תיקון קטן לסיפור שכבר פורסם.', occurredOn: '' }])
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('current')
    expect((await getMemoryQrManagement(ownerId, profile.id)).url).toBe(first.url)
  })

  it('does not add a new approved story until the owner explicitly selects it', async () => {
    await publish()
    const added = await MemoryStory.create({ memoryId: profile.id, authorId: ownerId,
      title: 'סיפור חדש', content: 'סיפור חדש שקיבל אישור בארכיון.', status: 'approved' })
    expect((await resolvePublicMemory(token)).stories).toHaveLength(1)
    const management = await getMemoryQrManagement(ownerId, profile.id)
    expect(management.stories.find((item) => item.sourceId === added.id).selected).toBe(false)
    await changeMemoryQr(ownerId, profile.id, { action: 'publish', confirmed: true,
      profileVersion: management.profileVersion,
      stories: management.stories.map(({ sourceId, version }) => ({ sourceId, version })), photos: [] })
    expect((await resolvePublicMemory(token)).stories).toHaveLength(2)
  })

  it('keeps an older selected story available when it falls outside the newest-100 review window', async () => {
    await publish()
    await MemoryStory.insertMany(Array.from({ length: 101 }, (_, index) => ({
      memoryId: profile.id, authorId: ownerId, title: `סיפור ${index}`,
      content: 'סיפור נוסף שאושר בארכיון ולא נבחר לפרסום.', status: 'approved',
      createdAt: new Date(Date.now() + 1000 + index),
    })))
    const management = await getMemoryQrManagement(ownerId, profile.id)
    expect(management.truncated).toBe(true)
    expect(management.stories.find((item) => item.sourceId === story.id)).toMatchObject({ selected: true })
    await changeMemoryQr(ownerId, profile.id, { action: 'publish', confirmed: true,
      profileVersion: management.profileVersion,
      stories: management.stories.filter((item) => item.selected).map(({ sourceId, version }) => ({ sourceId, version })), photos: [] })
    expect((await resolvePublicMemory(token)).stories).toHaveLength(1)
  })

  it('never serves a published story snapshot after explicit archival', async () => {
    await publish()
    await archiveMemoryStory(ownerId, profile.id, story.id)
    expect((await resolvePublicMemory(token)).stories).toEqual([])
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('removed')
  })

  it('keeps a published portrait until replacement publication but removes archived assets immediately', async () => {
    const original = await createPhoto()
    await updateMemoryProfile(ownerId, profile.id, { portraitAssetId: original.id })
    const first = await publish()
    const oldPortrait = (await resolvePublicMemory(token)).photos[0]
    const replacement = await createPhoto()
    await updateMemoryProfile(ownerId, profile.id, { portraitAssetId: replacement.id })
    expect((await resolvePublicMemory(token)).photos).toEqual([oldPortrait])
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('pending')
    const management = await getMemoryQrManagement(ownerId, profile.id)
    await changeMemoryQr(ownerId, profile.id, { action: 'publish', confirmed: true,
      profileVersion: management.profileVersion,
      stories: management.stories.filter((item) => item.selected).map(({ sourceId, version }) => ({ sourceId, version })),
      photos: management.photos.map(({ sourceId, version }) => ({ sourceId, version })) })
    const next = await resolvePublicMemory(token)
    expect(next.photos.find((item) => item.portrait).url).not.toBe(oldPortrait.url)
    expect((await getMemoryQrManagement(ownerId, profile.id)).url).toBe(first.url)
    await archiveMemoryAsset(ownerId, profile.id, original.id)
    expect((await request(app).get(oldPortrait.url)).status).toBe(404)
    expect((await resolvePublicMemory(token)).photos.some((item) => item.url === oldPortrait.url)).toBe(false)
  })

  it('enforces privacy, unpublication, suspension and ownership changes against stored snapshots', async () => {
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { visibility: 'shared' } })
    await publish()
    await updateMemoryProfile(ownerId, profile.id, { subjectName: 'שם שטרם פורסם' })
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { visibility: 'private' } })
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('restricted')
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { visibility: 'shared' } })
    await changeMemoryQr(ownerId, profile.id, { action: 'set_enabled', enabled: false, confirmed: true })
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
    await changeMemoryQr(ownerId, profile.id, { action: 'set_enabled', enabled: true, confirmed: true })
    await changeMemoryQr(ownerId, profile.id, { action: 'unpublish', confirmed: true })
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
    await publish()
    await User.updateOne({ _id: ownerId }, { $set: { status: 'suspended' } })
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
    await User.updateOne({ _id: ownerId }, { $set: { status: 'active' } })
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { ownerId: new mongoose.Types.ObjectId() } })
    await expect(resolvePublicMemory(token)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('requires owner authentication for every management operation, including family stewards', async () => {
    expect((await request(app).get(path())).status).toBe(401)
    expect((await request(app).post(path()).send({ action: 'initialize' })).status).toBe(401)
    const stranger = new mongoose.Types.ObjectId().toString()
    expect((await request(app).get(path()).set(...auth(stranger))).status).toBe(404)
    await MemoryProfile.updateOne({ _id: profile.id }, { $set: { visibility: 'shared' } })
    await MemoryMembership.create({ memoryId: profile.id, userId: stranger, role: 'steward' })
    expect((await request(app).post(path()).set(...auth(stranger)).send({ action: 'initialize' })).status).toBe(404)
    expect((await request(app).get(path()).set(...auth())).status).toBe(200)
  })

  it('rejects foreign selections, draft stories and stale approval versions', async () => {
    const state = await initialize()
    const body = { action: 'publish', confirmed: true, profileVersion: state.profileVersion, photos: [], stories: [{ sourceId: story.id, version: state.stories[0].version }] }
    await MemoryStory.updateOne({ _id: story.id }, { $set: { status: 'draft' } })
    await expect(changeMemoryQr(ownerId, profile.id, body)).rejects.toMatchObject({ statusCode: 409 })
    body.stories[0].sourceId = new mongoose.Types.ObjectId().toString()
    await expect(changeMemoryQr(ownerId, profile.id, body)).rejects.toMatchObject({ statusCode: 409 })
    body.stories = []; body.profileVersion = '0'.repeat(64)
    await expect(changeMemoryQr(ownerId, profile.id, body)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('cannot redirect off-site or accept arbitrary targets, tokens, query keys or unconfirmed publishing', async () => {
    await publish()
    for (const query of ['?next=https://evil.test', '?redirect=//evil.test', '?memoryId=507f1f77bcf86cd799439011']) {
      const response = await request(app).get(`/api/public/memories/${token}${query}`)
      expect(response.status).toBe(400)
      expect(response.headers.location).toBeUndefined()
    }
    for (const body of [{ action: 'set_enabled', enabled: false }, { action: 'initialize', qrToken: token }, { action: 'regenerate' }]) {
      expect((await request(app).post(path()).set(...auth()).send(body)).status).toBe(400)
    }
    expect((await request(app).get('/api/public/memories/invalid')).status).toBe(400)
    const html = await request(app).get(`/q/${token}`).set('Accept', 'text/html')
    expect(html.headers['cache-control']).toContain('no-store')
    expect(html.headers['x-robots-tag']).toContain('noindex')
    expect(html.headers.location).toBeUndefined()
  })

  it('serves only selected photos through opaque handles, strips metadata, and revokes existing photo URLs', async () => {
    const asset = await createPhoto()
    await publish()
    const publicMemory = await resolvePublicMemory(token)
    const url = publicMemory.photos[0].url
    expect(url).not.toContain(asset.id)
    expect(JSON.stringify(publicMemory)).not.toContain('private/file.jpg')
    const photo = await request(app).get(url)
    expect(photo.status).toBe(200)
    expect(photo.headers['content-type']).toContain('image/webp')
    const metadata = await sharp(photo.body).metadata()
    expect(metadata.exif).toBeUndefined()
    expect(metadata.xmp).toBeUndefined()
    expect(metadata.width).toBe(50)
    await changeMemoryQr(ownerId, profile.id, { action: 'set_enabled', enabled: false, confirmed: true })
    expect((await request(app).get(url)).status).toBe(404)
    await changeMemoryQr(ownerId, profile.id, { action: 'set_enabled', enabled: true, confirmed: true })
    await MemoryAsset.updateOne({ _id: asset.id }, { $set: { description: 'private edited caption' } })
    expect((await request(app).get(url)).status).toBe(200)
    expect((await resolvePublicMemory(token)).photos[0].description).toBe('רגע לזכור')
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('pending')
    await archiveMemoryAsset(ownerId, profile.id, asset.id)
    expect((await request(app).get(url)).status).toBe(404)
    expect((await resolvePublicMemory(token)).photos).toEqual([])
    expect((await getMemoryQrManagement(ownerId, profile.id)).publicationStatus).toBe('removed')
  })

  it('does not leak public-selection fields through existing profile serialization', async () => {
    await publish()
    const selected = await MemoryProfile.findById(profile.id).select('+qrToken +publicPublication')
    expect(selected.toJSON()).not.toHaveProperty('qrToken')
    expect(selected.toJSON()).not.toHaveProperty('publicPublication')
  })

  it('uses the unique index for public resolution', async () => {
    await publish()
    await MemoryProfile.collection.insertMany(Array.from({ length: 1000 }, () => ({ qrToken: generateQrToken(), status: 'active', qrEnabled: true })))
    // Windows MongoDB can include non-UTF8 host metadata in explain responses.
    // This option is confined to test diagnostics; application reads stay strict.
    const plan = await MemoryProfile.collection.find({ qrToken: { $eq: token, $type: 'string' }, qrEnabled: true, status: 'active', 'publicPublication.enabled': true }, { enableUtf8Validation: false }).explain('executionStats')
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('memory_profiles_permanent_qr')
    expect(plan.executionStats.totalDocsExamined).toBe(1)
  })

  it('exports valid high-contrast SVG with a four-module quiet zone that independently decodes to the exact resolver URL', async () => {
    const state = await publish()
    expect(state.svg).toContain('<svg')
    expect(state.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(state.svg).not.toMatch(/<script|foreignObject|<image/)
    for (const width of [240, 1024]) {
      const { data, info } = await sharp(Buffer.from(await createQrSvg(state.url))).resize(width, width).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height)
      expect(decoded?.data).toBe(state.url)
      const resolverPath = new URL(decoded.data).pathname.replace('/q/', '/api/public/memories/')
      expect((await request(app).get(resolverPath)).status).toBe(200)
      // Entire top edge is white; no accidental transparency or clipped quiet zone.
      expect([...data.subarray(0, info.width * 4)].every((value) => value === 255)).toBe(true)
    }
    expect(publicationVersion('profile', profile)).toMatch(/^[a-f0-9]{64}$/)
  })
})
