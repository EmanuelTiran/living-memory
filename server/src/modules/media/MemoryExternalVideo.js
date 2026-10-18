import mongoose from 'mongoose'
import { normalizeYouTubeVideo } from '../../../../shared/youtubeVideo.js'

const { Schema, model, models } = mongoose
const schema = new Schema({
  memoryId: { type: Schema.Types.ObjectId, ref: 'MemoryProfile', required: true },
  addedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, select: false },
  displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  provider: { type: String, enum: ['youtube'], required: true },
  canonicalUrl: { type: String, required: true, maxlength: 2048 },
  externalId: { type: String, required: true, match: /^[A-Za-z0-9_-]{11}$/ },
  startSeconds: { type: Number, required: true, min: 0, max: 604800, validate: Number.isSafeInteger },
  lifecycleStatus: { type: String, enum: ['active', 'archived'], default: 'active' },
  archivedAt: { type: Date, default: null },
}, {
  collection: 'memory_external_videos', timestamps: true, versionKey: false,
  toJSON: {
    transform(_document, value) {
      const safe = { ...value, id: value._id.toString() }
      delete safe._id
      delete safe.addedByUserId
      return safe
    },
  },
})

schema.index({ memoryId: 1, lifecycleStatus: 1, createdAt: -1 })
schema.pre('validate', function validateVideo() {
  const normalized = normalizeYouTubeVideo(this.canonicalUrl)
  if (!normalized || ['provider', 'canonicalUrl', 'externalId', 'startSeconds'].some(key => normalized[key] !== this[key])) {
    this.invalidate('canonicalUrl', 'External video reference is inconsistent or unsupported.')
  }
  if ((this.lifecycleStatus === 'archived') !== Boolean(this.archivedAt)) {
    this.invalidate('archivedAt', 'Archive status requires a matching timestamp.')
  }
})

export default models.MemoryExternalVideo ?? model('MemoryExternalVideo', schema)
