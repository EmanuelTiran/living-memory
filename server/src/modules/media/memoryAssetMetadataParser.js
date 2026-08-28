import { AppError } from '../../errors/AppError.js'

const JPEG_START_OF_FRAME_MARKERS =
  new Set([
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ])

function createParsingError() {
  return new AppError(
    'Memory asset metadata could not be parsed.',
    {
      statusCode: 422,
      code:
        'MEMORY_ASSET_METADATA_PARSE_FAILED',
    },
  )
}

function validateDimensions(
  widthPixels,
  heightPixels,
) {
  if (
    !Number.isInteger(widthPixels) ||
    !Number.isInteger(heightPixels) ||
    widthPixels < 1 ||
    heightPixels < 1 ||
    widthPixels > 100_000 ||
    heightPixels > 100_000
  ) {
    throw createParsingError()
  }

  return {
    widthPixels,
    heightPixels,
  }
}

function parsePngDimensions(buffer) {
  const signature = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ])

  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(
      signature,
    ) ||
    buffer.toString(
      'ascii',
      12,
      16,
    ) !== 'IHDR'
  ) {
    throw createParsingError()
  }

  return validateDimensions(
    buffer.readUInt32BE(16),
    buffer.readUInt32BE(20),
  )
}

function parseJpegDimensions(buffer) {
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8
  ) {
    throw createParsingError()
  }

  let offset = 2

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    while (
      offset < buffer.length &&
      buffer[offset] === 0xff
    ) {
      offset += 1
    }

    const marker = buffer[offset]
    offset += 1

    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 &&
        marker <= 0xd7)
    ) {
      continue
    }

    if (
      marker === 0xd9 ||
      marker === 0xda ||
      offset + 2 > buffer.length
    ) {
      break
    }

    const segmentLength =
      buffer.readUInt16BE(offset)

    if (
      segmentLength < 2 ||
      offset + segmentLength >
        buffer.length
    ) {
      throw createParsingError()
    }

    if (
      JPEG_START_OF_FRAME_MARKERS
        .has(marker)
    ) {
      if (segmentLength < 7) {
        throw createParsingError()
      }

      return validateDimensions(
        buffer.readUInt16BE(offset + 5),
        buffer.readUInt16BE(offset + 3),
      )
    }

    offset += segmentLength
  }

  throw createParsingError()
}

function parseWebpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString(
      'ascii',
      0,
      4,
    ) !== 'RIFF' ||
    buffer.toString(
      'ascii',
      8,
      12,
    ) !== 'WEBP'
  ) {
    throw createParsingError()
  }

  const format = buffer.toString(
    'ascii',
    12,
    16,
  )

  if (format === 'VP8X') {
    return validateDimensions(
      buffer.readUIntLE(24, 3) + 1,
      buffer.readUIntLE(27, 3) + 1,
    )
  }

  if (
    format === 'VP8L' &&
    buffer[20] === 0x2f
  ) {
    const bits =
      buffer.readUInt32LE(21)

    return validateDimensions(
      (bits & 0x3fff) + 1,
      ((bits >>> 14) & 0x3fff) + 1,
    )
  }

  if (
    format === 'VP8 ' &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return validateDimensions(
      buffer.readUInt16LE(26) &
        0x3fff,
      buffer.readUInt16LE(28) &
        0x3fff,
    )
  }

  throw createParsingError()
}

function parsePdfMetadata(buffer) {
  if (
    buffer.length < 8 ||
    buffer.toString(
      'ascii',
      0,
      5,
    ) !== '%PDF-'
  ) {
    throw createParsingError()
  }

  const content = buffer.toString(
    'latin1',
  )
  const pageCount = (
    content.match(
      /\/Type\s*\/Page(?!s)\b/g,
    ) ?? []
  ).length

  return {
    pageCount:
      pageCount > 0
        ? pageCount
        : null,
  }
}

export function parseMemoryAssetMetadata(
  buffer,
  mimeType,
) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(
      'Memory asset parser requires a Buffer.',
    )
  }

  let metadata

  if (mimeType === 'image/png') {
    metadata = parsePngDimensions(
      buffer,
    )
  } else if (
    mimeType === 'image/jpeg'
  ) {
    metadata = parseJpegDimensions(
      buffer,
    )
  } else if (
    mimeType === 'image/webp'
  ) {
    metadata = parseWebpDimensions(
      buffer,
    )
  } else if (
    mimeType === 'application/pdf'
  ) {
    metadata = parsePdfMetadata(buffer)
  } else {
    throw createParsingError()
  }

  return Object.freeze({
    parserVersion:
      'asset-metadata-v1',
    widthPixels: null,
    heightPixels: null,
    pageCount: null,
    ...metadata,
  })
}
