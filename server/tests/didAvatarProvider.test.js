import { Buffer } from 'node:buffer'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createDIDRealtimeAudio,
  deleteDIDRealtimeAudio,
  generateDIDAvatarVideo,
} from '../src/modules/digitalPersona/providers/didAvatarProvider.js'

function createPngBuffer() {
  return Buffer.concat([
    Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]),
    Buffer.alloc(24),
  ])
}

function createMp4Buffer() {
  return Buffer.concat([
    Buffer.from([
      0x00,
      0x00,
      0x00,
      0x18,
    ]),
    Buffer.from('ftypisom', 'ascii'),
    Buffer.alloc(24),
  ])
}

function jsonResponse(payload, status = 200) {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

function noContentResponse() {
  return new Response(null, {
    status: 204,
  })
}

function createSuccessfulFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce(
      jsonResponse(
        {
          id: 'image-resource',
          url:
            's3://private-bucket/avatar.png',
        },
        201,
      ),
    )
    .mockResolvedValueOnce(
      jsonResponse(
        {
          id: 'audio-resource',
          url:
            's3://private-bucket/audio.mp3',
        },
        201,
      ),
    )
    .mockResolvedValueOnce(
      jsonResponse(
        {
          id: 'talk-resource',
          status: 'created',
        },
        201,
      ),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        id: 'talk-resource',
        status: 'done',
        result_url:
          'https://cdn.example.test/talk.mp4',
      }),
    )
    .mockResolvedValueOnce(
      new Response(createMp4Buffer(), {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
        },
      }),
    )
    .mockResolvedValueOnce(
      noContentResponse(),
    )
    .mockResolvedValueOnce(
      noContentResponse(),
    )
    .mockResolvedValueOnce(
      noContentResponse(),
    )
}

function createInput() {
  return {
    audioBuffer: Buffer.from(
      'ID3-avatar-audio',
      'ascii',
    ),
    audioContentType: 'audio/mpeg',
  }
}

function createOptions(fetchImplementation) {
  return {
    fetchImplementation,
    apiKey: 'api-user:api-password',
    apiKeyMode: 'ENCODE_UTF8',
    imageBuffer: createPngBuffer(),
    timeoutMs: 20000,
    pollIntervalMs: 1,
    pollTimeoutMs: 20,
    pollDelay: vi
      .fn()
      .mockResolvedValue(undefined),
  }
}

describe('D-ID photo avatar provider', () => {
  it('uploads one approved audio file for realtime speech and deletes it afterward', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'audio-resource',
            url:
              'https://cdn.example.test/audio.mp3',
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        noContentResponse(),
      )

    const options = {
      fetchImplementation,
      apiKey:
        'api-user:api-password',
      apiKeyMode: 'ENCODE_UTF8',
      timeoutMs: 20000,
    }

    await expect(
      createDIDRealtimeAudio(
        createInput(),
        options,
      ),
    ).resolves.toEqual({
      resourceId: 'audio-resource',
      audioUrl:
        'https://cdn.example.test/audio.mp3',
    })

    await deleteDIDRealtimeAudio(
      'audio-resource',
      options,
    )

    expect(
      fetchImplementation.mock.calls[0][0],
    ).toBe(
      'https://api.d-id.com/audios',
    )
    expect(
      fetchImplementation.mock.calls[1],
    ).toMatchObject([
      'https://api.d-id.com/audios/audio-resource',
      expect.objectContaining({
        method: 'DELETE',
      }),
    ])
  })

  it('accepts D-ID internal S3 audio resources for realtime playback', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'audio-resource',
            url:
              's3://private-bucket/audio.mp3',
          },
          201,
        ),
      )

    await expect(
      createDIDRealtimeAudio(
        createInput(),
        {
          fetchImplementation,
          apiKey:
            'api-user:api-password',
          apiKeyMode:
            'ENCODE_UTF8',
          timeoutMs: 20000,
        },
      ),
    ).resolves.toEqual({
      resourceId: 'audio-resource',
      audioUrl:
        's3://private-bucket/audio.mp3',
    })

    expect(fetchImplementation)
      .toHaveBeenCalledTimes(1)
  })

  it('uploads approved media, downloads MP4, and deletes every temporary resource', async () => {
    const fetchImplementation =
      createSuccessfulFetch()

    const result =
      await generateDIDAvatarVideo(
        createInput(),
        createOptions(fetchImplementation),
      )

    expect(result).toMatchObject({
      contentType: 'video/mp4',
      fileExtension: 'mp4',
      provider: 'd-id',
      isAiGenerated: true,
    })

    expect(
      fetchImplementation,
    ).toHaveBeenCalledTimes(8)

    const uploadOptions =
      fetchImplementation.mock.calls[0][1]

    expect(
      uploadOptions.headers.Authorization,
    ).toBe(
      `Basic ${Buffer.from(
        'api-user:api-password',
        'utf8',
      ).toString('base64')}`,
    )

    expect(
      fetchImplementation.mock.calls
        .slice(-3)
        .every(
          ([, options]) =>
            options.method === 'DELETE',
        ),
    ).toBe(true)
  })

  it('maps NetFree-style HTTP 418 download failure and still cleans temporary resources', async () => {
    const blockedFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'image-resource',
            url:
              's3://private-bucket/avatar.png',
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'audio-resource',
            url:
              's3://private-bucket/audio.mp3',
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { id: 'talk-resource' },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'done',
          result_url:
            'https://cdn.example.test/talk.mp4',
        }),
      )
      .mockResolvedValueOnce(
        new Response('blocked', {
          status: 418,
        }),
      )
      .mockResolvedValueOnce(
        noContentResponse(),
      )
      .mockResolvedValueOnce(
        noContentResponse(),
      )
      .mockResolvedValueOnce(
        noContentResponse(),
      )

    await expect(
      generateDIDAvatarVideo(
        createInput(),
        createOptions(blockedFetch),
      ),
    ).rejects.toMatchObject({
      statusCode: 502,
      code:
        'DID_VIDEO_DOWNLOAD_BLOCKED',
    })

    expect(blockedFetch)
      .toHaveBeenCalledTimes(8)
  })

  it('reports a missing local avatar image without contacting D-ID', async () => {
    const fetchImplementation = vi.fn()

    await expect(
      generateDIDAvatarVideo(
        createInput(),
        {
          fetchImplementation,
          apiKey:
            'api-user:api-password',
          imagePath:
            './missing-avatar-image.png',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'DID_AVATAR_IMAGE_INVALID',
    })

    expect(fetchImplementation)
      .not.toHaveBeenCalled()
  })
})
