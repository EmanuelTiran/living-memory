import {
  describe,
  expect,
  it,
} from 'vitest'
import { parseMemoryAssetMetadata } from '../src/modules/media/memoryAssetMetadataParser.js'

function createPngBuffer(
  width,
  height,
) {
  const buffer = Buffer.alloc(24)

  Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)

  return buffer
}

function createJpegBuffer(
  width,
  height,
) {
  const buffer = Buffer.alloc(21)

  buffer.set([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
  ])
  buffer.writeUInt16BE(height, 7)
  buffer.writeUInt16BE(width, 9)

  return buffer
}

function createWebpBuffer(
  width,
  height,
) {
  const buffer = Buffer.alloc(30)

  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(22, 4)
  buffer.write('WEBP', 8, 'ascii')
  buffer.write('VP8X', 12, 'ascii')
  buffer.writeUIntLE(width - 1, 24, 3)
  buffer.writeUIntLE(height - 1, 27, 3)

  return buffer
}

describe(
  'Memory asset metadata parser',
  () => {
    it.each([
      [
        'image/png',
        createPngBuffer(640, 480),
      ],
      [
        'image/jpeg',
        createJpegBuffer(800, 600),
      ],
      [
        'image/webp',
        createWebpBuffer(320, 240),
      ],
    ])(
      'extracts dimensions from %s',
      (mimeType, buffer) => {
        const metadata =
          parseMemoryAssetMetadata(
            buffer,
            mimeType,
          )

        expect(metadata).toMatchObject({
          parserVersion:
            'asset-metadata-v1',
          widthPixels:
            mimeType === 'image/png'
              ? 640
              : mimeType === 'image/jpeg'
                ? 800
                : 320,
          heightPixels:
            mimeType === 'image/png'
              ? 480
              : mimeType === 'image/jpeg'
                ? 600
                : 240,
        })
      },
    )

    it('counts visible PDF page objects without extracting private text', () => {
      const buffer = Buffer.from(
        '%PDF-1.7\n/Type /Pages\n/Type /Page\n/Type/Page\n%%EOF',
        'latin1',
      )

      expect(
        parseMemoryAssetMetadata(
          buffer,
          'application/pdf',
        ),
      ).toEqual({
        parserVersion:
          'asset-metadata-v1',
        widthPixels: null,
        heightPixels: null,
        pageCount: 2,
      })
    })

    it('rejects malformed content', () => {
      expect(() =>
        parseMemoryAssetMetadata(
          Buffer.from('not-an-image'),
          'image/png',
        ),
      ).toThrowError(
        expect.objectContaining({
          code:
            'MEMORY_ASSET_METADATA_PARSE_FAILED',
        }),
      )
    })
  },
)
