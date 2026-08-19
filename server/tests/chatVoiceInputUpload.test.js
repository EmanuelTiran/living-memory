import express from 'express'
import request from 'supertest'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { requestId } from '../src/middleware/requestId.js'
import {
  discardChatVoiceInput,
  uploadChatVoiceInput,
} from '../src/modules/chat/chatVoiceInputUpload.js'

const app = express()

app.disable('x-powered-by')
app.use(requestId)

app.post(
  '/upload',
  uploadChatVoiceInput,
  (req, res) => {
    const response = {
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    }

    discardChatVoiceInput(req)

    res.status(200).json({
      success: true,
      data: response,
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

describe('Chat voice-input upload middleware', () => {
  it('accepts one supported audio file with a valid signature', async () => {
    const buffer = createWebmBuffer()

    const response = await request(app)
      .post('/upload')
      .attach(
        'audio',
        buffer,
        {
          filename:
            'chat-input.webm',
          contentType:
            'audio/webm',
        },
      )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        mimeType: 'audio/webm',
        sizeBytes: buffer.length,
      },
    })
  })

  it('requires the dedicated audio field', async () => {
    const response = await request(app)
      .post('/upload')
      .attach(
        'recording',
        createWebmBuffer(),
        {
          filename:
            'chat-input.webm',
          contentType:
            'audio/webm',
        },
      )

    expect(response.status).toBe(400)
    expect(response.body.error)
      .toMatchObject({
        code:
          'CHAT_VOICE_INPUT_FILE_COUNT_INVALID',
      })
  })

  it('rejects audio whose content does not match its declared type', async () => {
    const response = await request(app)
      .post('/upload')
      .attach(
        'audio',
        Buffer.from('not a webm file'),
        {
          filename:
            'chat-input.webm',
          contentType:
            'audio/webm',
        },
      )

    expect(response.status).toBe(400)
    expect(response.body.error)
      .toMatchObject({
        code:
          'CHAT_VOICE_INPUT_CONTENT_INVALID',
      })
  })
})
