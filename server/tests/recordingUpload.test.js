import express from 'express'
import request from 'supertest'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { requestId } from '../src/middleware/requestId.js'
import { uploadRecording } from '../src/modules/media/recordingUpload.js'

const app = express()

app.disable('x-powered-by')
app.use(requestId)

app.post(
  '/upload',
  uploadRecording,
  (req, res) => {
    res.status(200).json({
      success: true,

      data: {
        originalFileName:
          req.file.originalname,

        mimeType:
          req.file.mimetype,

        sizeBytes:
          req.file.size,
      },
    })
  },
)

app.use(errorHandler)

function createWebmBuffer() {
  return Buffer.from([
    0x1a,
    0x45,
    0xdf,
    0xa3,
    0x42,
    0x86,
    0x81,
    0x01,
  ])
}

function createAdtsFrame() {
  const frame = Buffer.alloc(519)

  frame.set([
    0xff,
    0xf1,
    0x4c,
    0x80,
    0x40,
    0xff,
    0xfc,
  ])

  return frame
}

function createAdtsBuffer() {
  return Buffer.concat([
    createAdtsFrame(),
    createAdtsFrame(),
  ])
}

describe(
  'Recording upload middleware',
  () => {
    it('accepts one supported recording with a valid signature', async () => {
      const buffer =
        createWebmBuffer()

      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',
            buffer,
            {
              filename:
                'interview.webm',

              contentType:
                'audio/webm',
            },
          )

      expect(response.status).toBe(
        200,
      )

      expect(response.body).toEqual({
        success: true,

        data: {
          originalFileName:
            'interview.webm',

          mimeType:
            'audio/webm',

          sizeBytes:
            buffer.length,
        },
      })
    })

    it('accepts ADTS AAC content uploaded with an M4A-compatible type', async () => {
      const buffer =
        createAdtsBuffer()

      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',
            buffer,
            {
              filename:
                'recording.m4a',

              contentType:
                'audio/x-m4a',
            },
          )

      expect(response.status).toBe(
        200,
      )

      expect(response.body).toEqual({
        success: true,

        data: {
          originalFileName:
            'recording.m4a',

          mimeType:
            'audio/x-m4a',

          sizeBytes:
            buffer.length,
        },
      })
    })

    it('does not accept ADTS AAC content declared as MP3', async () => {
      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',
            createAdtsBuffer(),
            {
              filename:
                'recording.mp3',

              contentType:
                'audio/mpeg',
            },
          )

      expect(response.status).toBe(
        400,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'INVALID_RECORDING_CONTENT',

        requestId:
          expect.any(String),
      })
    })

    it('rejects an unsupported MIME type', async () => {
      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',

            Buffer.from(
              'unsupported',
            ),

            {
              filename:
                'recording.flac',

              contentType:
                'audio/flac',
            },
          )

      expect(response.status).toBe(
        400,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'UNSUPPORTED_RECORDING_TYPE',

        message:
          'Recording file type is not supported.',

        requestId:
          expect.any(String),
      })
    })

    it('rejects content that does not match the declared type', async () => {
      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',

            Buffer.from(
              'this is not a webm file',
            ),

            {
              filename:
                'fake.webm',

              contentType:
                'audio/webm',
            },
          )

      expect(response.status).toBe(
        400,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'INVALID_RECORDING_CONTENT',

        message:
          'Recording content does not match its declared file type.',

        requestId:
          expect.any(String),
      })
    })

    it('rejects a request without a recording', async () => {
      const response =
        await request(app).post(
          '/upload',
        )

      expect(response.status).toBe(
        400,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'RECORDING_FILE_REQUIRED',

        message:
          'A recording file is required.',

        requestId:
          expect.any(String),
      })
    })

    it('rejects an unexpected upload field', async () => {
      const response =
        await request(app)
          .post('/upload')
          .attach(
            'audio',
            createWebmBuffer(),
            {
              filename:
                'interview.webm',

              contentType:
                'audio/webm',
            },
          )

      expect(response.status).toBe(
        400,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'INVALID_RECORDING_FILE_COUNT',

        requestId:
          expect.any(String),
      })
    })

    it('rejects more than one recording', async () => {
      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',
            createWebmBuffer(),
            {
              filename:
                'first.webm',

              contentType:
                'audio/webm',
            },
          )
          .attach(
            'recording',
            createWebmBuffer(),
            {
              filename:
                'second.webm',

              contentType:
                'audio/webm',
            },
          )

      expect(response.status).toBe(
        400,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'INVALID_RECORDING_FILE_COUNT',

        requestId:
          expect.any(String),
      })
    })

    it('rejects a recording larger than 25 MB', async () => {
      const oversizedBuffer =
        Buffer.alloc(
          25 * 1024 * 1024 + 1,
        )

      oversizedBuffer.set(
        createWebmBuffer(),
        0,
      )

      const response =
        await request(app)
          .post('/upload')
          .attach(
            'recording',
            oversizedBuffer,
            {
              filename:
                'oversized.webm',

              contentType:
                'audio/webm',
            },
          )

      expect(response.status).toBe(
        413,
      )

      expect(
        response.body.error,
      ).toMatchObject({
        code:
          'RECORDING_FILE_TOO_LARGE',

        message:
          'Recording file must not exceed 25 MB.',

        requestId:
          expect.any(String),
      })
    })
  },
)