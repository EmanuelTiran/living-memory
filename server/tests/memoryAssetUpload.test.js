import express from 'express'
import request from 'supertest'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { requestId } from '../src/middleware/requestId.js'
import { uploadMemoryAsset } from '../src/modules/media/memoryAssetUpload.js'

const app = express()

app.disable('x-powered-by')
app.use(requestId)
app.post(
  '/upload',
  uploadMemoryAsset,
  (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        originalFileName:
          req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        displayName:
          req.body.displayName,
      },
    })
  },
)
app.use(errorHandler)

function createPngBuffer() {
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
  ])
}

describe('Memory asset upload middleware', () => {
  it('accepts one supported image with valid content', async () => {
    const buffer = createPngBuffer()

    const response = await request(app)
      .post('/upload')
      .field('displayName', 'Portrait')
      .field('description', 'Family photo')
      .attach('asset', buffer, {
        filename: 'portrait.png',
        contentType: 'image/png',
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({
      originalFileName: 'portrait.png',
      mimeType: 'image/png',
      sizeBytes: buffer.length,
      displayName: 'Portrait',
    })
  })

  it('accepts a PDF with a valid signature', async () => {
    const response = await request(app)
      .post('/upload')
      .attach(
        'asset',
        Buffer.from('%PDF-1.7 private document'),
        {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        },
      )

    expect(response.status).toBe(200)
    expect(response.body.data.mimeType)
      .toBe('application/pdf')
  })

  it('rejects content that does not match the declared type', async () => {
    const response = await request(app)
      .post('/upload')
      .attach(
        'asset',
        Buffer.from('not a PNG'),
        {
          filename: 'fake.png',
          contentType: 'image/png',
        },
      )

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code:
        'INVALID_MEMORY_ASSET_CONTENT',
      requestId: expect.any(String),
    })
  })

  it('rejects unsupported file types', async () => {
    const response = await request(app)
      .post('/upload')
      .attach(
        'asset',
        Buffer.from('<svg></svg>'),
        {
          filename: 'unsafe.svg',
          contentType: 'image/svg+xml',
        },
      )

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code:
        'UNSUPPORTED_MEMORY_ASSET_TYPE',
    })
  })

  it('requires a file', async () => {
    const response = await request(app)
      .post('/upload')
      .field('displayName', 'Missing file')

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'MEMORY_ASSET_FILE_REQUIRED',
    })
  })

  it('rejects an unexpected upload field', async () => {
    const response = await request(app)
      .post('/upload')
      .attach(
        'document',
        createPngBuffer(),
        {
          filename: 'portrait.png',
          contentType: 'image/png',
        },
      )

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code:
        'INVALID_MEMORY_ASSET_FILE_COUNT',
    })
  })
})
