import { createHash, randomBytes } from 'node:crypto'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import MemoryAsset from '../media/MemoryAsset.js'
import { readVerifiedAssetFile } from '../media/memoryAssetService.js'
import User from '../auth/User.js'
import MemoryProfile from './MemoryProfile.js'
import MemoryStory from './MemoryStory.js'
import { MEMORY_PERMISSIONS, requireMemoryPermission } from './memoryAccessService.js'
import { memoryProfileParamsSchema } from './validation.js'
import { qrActionSchema, qrTokenSchema } from './memoryQrValidation.js'

const QR_FIELDS = '+qrToken +qrOrigin +qrCreatedAt +qrEnabled +publicPublication'
const QUERY_MS = 5000
const CANDIDATE_LIMIT = 100
const unavailable = () => new AppError('This memory is not publicly available.', {
  statusCode: 404, code: 'PUBLIC_MEMORY_UNAVAILABLE',
})
const conflict = () => new AppError('Content changed. Review it again before publishing.', {
  statusCode: 409, code: 'PUBLICATION_CHANGED',
})

export function generateQrToken() {
  return randomBytes(24).toString('base64url')
}

// Fingerprints identify the reviewed current version; publication stores bounded public snapshots.
export function publicationVersion(kind, item) {
  const values = kind === 'profile'
    ? [item.subjectName, item.description, String(item.portraitAssetId ?? '')]
    : kind === 'story'
      ? [item.title, item.content, item.occurredOn, item.revision, item.status]
      : [item.displayName, item.description, String(item.updatedAt), item.lifecycleStatus]
  return createHash('sha256').update(JSON.stringify(values)).digest('hex')
}

export function qrUrl(profile) {
  return `${profile.qrOrigin}/q/${profile.qrToken}`
}

export async function createQrSvg(url) {
  return QRCode.toString(url, {
    type: 'svg', errorCorrectionLevel: 'H', margin: 4,
    color: { dark: '#000000ff', light: '#ffffffff' },
  })
}

async function ownerProfile(userId, memoryId) {
  memoryProfileParamsSchema.parse({ memoryId })
  const { authorization } = await requireMemoryPermission(userId, memoryId, MEMORY_PERMISSIONS.MANAGE)
  // Public release is reserved for the archive owner, not implied by family editing privileges.
  if (authorization.role !== 'owner') throw unavailable()
  const profile = await MemoryProfile.findOne({ _id: memoryId, ownerId: userId, status: 'active' })
    .select(QR_FIELDS).maxTimeMS(QUERY_MS).lean()
  if (!profile) throw unavailable()
  return profile
}

async function contentCandidates(memoryId, publication) {
  const storyFilter = { memoryId, status: 'approved' }
  const photoFilter = { memoryId, lifecycleStatus: 'active', assetType: 'image',
    mimeType: { $in: ['image/jpeg', 'image/png', 'image/webp'] } }
  if (publication) {
    storyFilter._id = { $in: publication.stories.map((item) => item.sourceId) }
    photoFilter._id = { $in: publication.photos.map((item) => item.sourceId) }
  }
  const [stories, photos] = await Promise.all([
    MemoryStory.find(storyFilter).sort({ createdAt: -1 }).limit(CANDIDATE_LIMIT + 1)
      .select('_id title content occurredOn revision status').maxTimeMS(QUERY_MS).lean(),
    MemoryAsset.find(photoFilter).sort({ createdAt: -1 }).limit(CANDIDATE_LIMIT + 1)
      .select('_id displayName description updatedAt lifecycleStatus').maxTimeMS(QUERY_MS).lean(),
  ])
  return { stories, photos }
}

function publishedProfile(profile) {
  return profile.publicPublication?.profileSnapshot ?? {
    subjectName: profile.subjectName, description: profile.description,
    portraitAssetId: profile.portraitAssetId,
  }
}

function profilePublicationIsValid(profile) {
  const publication = profile.publicPublication
  return publication?.enabled === true
    && String(publication.approvedByUserId) === String(profile.ownerId)
    // Family visibility is independent of QR publication, but a later move from
    // shared to private is an explicit privacy restriction and takes effect now.
    && !(publication.visibilityAtPublish === 'shared' && profile.visibility === 'private')
    && (publication.profileSnapshot || publication.profileVersion === publicationVersion('profile', profile))
}

async function publishedSources(profile) {
  const publication = profile.publicPublication
  const [stories, photos] = await Promise.all([
    MemoryStory.find({ memoryId: profile._id, _id: { $in: publication?.stories.map((entry) => entry.sourceId) ?? [] } })
      .select('_id title content occurredOn revision status').maxTimeMS(QUERY_MS).lean(),
    MemoryAsset.find({ memoryId: profile._id, _id: { $in: publication?.photos.map((entry) => entry.sourceId) ?? [] } })
      .select('_id displayName description updatedAt lifecycleStatus assetType mimeType').maxTimeMS(QUERY_MS).lean(),
  ])
  return {
    stories: new Map(stories.map((item) => [String(item._id), item])),
    photos: new Map(photos.map((item) => [String(item._id), item])),
  }
}

function isAvailablePhoto(item) {
  return item?.lifecycleStatus === 'active' && item.assetType === 'image'
    && ['image/jpeg', 'image/png', 'image/webp'].includes(item.mimeType)
}

function publicationChanges(profile, sources) {
  const publication = profile.publicPublication
  if (!publication?.enabled) return { pending: false, removed: false, restricted: false }
  let pending = publication.profileVersion !== publicationVersion('profile', profile)
  const restricted = String(publication.approvedByUserId) !== String(profile.ownerId)
    || (publication.visibilityAtPublish === 'shared' && profile.visibility === 'private')
  let removed = false
  for (const entry of publication.stories) {
    const item = sources.stories.get(String(entry.sourceId))
    if (!item || item.status === 'archived') removed = true
    else if (entry.version !== publicationVersion('story', item)) pending = true
  }
  for (const entry of publication.photos) {
    const item = sources.photos.get(String(entry.sourceId))
    if (!isAvailablePhoto(item)) removed = true
    else if (entry.version !== publicationVersion('photo', item)) pending = true
  }
  return { pending, removed, restricted }
}

export async function getMemoryQrManagement(userId, memoryId) {
  const profile = await ownerProfile(userId, memoryId)
  const publication = profile.publicPublication
  const [candidates, sources] = await Promise.all([contentCandidates(memoryId), publishedSources(profile)])
  const changes = publicationChanges(profile, sources)
  const publicationStatus = profile.qrEnabled !== true ? 'disabled'
    : !publication?.enabled ? 'not_published'
      : changes.restricted ? 'restricted'
        : changes.removed ? 'removed'
        : changes.pending ? 'pending' : 'current'
  const url = profile.qrToken ? qrUrl(profile) : null
  const storyChoices = candidates.stories.slice(0, CANDIDATE_LIMIT).map((item) => ({
    sourceId: String(item._id), version: publicationVersion('story', item),
    title: item.title, content: item.content, occurredOn: item.occurredOn,
    selected: publication?.stories.some((entry) => String(entry.sourceId) === String(item._id)) ?? false,
  }))
  for (const entry of publication?.stories ?? []) {
    const item = sources.stories.get(String(entry.sourceId))
    if (!item || item.status === 'archived'
      || storyChoices.some((choice) => choice.sourceId === String(entry.sourceId))) continue
    if (item.status === 'approved') {
      storyChoices.push({ sourceId: String(item._id), version: publicationVersion('story', item),
        title: item.title, content: item.content, occurredOn: item.occurredOn, selected: true })
    } else if (entry.snapshot) {
      storyChoices.push({ sourceId: String(entry.sourceId), version: entry.version,
        ...entry.snapshot, selected: true, retained: true })
    }
  }
  const photoChoices = candidates.photos.slice(0, CANDIDATE_LIMIT).map((item) => ({
    sourceId: String(item._id), version: publicationVersion('photo', item),
    title: item.displayName, description: item.description,
    selected: publication?.photos.some((entry) => String(entry.sourceId) === String(item._id)) ?? false,
    portrait: String(item._id) === String(profile.portraitAssetId),
  }))
  for (const entry of publication?.photos ?? []) {
    const item = sources.photos.get(String(entry.sourceId))
    if (!isAvailablePhoto(item) || photoChoices.some((choice) => choice.sourceId === String(entry.sourceId))) continue
    photoChoices.push({ sourceId: String(item._id), version: publicationVersion('photo', item),
      title: item.displayName, description: item.description, selected: true,
      portrait: String(item._id) === String(profile.portraitAssetId) })
  }
  return {
    url, svg: url ? await createQrSvg(url) : null,
    enabled: profile.qrEnabled === true,
    published: publication?.enabled === true,
    publicationStatus,
    profileVersion: publicationVersion('profile', profile),
    needsReview: changes.pending,
    profile: { subjectName: profile.subjectName, description: profile.description },
    stories: storyChoices,
    photos: photoChoices,
    truncated: candidates.stories.length > CANDIDATE_LIMIT || candidates.photos.length > CANDIDATE_LIMIT,
  }
}

export async function changeMemoryQr(userId, memoryId, input) {
  const action = qrActionSchema.parse(input)
  const profile = await ownerProfile(userId, memoryId)
  const filter = { _id: profile._id, ownerId: profile.ownerId, status: 'active' }
  if (action.action === 'initialize') {
    if (!profile.qrToken) {
      // The origin is pinned on first initialization. A later app-URL change must
      // never cause the app to hand out a different engraved URL.
      if (!env.publicAppUrl) throw new AppError('The permanent public URL is not configured.', {
        statusCode: 503, code: 'QR_NOT_CONFIGURED',
      })
      const origin = new URL(env.publicAppUrl).origin
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          // Deliberate native update: the only writer of Mongoose-immutable identity fields.
          // No upsert: simultaneous requests compete for the same empty slot.
          await MemoryProfile.collection.updateOne({ ...filter, qrToken: { $exists: false } }, {
            $set: { qrToken: generateQrToken(), qrOrigin: origin, qrCreatedAt: new Date(), qrEnabled: true },
          })
          break
        } catch (error) {
          if (error.code !== 11000 || !error.keyPattern?.qrToken || attempt === 2) throw error
        }
      }
    }
  } else {
    if (!profile.qrToken) throw conflict()
    let fields
    if (action.action === 'publish') {
      if (action.profileVersion !== publicationVersion('profile', profile)) throw conflict()
      const [candidates, sources] = await Promise.all([
        contentCandidates(memoryId, action), publishedSources(profile),
      ])
      const selected = {}
      for (const [kind, entries] of [['story', action.stories], ['photo', action.photos]]) {
        const items = kind === 'story' ? candidates.stories : candidates.photos
        const previous = kind === 'story' ? profile.publicPublication?.stories : profile.publicPublication?.photos
        const sourceMap = kind === 'story' ? sources.stories : sources.photos
        selected[kind === 'story' ? 'stories' : 'photos'] = entries.map((entry) => {
          const current = items.find((item) => String(item._id) === entry.sourceId
            && entry.version === publicationVersion(kind, item))
          if (current) return { sourceId: entry.sourceId, version: entry.version,
            snapshot: kind === 'story'
              ? { title: current.title, content: current.content, occurredOn: current.occurredOn }
              : { title: current.displayName, description: current.description } }
          const retained = previous?.find((item) => String(item.sourceId) === entry.sourceId
            && item.version === entry.version && item.snapshot)
          const source = sourceMap.get(entry.sourceId)
          if (!retained || (kind === 'story' ? !source || source.status === 'archived' : !isAvailablePhoto(source))) throw conflict()
          return { sourceId: entry.sourceId, version: entry.version, snapshot: retained.snapshot }
        })
      }
      fields = { publicPublication: {
        enabled: true, profileVersion: action.profileVersion,
        profileSnapshot: { subjectName: profile.subjectName, description: profile.description,
          portraitAssetId: profile.portraitAssetId ?? null },
        visibilityAtPublish: profile.visibility,
        stories: selected.stories, photos: selected.photos,
        approvedAt: new Date(), approvedByUserId: userId,
      } }
      // Reject a concurrent profile edit between review and publication.
      filter.subjectName = profile.subjectName
      filter.description = profile.description
      filter.portraitAssetId = profile.portraitAssetId ?? null
      filter.visibility = profile.visibility
    } else if (action.action === 'unpublish') {
      fields = { 'publicPublication.enabled': false }
      if (!profile.publicPublication) return getMemoryQrManagement(userId, memoryId)
    } else {
      fields = { qrEnabled: action.enabled }
    }
    const result = await MemoryProfile.updateOne(filter, { $set: fields }, { runValidators: true })
    if (!result.matchedCount) throw conflict()
  }
  return getMemoryQrManagement(userId, memoryId)
}

async function resolvePublicProfile(token) {
  if (!qrTokenSchema.safeParse(token).success) throw unavailable()
  const profile = await MemoryProfile.findOne({
    // Include the partial-index predicate explicitly so MongoDB can select it.
    qrToken: { $eq: token, $type: 'string' }, qrEnabled: true, status: 'active', 'publicPublication.enabled': true,
  }).select(`_id ownerId visibility subjectName description portraitAssetId ${QR_FIELDS}`).maxTimeMS(QUERY_MS).lean()
  if (!profile || !profilePublicationIsValid(profile)) throw unavailable()
  if (!await User.exists({ _id: profile.ownerId, status: 'active' }).maxTimeMS(QUERY_MS)) throw unavailable()
  return profile
}

function photoHandle(token, sourceId, version) {
  return createHash('sha256').update(`${token}:photo:${sourceId}:${version}`).digest('hex').slice(0, 32)
}

export async function resolvePublicMemory(token) {
  const profile = await resolvePublicProfile(token)
  const publication = profile.publicPublication
  const sources = await publishedSources(profile)
  const approvedProfile = publishedProfile(profile)
  const safePhotos = publication.photos.flatMap((entry) => {
    const item = sources.photos.get(String(entry.sourceId))
    if (!isAvailablePhoto(item) || (!entry.snapshot && entry.version !== publicationVersion('photo', item))) return []
    return [{ title: entry.snapshot?.title ?? item.displayName,
      description: entry.snapshot?.description ?? item.description,
      url: `/api/public/memories/${token}/photos/${photoHandle(token, entry.sourceId, entry.version)}`,
      portrait: String(entry.sourceId) === String(approvedProfile.portraitAssetId) }]
  })
  // Explicit DTO only; no source, owner, family, storage or approval identifiers.
  return {
    subjectName: approvedProfile.subjectName, description: approvedProfile.description,
    stories: publication.stories.flatMap((entry) => {
      const item = sources.stories.get(String(entry.sourceId))
      if (!item || item.status === 'archived') return []
      if (entry.snapshot) return [entry.snapshot]
      // Existing unsnapshotted publications remain fail-closed on edits.
      return item.status === 'approved' && entry.version === publicationVersion('story', item)
        ? [{ title: item.title, content: item.content, occurredOn: item.occurredOn }] : []
    }),
    photos: safePhotos,
  }
}

export async function getPublicPhoto(token, handle) {
  const profile = await resolvePublicProfile(token)
  const selected = profile.publicPublication.photos.find((item) => photoHandle(token, item.sourceId, item.version) === handle)
  if (!selected) throw unavailable()
  const asset = await MemoryAsset.findOne({
    _id: selected.sourceId, memoryId: profile._id, lifecycleStatus: 'active', assetType: 'image',
    mimeType: { $in: ['image/jpeg', 'image/png', 'image/webp'] },
  }).select('_id displayName description updatedAt lifecycleStatus storageProvider sizeBytes +storageKey +checksumSha256')
    .maxTimeMS(QUERY_MS).lean()
  if (!asset || (!selected.snapshot && publicationVersion('photo', asset) !== selected.version)) throw unavailable()
  const buffer = await readVerifiedAssetFile(asset)
  // Never serve original files/EXIF/GPS to anonymous visitors. Bound decompression.
  return sharp(buffer, { limitInputPixels: 40_000_000 }).rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer()
}
